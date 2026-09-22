#!/usr/bin/env node
/**
 * Publish an over-the-air bundle for the Android POS.
 *
 *   node scripts/release-android.mjs [--channel production] [--min-native 1.0.4]
 *                                    [--dry-run]
 *
 * Builds apps/android, zips the result, and uploads the zip plus a manifest to the
 * public `app-bundles` Supabase Storage bucket. The backend serves it from
 * /api/app/updates and the tills pick it up on their next launch.
 *
 * WHAT THIS CAN AND CANNOT SHIP
 *
 * Only the web bundle - everything under apps/android/src. Anything under
 * apps/android/android is compiled into the APK: SunmiPrinterPlugin, MainActivity,
 * added or upgraded Capacitor plugins, capacitor.config.ts, permissions, the icon.
 * Those still need an APK built and installed by hand. If a release depends on new
 * native code, pass --min-native with the APK version that carries it and the
 * backend will hold the bundle back from devices still on an older build.
 *
 * The version published is whatever is in apps/android/package.json, so bump it
 * before releasing or the tills will decide they are already up to date.
 *
 * Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, read from the environment or
 * from apps/backend/.env.
 *
 * WHY NOT THE CAPGO CLI
 *
 * `npx @capgo/cli bundle zip` is the documented way to produce the archive and its
 * checksum, but its plugin detection resolves node_modules in a way that does not
 * survive an npm-workspaces monorepo on Windows - it reports the updater as missing
 * even when require.resolve finds it from the same directory. Rather than depend on
 * that, this builds the identical artefact directly. Both pieces are matched to the
 * CLI's own implementation:
 *
 *   - the archive is a plain zip of the dist folder, paths relative, forward slashes,
 *     no wrapping directory
 *   - the checksum is CRC-32 of the finished zip as zero-padded lowercase hex. The
 *     CLI only uses SHA-256 for encrypted bundles or for updater plugins older than
 *     6.25.0; from that version on, unencrypted bundles are CRC-32.
 */

import archiver from 'archiver';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'apps', 'android');

const args = process.argv.slice(2);
const flag = (name, fallback = undefined) => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : args[at + 1];
};
const dryRun = args.includes('--dry-run');
const channel = flag('channel', 'production');
const minNative = flag('min-native');

const die = (message) => {
  console.error(`\n  ${message}\n`);
  process.exit(1);
};

// ---------------------------------------------------------------- environment

const loadEnv = () => {
  const envPath = join(root, 'apps', 'backend', '.env');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    process.env[key] = raw.replace(/^["']|["']$/g, '');
  }
};

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  die('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or present in apps/backend/.env).');
}

// ------------------------------------------------------------------- identity

const pkg = JSON.parse(readFileSync(join(androidDir, 'package.json'), 'utf8'));
const version = pkg.version;

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  die(`apps/android/package.json version must be plain semver, found "${version}".`);
}

const capConfig = readFileSync(join(androidDir, 'capacitor.config.ts'), 'utf8');
const appId = /appId:\s*['"]([^'"]+)['"]/.exec(capConfig)?.[1];

if (!appId) die('Could not read appId out of apps/android/capacitor.config.ts.');

console.log(`\n  ${appId}  ${version}  (${channel})\n`);

// ---------------------------------------------------------------------- build

console.log('  Building the web bundle...');
execFileSync('npm', ['run', 'build'], {
  cwd: androidDir,
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32',
});

const distDir = join(androidDir, 'dist');

if (!existsSync(join(distDir, 'index.html'))) {
  die('apps/android/dist/index.html is missing - the build did not produce a bundle.');
}

// The updater reverts any bundle that does not call notifyAppReady(), so shipping one
// that cannot would brick the till until someone walked over with a cable.
const bundleCallsAppReady = readdirSync(join(distDir, 'assets'))
  .filter((name) => name.endsWith('.js'))
  .some((name) => readFileSync(join(distDir, 'assets', name), 'utf8').includes('notifyAppReady'));

if (!bundleCallsAppReady) {
  die(
    'The built bundle never calls notifyAppReady(), so the updater would roll it back.\n' +
      '  Check apps/android/src/lib/capacitor.ts and its call in App.tsx.'
  );
}

// ------------------------------------------------------------------------ zip

const zipDirectory = (source) =>
  new Promise((resolvePromise, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];

    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('warning', reject);
    archive.on('error', reject);
    archive.on('end', () => resolvePromise(Buffer.concat(chunks)));

    // Walked by hand rather than archive.directory() so the entry names are
    // unambiguously relative and forward-slashed on every platform
    const add = (dir) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) add(full);
        else archive.append(readFileSync(full), { name: relative(source, full).split(sep).join('/') });
      }
    };

    add(source);
    archive.finalize();
  });

/** CRC-32, matching the updater's own implementation exactly. */
const crc32 = (buffer) => {
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value;
  }));

  let crc = 0xffffffff;
  for (const byte of buffer) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
};

console.log('  Zipping...');
const zip = await zipDirectory(distDir);
const checksum = crc32(zip);

console.log(`  ${(zip.byteLength / 1024).toFixed(0)} KiB   crc32 ${checksum}`);

// --------------------------------------------------------------------- upload

const bundlePath = `app-bundles/${appId}/${version}.zip`;
const manifestPath = `app-bundles/${appId}/${channel}.json`;

const manifest = {
  version,
  url: `${supabaseUrl}/storage/v1/object/public/${bundlePath}`,
  checksum,
  ...(minNative ? { minNative } : {}),
  publishedAt: new Date().toISOString(),
};

if (dryRun) {
  console.log('\n  --dry-run, nothing uploaded. Manifest would be:\n');
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

const upload = async (path, body, contentType) => {
  const response = await fetch(`${supabaseUrl}/storage/v1/object/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': contentType,
      // Republishing the same version replaces it rather than failing
      'x-upsert': 'true',
    },
    body,
  });

  if (!response.ok) {
    die(`Upload of ${path} failed (${response.status}): ${await response.text()}`);
  }
};

console.log('  Uploading the bundle...');
await upload(bundlePath, zip, 'application/zip');

console.log('  Publishing the manifest...');
await upload(manifestPath, JSON.stringify(manifest, null, 2), 'application/json');

console.log(`
  Published ${version} to ${channel}.

  The backend caches manifests for 60s, so a till will see this within a minute of
  its next launch. To roll back, re-run this from the previous commit, or set
  "disabled": true on ${manifestPath}.
`);
