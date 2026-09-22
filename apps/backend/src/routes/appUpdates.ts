import { Router } from 'express';
import { cachedQuery } from '../services/cache';

/**
 * Self-hosted live updates for the Capacitor apps.
 *
 * The Sunmi runs a web bundle inside a native shell. Everything under
 * apps/android/src is that bundle and can be replaced over the air; everything
 * under apps/android/android - SunmiPrinterPlugin, MainActivity - is compiled into
 * the APK and cannot. This endpoint serves the former, so a JS-only fix no longer
 * means a trip to the shop with a USB cable.
 *
 * Bundles and their manifests live in a public Supabase Storage bucket that
 * scripts/release-android.mjs writes to. There is deliberately no database table:
 * the manifest is the record, and rolling back is republishing the previous one.
 *
 * The updater is a native client with no Supabase session, so this route is public.
 * It only ever hands back a URL to an already-public bundle.
 */

const router = Router();

const BUCKET = 'app-bundles';

// Short, because it is the only thing standing between publishing a release and the
// tills seeing it. A stale minute is fine; a stale hour would have us wondering why
// a published fix had not landed.
const MANIFEST_TTL_SECONDS = 60;

// Both are interpolated into a storage path, so neither may contain a slash or dots
// that could climb out of the bucket
const SAFE_ID = /^[A-Za-z0-9._-]+$/;

interface Manifest {
  version: string;
  url: string;
  checksum: string;
  /** Parks a bad release without deleting it, so rollback is a one-field edit */
  disabled?: boolean;
  /**
   * Lowest native (APK) version this bundle may be served to. A bundle that calls a
   * native method the installed APK does not carry would break the till, and the
   * whole point of shipping this way is that nobody is standing at the till to fix
   * it. Set it whenever a release depends on new native code.
   */
  minNative?: string;
}

type Version = [number, number, number];

// Missing parts count as zero, so the "1.0" that Android's versionName carries by
// default reads as 1.0.0. Requiring all three would have made every fresh install
// report a version we could not read, and quietly never update.
const parseVersion = (value: unknown): Version | null => {
  if (typeof value !== 'string') return null;
  const match = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
};

const compare = (a: Version, b: Version): number => {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
};

const loadManifest = (appId: string, channel: string) =>
  cachedQuery<Manifest | null>(
    `app_manifest:${appId}:${channel}`,
    async () => {
      const url = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${appId}/${channel}.json`;

      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });

        // A missing manifest is the normal state of a channel nobody has published
        // to yet, so it is not worth an error line
        if (response.status === 404) return null;

        if (!response.ok) {
          console.error(`[updates] Manifest fetch for ${appId}/${channel} returned ${response.status}`);
          return null;
        }

        return (await response.json()) as Manifest;
      } catch (error: any) {
        console.error(`[updates] Could not read manifest for ${appId}/${channel}: ${error?.message ?? error}`);
        return null;
      }
    },
    MANIFEST_TTL_SECONDS
  );

/**
 * The updater POSTs here every time the app opens. Answering with a url starts a
 * download; answering with a message leaves the device where it is.
 */
router.post('/updates', async (req, res) => {
  const body = req.body ?? {};
  const appId = body.app_id;
  const versionName = body.version_name;
  const versionBuild = body.version_build;
  const platform = body.platform;

  const channel =
    typeof body.channel === 'string' && SAFE_ID.test(body.channel) ? body.channel : 'production';

  if (typeof appId !== 'string' || !SAFE_ID.test(appId)) {
    return res.json({ message: 'Unknown app' });
  }

  const manifest = await loadManifest(appId, channel);

  if (!manifest || manifest.disabled) {
    return res.json({ message: 'No update available' });
  }

  const released = parseVersion(manifest.version);

  if (!released || !manifest.url || !manifest.checksum) {
    console.error(`[updates] Manifest for ${appId}/${channel} is missing a version, url or checksum`);
    return res.json({ message: 'No update available' });
  }

  // version_name is the OTA bundle the device already took, or "builtin" while it is
  // still on the one compiled into the APK. Falling back to version_build covers
  // both that case and any value we cannot read.
  const current = parseVersion(versionName) ?? parseVersion(versionBuild);

  if (!current) {
    console.warn(
      `[updates] ${appId} reported no readable version (name=${versionName}, build=${versionBuild})`
    );
    return res.json({ message: 'Current version unreadable' });
  }

  if (compare(released, current) <= 0) {
    return res.json({ message: 'Up to date' });
  }

  const floor = parseVersion(manifest.minNative);

  if (floor) {
    const native = parseVersion(versionBuild);

    if (!native || compare(native, floor) < 0) {
      console.warn(
        `[updates] Holding ${manifest.version} back from ${appId}: needs APK >= ${manifest.minNative}, device is on ${versionBuild}`
      );
      return res.json({ message: 'Native build too old for this bundle' });
    }
  }

  console.log(
    `[updates] Serving ${manifest.version} to ${appId} on ${platform} (was ${versionName})`
  );

  return res.json({
    version: manifest.version,
    url: manifest.url,
    checksum: manifest.checksum,
  });
});

export default router;
