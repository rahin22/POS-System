import { randomUUID } from 'crypto';

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

const BASE_URLS = {
  dev: 'https://api-dev.smart-connect.cloud/POS',
  prod: 'https://api.smart-connect.cloud/POS',
};

let cfg: {
  environment: 'dev' | 'prod';
  posRegisterID: string;
  posRegisterName: string;
  posBusinessName: string;
  posVendorName: string;
} = {
  environment: 'prod',
  posRegisterID: randomUUID(),
  posRegisterName: 'Main Register',
  posBusinessName: '',
  posVendorName: 'KebabPOS',
};

export function configure(updates: Partial<typeof cfg>) {
  Object.assign(cfg, updates);
}

function baseUrl() {
  return BASE_URLS[cfg.environment];
}

export async function pair(pairingCode: string): Promise<{ success: boolean; error?: string }> {
  try {
    const body = new URLSearchParams({
      POSRegisterID: cfg.posRegisterID,
      POSRegisterName: cfg.posRegisterName,
      POSBusinessName: cfg.posBusinessName,
      POSVendorName: cfg.posVendorName,
    });

    const res = await fetch(`${baseUrl()}/Pairing/${encodeURIComponent(pairingCode)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const json = await res.json() as any;
    if (res.status === 200 && json.result === 'success') return { success: true };
    return { success: false, error: json.error || `HTTP ${res.status}` };
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
    const body = new URLSearchParams({
      POSRegisterID: cfg.posRegisterID,
      POSBusinessName: cfg.posBusinessName,
      POSVendorName: cfg.posVendorName,
      TransactionMode: 'ASYNC',
      TransactionType: 'Card.Purchase',
      AmountTotal: String(amountCents),
    });

    const initRes = await fetch(`${baseUrl()}/Transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!initRes.ok) {
      const errJson = await initRes.json().catch(() => ({})) as any;
      return { outcome: 'Failed', error: errJson.error || `HTTP ${initRes.status}` };
    }

    const initData = await initRes.json() as any;
    const pollingUrl: string | undefined = initData.data?.PollingUrl;

    if (!pollingUrl) {
      return { outcome: 'Failed', error: 'No polling URL returned from SmartConnect' };
    }

    let delayedNotified = false;

    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

      const pollRes = await fetch(pollingUrl);
      if (pollRes.status === 429) continue; // rate-limited, wait next cycle

      if (!pollRes.ok) {
        return { outcome: 'Failed', error: `Poll HTTP ${pollRes.status}` };
      }

      const pollData = await pollRes.json() as any;

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
