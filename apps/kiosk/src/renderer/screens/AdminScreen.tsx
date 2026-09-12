import { useEffect, useState } from 'react';
import {
  CreditCard,
  Download,
  LogOut,
  Monitor,
  Printer,
  RefreshCw,
  Server,
  X,
} from 'lucide-react';
import type { KioskSettings, UpdateState } from '../types';

interface AdminScreenProps {
  onClose: () => void;
  onSettingsSaved: (settings: KioskSettings) => void;
}

export function AdminScreen({ onClose, onSettingsSaved }: AdminScreenProps) {
  const [settings, setSettings] = useState<KioskSettings | null>(null);
  const [printers, setPrinters] = useState<Array<{ name: string; displayName: string }>>([]);
  const [appVersion, setAppVersion] = useState('');
  const [updateState, setUpdateState] = useState<UpdateState>({ status: 'idle' });
  const [pairingCode, setPairingCode] = useState('');
  const [pairingStatus, setPairingStatus] = useState<'idle' | 'pairing' | 'success' | 'error'>('idle');
  const [pairingError, setPairingError] = useState('');
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setSettings(await window.kioskAPI.getSettings());
      setPrinters(await window.kioskAPI.getPrinters());
      setAppVersion((await window.kioskAPI.getAppInfo()).version);
      setUpdateState(await window.kioskAPI.updates.getState());
    })();

    return window.kioskAPI.updates.onState(setUpdateState);
  }, []);

  if (!settings) {
    return (
      <div className="flex h-full items-center justify-center bg-cream-100 text-ink-700">
        Loading settings&hellip;
      </div>
    );
  }

  const update = (patch: Partial<KioskSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

  const save = async () => {
    await window.kioskAPI.setSettings(settings);
    const fresh = await window.kioskAPI.getSettings();
    setSettings(fresh);
    onSettingsSaved(fresh);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const pair = async () => {
    if (!pairingCode.trim()) return;
    setPairingStatus('pairing');
    setPairingError('');
    await window.kioskAPI.setSettings(settings);
    const result = await window.kioskAPI.eftpos.pair(pairingCode.trim());
    if (result.success) {
      setPairingStatus('success');
      setPairingCode('');
    } else {
      setPairingStatus('error');
      setPairingError(result.error || 'Pairing failed');
    }
  };

  const testPrint = async () => {
    await window.kioskAPI.setSettings(settings);
    const result = await window.kioskAPI.printTest();
    setTestResult(result.success ? 'Test ticket sent to the printer' : `Print failed: ${result.error}`);
    setTimeout(() => setTestResult(null), 5000);
  };

  const Section = ({
    title,
    icon: Icon,
    children,
  }: {
    title: string;
    icon: typeof Server;
    children: React.ReactNode;
  }) => (
    <section className="card p-8">
      <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-ink-900">
        <Icon className="h-7 w-7 text-brand-600" aria-hidden="true" />
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );

  const Field = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
    <label className="block">
      <span className="mb-2 block text-lg font-semibold text-ink-800">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-base text-ink-500">{hint}</span>}
    </label>
  );

  const inputClass =
    'w-full rounded-xl border-2 border-cream-400 bg-white px-5 py-4 text-lg text-ink-900 focus:border-brand-500 focus:outline-none';

  const Toggle = ({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) => (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`h-11 w-20 shrink-0 rounded-full transition-colors ${value ? 'bg-brand-500' : 'bg-cream-400'}`}
    >
      <span
        className={`block h-9 w-9 rounded-full bg-white transition-transform ${
          value ? 'translate-x-10' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="h-full overflow-y-auto bg-cream-100 p-8">
      <div className="mx-auto max-w-[900px] space-y-6 pb-16">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-ink-900">Kiosk settings</h1>
            <p className="mt-1 text-lg text-ink-500">Version {appVersion}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touchable flex h-16 w-16 items-center justify-center rounded-full bg-white text-ink-900 hover:bg-cream-200"
            aria-label="Close settings"
          >
            <X className="h-8 w-8" aria-hidden="true" />
          </button>
        </header>

        <Section title="Backend" icon={Server}>
          <Field label="API URL">
            <input
              className={inputClass}
              value={settings.apiUrl}
              onChange={(event) => update({ apiUrl: event.target.value })}
            />
          </Field>
        </Section>

        <Section title="Receipt printer" icon={Printer}>
          <div className="flex items-center justify-between gap-6">
            <span className="text-lg text-ink-800">Print a ticket for each order</span>
            <Toggle
              value={settings.printerEnabled}
              onChange={(next) => update({ printerEnabled: next })}
            />
          </div>

          <Field label="Windows printer" hint="The kiosk's built-in thermal printer">
            <select
              className={inputClass}
              value={settings.printerName}
              onChange={(event) => update({ printerName: event.target.value })}
            >
              <option value="">System default</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-5">
            <Field label="Paper width (mm)">
              <input
                type="number"
                className={inputClass}
                value={settings.paperWidthMm}
                onChange={(event) => update({ paperWidthMm: Number(event.target.value) })}
              />
            </Field>
            <Field label="Copies">
              <input
                type="number"
                min={1}
                max={3}
                className={inputClass}
                value={settings.receiptCopies}
                onChange={(event) => update({ receiptCopies: Number(event.target.value) })}
              />
            </Field>
          </div>

          <button type="button" onClick={testPrint} className="btn-secondary w-full text-lg">
            Print test ticket
          </button>
          {testResult && <p className="text-base text-brand-700">{testResult}</p>}
        </Section>

        <Section title="Card terminal (SmartConnect)" icon={CreditCard}>
          <div className="flex items-center justify-between gap-6">
            <span className="text-lg text-ink-800">Take card payments</span>
            <Toggle
              value={settings.eftposEnabled}
              onChange={(next) => update({ eftposEnabled: next })}
            />
          </div>

          <Field label="Environment">
            <select
              className={inputClass}
              value={settings.eftposEnvironment}
              onChange={(event) =>
                update({ eftposEnvironment: event.target.value as 'dev' | 'prod' })
              }
            >
              <option value="prod">Production (live payments)</option>
              <option value="dev">Development (test mode)</option>
            </select>
          </Field>

          <Field label="Business name" hint="Must match exactly what was used when pairing">
            <input
              className={inputClass}
              value={settings.eftposBusinessName}
              onChange={(event) => update({ eftposBusinessName: event.target.value })}
            />
          </Field>

          <Field label="Register name">
            <input
              className={inputClass}
              value={settings.eftposRegisterName}
              onChange={(event) => update({ eftposRegisterName: event.target.value })}
            />
          </Field>

          <Field label="Register ID" hint="Auto-generated. Changing it would require re-pairing.">
            <input className={`${inputClass} font-mono text-sm`} value={settings.eftposRegisterID} readOnly />
          </Field>

          <div className="flex items-center justify-between gap-6">
            <span className="text-lg text-ink-800">Print the terminal receipt on the ticket</span>
            <Toggle
              value={settings.eftposPrintReceipt}
              onChange={(next) => update({ eftposPrintReceipt: next })}
            />
          </div>

          <Field label="Pair terminal" hint="Start pairing on the PAX terminal, then enter its code">
            <div className="flex gap-3">
              <input
                className={`${inputClass} text-center font-mono tracking-widest`}
                value={pairingCode}
                maxLength={12}
                placeholder="Pairing code"
                onChange={(event) => {
                  setPairingCode(event.target.value);
                  setPairingStatus('idle');
                }}
              />
              <button
                type="button"
                onClick={pair}
                disabled={pairingStatus === 'pairing' || !pairingCode.trim()}
                className="btn-primary shrink-0 px-10 text-lg"
                style={{ minHeight: '64px' }}
              >
                {pairingStatus === 'pairing' ? 'Pairing…' : 'Pair'}
              </button>
            </div>
          </Field>
          {pairingStatus === 'success' && (
            <p className="text-base font-semibold text-success">Terminal paired successfully.</p>
          )}
          {pairingStatus === 'error' && <p className="text-base text-danger">{pairingError}</p>}
        </Section>

        <Section title="Screen & behaviour" icon={Monitor}>
          <div className="flex items-center justify-between gap-6">
            <span className="text-lg text-ink-800">Kiosk mode (fullscreen, no window chrome)</span>
            <Toggle value={settings.kioskMode} onChange={(next) => update({ kioskMode: next })} />
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-lg text-ink-800">Ask Eat In / Take Away</span>
            <Toggle
              value={settings.orderTypePrompt}
              onChange={(next) => update({ orderTypePrompt: next })}
            />
          </div>

          <Field label="Inactivity timeout (seconds)" hint="How long before an abandoned order is cleared">
            <input
              type="number"
              min={20}
              className={inputClass}
              value={settings.attractTimeoutSeconds}
              onChange={(event) => update({ attractTimeoutSeconds: Number(event.target.value) })}
            />
          </Field>

          <Field label="Admin PIN">
            <input
              className={inputClass}
              value={settings.adminPin}
              onChange={(event) => update({ adminPin: event.target.value })}
            />
          </Field>
        </Section>

        <Section title="Software updates" icon={Download}>
          <p className="text-lg text-ink-700">
            {updateState.status === 'idle' && 'Up to date.'}
            {updateState.status === 'checking' && 'Checking for updates…'}
            {updateState.status === 'downloading' &&
              `Downloading ${updateState.version || ''} — ${Math.round(updateState.percent || 0)}%`}
            {updateState.status === 'ready' &&
              `Version ${updateState.version} is ready. It installs automatically once the kiosk is idle.`}
            {updateState.status === 'error' && `Update problem: ${updateState.error}`}
          </p>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => window.kioskAPI.updates.check()}
              className="btn-secondary flex-1 text-lg"
            >
              <RefreshCw className="h-6 w-6" aria-hidden="true" />
              Check now
            </button>
            {updateState.status === 'ready' && (
              <button
                type="button"
                onClick={() => window.kioskAPI.updates.installNow()}
                className="btn-primary flex-1 text-lg"
              >
                Install and restart
              </button>
            )}
          </div>
        </Section>

        <div className="flex gap-4 pt-2">
          <button type="button" onClick={save} className="btn-primary flex-1 text-lg">
            {saved ? 'Saved' : 'Save settings'}
          </button>
          <button
            type="button"
            onClick={() => window.kioskAPI.quit()}
            className="btn-secondary px-10 text-lg text-danger"
          >
            <LogOut className="h-6 w-6" aria-hidden="true" />
            Exit app
          </button>
        </div>
      </div>
    </div>
  );
}
