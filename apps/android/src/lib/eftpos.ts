/**
 * EFTPOS Service — SmartConnect (Shift4 / Smartpay)
 *
 * Android/Capacitor port of the terminal app's `src/main/eftpos.ts`.
 *
 * The Electron version runs this in the main process (plain `fetch`, settings in
 * electron-store). Here it runs in the WebView, so:
 *   - requests go through CapacitorHttp on device, which issues them natively and
 *     therefore isn't subject to the WebView's CORS rules
 *   - settings live in Capacitor Preferences instead of electron-store
 */

import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Same storage semantics as `settings` in ./platform — kept local to avoid an
// import cycle, since platform.ts surfaces these settings on the compat layer.
async function prefGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const { value } = await Preferences.get({ key });
    if (value === null) return defaultValue;
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

async function prefSet(key: string, value: any): Promise<void> {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export type EftposOutcome = 'Accepted' | 'Declined' | 'Cancelled' | 'DeviceOffline' | 'Failed';

export interface EftposResult {
  outcome: EftposOutcome;
  amountTotal?: number; // cents as charged (may differ from requested if terminal adds surcharge)
  authId?: string;
  acquirerRef?: string;
  terminalRef?: string;
  cardPan?: string;
  cardType?: string;
  receipt?: string;
  transactionId?: string;
  error?: string;
}

export interface EftposData {
  receipt?: string;
  authId?: string;
  terminalRef?: string;
  cardPan?: string;
  cardType?: string;
  transactionId?: string;
  amountTotal?: number;
}

export interface EftposSettings {
  eftposEnabled: boolean;
  eftposEnvironment: 'dev' | 'prod';
  eftposRegisterID: string;
  eftposRegisterName: string;
  eftposBusinessName: string;
  eftposPrintReceipt: boolean;
}

const BASE_URLS = {
  dev: 'https://api-dev.smart-connect.cloud/POS',
  prod: 'https://api.smart-connect.cloud/POS',
};

const VENDOR_NAME = 'KebabPOS';

export const EFTPOS_DEFAULTS: Omit<EftposSettings, 'eftposRegisterID'> = {
  eftposEnabled: false,
  eftposEnvironment: 'prod',
  eftposRegisterName: 'Main Register',
  eftposBusinessName: 'Al Taher Kebabs',
  eftposPrintReceipt: true,
};

// crypto.randomUUID() needs a secure context — the dev server is plain http, so fall back
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Register ID identifies this POS to SmartConnect. Generated once on first use and
 * never changed — if it changes the register must be re-paired.
 */
export async function ensureRegisterID(): Promise<string> {
  const existing = await prefGet<string>('eftposRegisterID', '');
  if (existing) return existing;

  const generated = generateUUID();
  await prefSet('eftposRegisterID', generated);
  return generated;
}

export async function getEftposSettings(): Promise<EftposSettings> {
  const [enabled, environment, registerName, businessName, printReceipt, registerID] = await Promise.all([
    prefGet('eftposEnabled', EFTPOS_DEFAULTS.eftposEnabled),
    prefGet<'dev' | 'prod'>('eftposEnvironment', EFTPOS_DEFAULTS.eftposEnvironment),
    prefGet('eftposRegisterName', EFTPOS_DEFAULTS.eftposRegisterName),
    prefGet('eftposBusinessName', EFTPOS_DEFAULTS.eftposBusinessName),
    prefGet('eftposPrintReceipt', EFTPOS_DEFAULTS.eftposPrintReceipt),
    ensureRegisterID(),
  ]);

  return {
    eftposEnabled: enabled,
    eftposEnvironment: environment,
    eftposRegisterID: registerID,
    eftposRegisterName: registerName,
    eftposBusinessName: businessName,
    eftposPrintReceipt: printReceipt,
  };
}

export async function saveEftposSettings(updates: Partial<Omit<EftposSettings, 'eftposRegisterID'>>): Promise<void> {
  // Never write the Register ID through here — it must stay stable
  for (const [key, value] of Object.entries(updates)) {
    await prefSet(key, value);
  }
}

function baseUrl(environment: 'dev' | 'prod') {
  return BASE_URLS[environment];
}

interface HttpResult {
  status: number;
  ok: boolean;
  json: any;
}

function parseBody(data: any): any {
  if (typeof data !== 'string') return data ?? {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * POST/PUT a form-urlencoded body. CapacitorHttp serialises a plain object into
 * `key=value&...` when the content type says form-urlencoded.
 */
async function postForm(url: string, method: 'POST' | 'PUT', fields: Record<string, string>): Promise<HttpResult> {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({ url, method, headers, data: fields });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, json: parseBody(res.data) };
  }

  const res = await fetch(url, { method, headers, body: new URLSearchParams(fields).toString() });
  return { status: res.status, ok: res.ok, json: await res.json().catch(() => ({})) };
}

async function httpGet(url: string): Promise<HttpResult> {
  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({ url, method: 'GET' });
    return { status: res.status, ok: res.status >= 200 && res.status < 300, json: parseBody(res.data) };
  }

  const res = await fetch(url);
  return { status: res.status, ok: res.ok, json: await res.json().catch(() => ({})) };
}

export async function pair(pairingCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const cfg = await getEftposSettings();

    const res = await postForm(
      `${baseUrl(cfg.eftposEnvironment)}/Pairing/${encodeURIComponent(pairingCode)}`,
      'PUT',
      {
        POSRegisterID: cfg.eftposRegisterID,
        POSRegisterName: cfg.eftposRegisterName,
        POSBusinessName: cfg.eftposBusinessName,
        POSVendorName: VENDOR_NAME,
      }
    );

    if (res.status === 200 && res.json?.result === 'success') return { success: true };
    return { success: false, error: res.json?.error || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function mapOutcome(transactionResult: string, result: string): EftposOutcome {
  if (transactionResult === 'OK-ACCEPTED') return 'Accepted';
  if (transactionResult === 'OK-DECLINED') return 'Declined';
  if (transactionResult === 'CANCELLED' && result !== 'FAILED-INTERFACE') return 'Cancelled';
  if (transactionResult === 'CANCELLED' && result === 'FAILED-INTERFACE') return 'DeviceOffline';
  return 'Failed';
}

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 90; // 3 minutes

export async function purchase(
  amountCents: number,
  onDelayed?: () => void
): Promise<EftposResult> {
  try {
    const cfg = await getEftposSettings();

    const initRes = await postForm(`${baseUrl(cfg.eftposEnvironment)}/Transaction`, 'POST', {
      POSRegisterID: cfg.eftposRegisterID,
      POSBusinessName: cfg.eftposBusinessName,
      POSVendorName: VENDOR_NAME,
      TransactionMode: 'ASYNC',
      TransactionType: 'Card.Purchase',
      AmountTotal: String(amountCents),
    });

    if (!initRes.ok) {
      return { outcome: 'Failed', error: initRes.json?.error || `HTTP ${initRes.status}` };
    }

    const pollingUrl: string | undefined = initRes.json?.data?.PollingUrl;

    if (!pollingUrl) {
      return { outcome: 'Failed', error: 'No polling URL returned from SmartConnect' };
    }

    let delayedNotified = false;

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await httpGet(pollingUrl);
      if (pollRes.status === 429) continue; // rate-limited, wait next cycle

      if (!pollRes.ok) {
        return { outcome: 'Failed', error: `Poll HTTP ${pollRes.status}` };
      }

      const pollData = pollRes.json ?? {};

      if (pollData.transactionStatus === 'PENDING') {
        if (!delayedNotified && pollData.data?.TransactionResult === 'OK-DELAYED') {
          delayedNotified = true;
          onDelayed?.();
        }
        continue;
      }

      if (pollData.transactionStatus === 'COMPLETED') {
        const d = pollData.data ?? {};
        return {
          outcome: mapOutcome(d.TransactionResult ?? '', d.Result ?? ''),
          amountTotal: d.AmountTotal ? parseInt(d.AmountTotal, 10) : amountCents,
          authId: d.AuthId,
          acquirerRef: d.AcquirerRef,
          terminalRef: d.TerminalRef,
          cardPan: d.CardPan,
          cardType: d.CardType,
          receipt: d.Receipt,
          transactionId: pollData.transactionId,
        };
      }
    }

    return { outcome: 'Failed', error: 'Transaction timed out after 3 minutes' };
  } catch (err: any) {
    return { outcome: 'Failed', error: err.message };
  }
}
