# EFTPOS Integration — SmartConnect (Shift4 / Smartpay)

## What Was Added

The terminal app now integrates with Smartpay's **SmartConnect** cloud platform to send card payments directly to the PAX A920 Pro EFTPOS terminal. When a cashier selects "Card" and taps "Complete Order", the total is automatically pushed to the terminal — the cashier doesn't need to manually key in the amount.

### Files Changed

| File | Change |
|---|---|
| `src/main/eftpos.ts` | New SmartConnect service module (pair, purchase, polling) |
| `src/main/index.ts` | Register ID generation, IPC handlers, EFTPOS receipt printing |
| `src/main/preload.ts` | Exposes EFTPOS API to renderer |
| `src/renderer/types/electron.d.ts` | TypeScript types for new API |
| `src/renderer/components/SettingsPage.tsx` | EFTPOS settings section + pairing UI |
| `src/renderer/components/CheckoutScreen.tsx` | EFTPOS waiting overlay + transaction flow |
| `src/renderer/components/POSLayout.tsx` | Passes EFTPOS receipt data to printer |

---

## Before You Start

Contact **Smartpay AU** and request:
- Access to **SmartConnect** integration for your PAX A920 Pro
- Confirmation of whether your terminal account supports SmartConnect (as opposed to the older SmartLink Lite)

No API key is required — authentication works through the pairing process itself.

---

## Setup Steps

### 1. Enable EFTPOS in Settings

Open the terminal app → **Settings** → scroll to **EFTPOS Terminal**.

| Field | What to enter |
|---|---|
| Enable EFTPOS Integration | Toggle ON |
| Environment | **Production** for live payments, **Development** for testing |
| Business Name | Must match your Smartpay merchant account name exactly |
| Register Name | A label shown on the terminal screen (e.g. "Main Register") |

Click **Save Settings**.

> **Register ID** is auto-generated on first launch and never changes. If it changes, you will need to re-pair. Note it down for support purposes.

---

### 2. Pair the Terminal

Pairing links this POS register to your PAX A920 Pro. Only needs to be done once (or after a terminal swap).

**On the PAX A920:**
1. Open the Smartpay / SmartConnect app on the terminal
2. Navigate to **Settings → Pair with POS** (exact menu varies by terminal firmware)
3. A short pairing code will appear on screen — it expires after a minute or two

**In the POS app:**
1. Go to **Settings → EFTPOS Terminal → Pair Terminal**
2. Type the code shown on the terminal
3. Tap **Pair**
4. A "Terminal paired successfully!" message confirms it worked

> If you get an error, check that Business Name in Settings exactly matches your Smartpay account, and that the pairing code hasn't expired (re-initiate on the terminal if so).

---

### 3. Test a Transaction

Use the **Development** environment setting for testing — this uses `api-dev.smart-connect.cloud` which does not process real money.

1. Add items to the cart and tap **Checkout**
2. Select **Card** as the payment method
3. Tap **Complete Order & Print Receipt**
4. A blue overlay appears: "Tap or insert card on the terminal"
5. Complete the payment on the PAX A920
6. On approval — the order is submitted and the receipt prints automatically

Switch back to **Production** environment before going live.

---

## Checkout Flow (Card Payments)

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

**Split payments** are supported — only the card portion is sent to the EFTPOS terminal; the cash portion is recorded as usual.

---

## Receipt

The terminal generates its own EFTPOS receipt block (transaction reference, card type, auth code, masked card number etc.). This is appended to the printed customer receipt automatically — **this is a card scheme regulatory requirement** and must remain on the receipt.

The PAX A920's own receipt printer should be turned off in Smartpay settings to avoid printing a duplicate receipt on the terminal.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This register is not paired to a device" | Terminal not paired or Register ID changed | Re-pair via Settings |
| Pairing code error | Code expired or Business Name mismatch | Re-initiate pairing on terminal; check Business Name |
| "Terminal is offline" | PAX A920 has no internet | Check terminal's mobile/WiFi connection |
| Overlay stuck on "Taking longer than usual" | Terminal lost connectivity mid-transaction | Check terminal, wait or cancel on terminal |
| Card charge on wrong amount | Split payment: card amount entered incorrectly | Verify card amount field before completing order |
| No EFTPOS block on receipt | `eftposEnabled` was off during that transaction | Enable in Settings before next transaction |

---

## Architecture Notes

- **No LAN dependency** — the POS communicates with SmartConnect's cloud (`api.smart-connect.cloud`), which routes to the terminal. The POS and terminal do not need to be on the same network.
- **No SDK or native dependencies** — integration is pure HTTPS REST (`fetch`). Nothing extra to install.
- **Polling** — after initiating a transaction, the POS polls the `PollingUrl` every 2 seconds until the terminal responds (max 3 minutes).
- **Register ID** — stored in `electron-store` and generated once via `crypto.randomUUID()`. Survives app updates. A reinstall will regenerate it and require re-pairing.
- **EFTPOS disabled = no change to existing flow** — toggling off in Settings reverts the checkout to its previous behaviour.
