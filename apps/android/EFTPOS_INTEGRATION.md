# EFTPOS Integration — SmartConnect (Shift4 / Smartpay) — Android

This is the Android (Capacitor / Sunmi T2s) port of the terminal app's SmartConnect
integration. Behaviour is identical from the cashier's point of view — see
`apps/terminal/EFTPOS_INTEGRATION.md` for the original.

When a cashier selects "Card" and taps "Complete Order", the total is pushed to the
PAX A920 Pro EFTPOS terminal automatically — no manual keying of the amount.

## Files Changed

| File | Change |
|---|---|
| `src/lib/eftpos.ts` | New SmartConnect service module (settings, pair, purchase, polling) |
| `src/lib/platform.ts` | EFTPOS settings on `getSettings()`, `electronAPI.eftpos` compat shim |
| `src/lib/sunmi-printer.ts` | EFTPOS receipt block appended to the customer receipt |
| `src/components/SettingsPage.tsx` | EFTPOS settings section + pairing UI |
| `src/components/CheckoutScreen.tsx` | EFTPOS waiting overlay + transaction flow |
| `src/components/POSLayout.tsx` | Passes EFTPOS receipt data to the printer |

---

## Setup Steps

### 1. Enable EFTPOS in Settings

Open the app → **Settings** → **EFTPOS Terminal**.

| Field | What to enter |
|---|---|
| Enable EFTPOS Integration | Toggle ON |
| Print EFTPOS Receipt Block | ON (leave on unless the PAX prints its own copy) |
| Environment | **Production** for live payments, **Development** for testing |
| Business Name | Must match your Smartpay merchant account name exactly |
| Register Name | A label shown on the terminal screen (e.g. "Main Register") |

Unlike the desktop app there is no **Save Settings** button — each field is saved as
you change it (text fields save when you tap away).

> **Register ID** is auto-generated the first time the Settings page is opened and never
> changes. If it changes you will need to re-pair. Note it down for support purposes.

### 2. Pair the Terminal

**On the PAX A920:** open the Smartpay / SmartConnect app → **Settings → Pair with POS**.
A short pairing code appears; it expires after a minute or two.

**In the POS app:** Settings → EFTPOS Terminal → type the code → tap **Pair**.
"Terminal paired successfully!" confirms it worked.

### 3. Test a Transaction

Set Environment to **Development** (`api-dev.smart-connect.cloud`, no real money), then:
add items → Checkout → **Card** → **Complete Order & Print Receipt** → a blue overlay
appears → complete the payment on the PAX A920 → on approval the order is submitted and
the receipt prints on the Sunmi's built-in printer.

Switch back to **Production** before going live.

---

## Checkout Flow (Card Payments)

Identical to the terminal app:

```
Cashier taps "Complete Order"
        │
        ▼
EFTPOS enabled + card payment?
        │
       YES → Send amount to SmartConnect → PAX A920 prompts customer
        │
        ├── Accepted   → Submit order to backend → Print receipt (includes EFTPOS receipt)
        ├── Declined   → "Card declined. Please try a different payment method."
        ├── Cancelled  → "Payment cancelled on the terminal."
        ├── Offline    → "Terminal is offline. Check its internet connection."
        └── Failed     → Shows error detail, returns to checkout
        │
       NO (EFTPOS disabled or cash only) → Existing flow unchanged
```

**Split payments** are supported — only the card portion goes to the EFTPOS terminal.

---

## Receipt

The PAX generates its own EFTPOS receipt block (transaction reference, card type, auth
code, masked card number etc.). It is appended to the Sunmi-printed customer receipt
after the "Paid by" line — **this is a card scheme regulatory requirement**. Turn it off
only if the PAX is configured to print its own customer copy.

---

## Android-Specific Notes

These are the only real differences from the Electron implementation:

- **HTTP goes through `CapacitorHttp`, not `fetch`.** The service calls
  `CapacitorHttp.request()` on device so requests are issued by Android natively and
  therefore bypass the WebView's CORS checks — SmartConnect does not send CORS headers.
  In web/browser dev mode it falls back to `fetch` (which will hit CORS; use a device or
  emulator for real testing). No extra dependency: `CapacitorHttp` ships in
  `@capacitor/core`, and the native plugin is built into `@capacitor/android`.
- **Settings live in Capacitor Preferences**, not electron-store. Keys are the same
  (`eftposEnabled`, `eftposEnvironment`, `eftposRegisterID`, `eftposRegisterName`,
  `eftposBusinessName`, `eftposPrintReceipt`).
- **Register ID** uses `crypto.randomUUID()` with a `Math.random` fallback, because
  `crypto.randomUUID` is only defined in a secure context and the Vite dev server is
  served over plain HTTP. It survives app updates but **not an uninstall or a "clear app
  data"** — either regenerates it and requires re-pairing.
- **No IPC.** The terminal app sends an `eftpos-delayed` IPC event from the main process;
  here `purchase()` takes an `onDelayed` callback directly.
- **Polling runs in the WebView.** Android throttles timers for backgrounded apps, so
  leave the app in the foreground during a transaction (it is, in normal use — the
  cashier is watching the overlay).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This register is not paired to a device" | Terminal not paired, or app data was cleared / reinstalled | Re-pair via Settings |
| Pairing code error | Code expired or Business Name mismatch | Re-initiate pairing on terminal; check Business Name |
| "Terminal is offline" | PAX A920 has no internet | Check terminal's mobile/WiFi connection |
| Overlay stuck on "Taking longer than usual" | Terminal lost connectivity mid-transaction | Check terminal, wait or cancel on terminal |
| Works on device but fails in browser | CORS — `fetch` fallback used in web mode | Test on the Sunmi device or an emulator |
| No EFTPOS block on receipt | `eftposPrintReceipt` off, or EFTPOS was disabled for that sale | Enable in Settings before next transaction |
