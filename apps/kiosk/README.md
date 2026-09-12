# Al Taher Self-Service Kiosk

Customer-facing ordering kiosk for the **Sin-M01 15.6" Windows 10 countertop kiosk**, mounted
portrait (1080×1920) with an integrated thermal receipt printer and a paired SmartConnect
(PAX) card terminal beside it.

Orders placed here land in the same backend as the POS, appear in the Orders list tagged
`source: "kiosk"`, and trigger a kitchen docket on the Sunmi POS.

## The flow

```
Attract  →  Eat In / Take Away  →  Menu (one scroll, category dividers)
         →  Item options (when the product has any)  →  Order review + upsell
         →  Card payment on the PAX  →  Order number + printed ticket  →  back to Attract
```

- Card only. The order is created **after** the card is approved, so an unpaid order can never exist.
- If the card is approved but the order or print then fails, the kiosk shows a dead-end
  "payment taken, show staff, ref X" screen. It never offers a retry, which would double-charge.
- Inactivity: a prompt appears after `attractTimeoutSeconds`, with 45s grace, then the order clears.
  It is suppressed during payment.

## Running it

```bash
npm run dev          # Vite on :3006 + tsc --watch for the main process
npm start            # Electron against the dev server
npm run build        # main + renderer
npm run package:win  # NSIS installer into release/
```

Opening `http://localhost:3006` in a browser works too: a shim stands in for the Electron
bridge (simulated card payment, no printing) and **order creation is a dry run**, so design
work never writes real orders into the shop's database.

## Staff access

Press and hold the logo on the attract screen for **3 seconds**, then enter the admin PIN
(default `1234`, changeable in settings). The panel covers API URL, printer selection and test
print, EFTPOS pairing, kiosk mode, inactivity timeout, PIN, and update status.

`Ctrl+Shift+K` toggles kiosk mode, `Ctrl+Shift+I` opens devtools.

## Printing

The kiosk printer is an ordinary Windows printer. Receipts are rendered as HTML in an offscreen
window and printed with `silent: true`, so the driver's own paper and cut settings apply. Pick
the printer in the admin panel — on this device it appears as **RECEIPT PRINTER**.

The ticket leads with a 46pt order number, then the items, total (GST shown as an inclusive
component), the card reference and the SmartConnect terminal receipt if enabled.

## Card terminal

Same SmartConnect POS API as the terminal and Android apps, with its **own** Register ID
generated on first run. Pair it from the admin panel: start pairing on the PAX, type the code in,
press Pair. The business name must match exactly what the other registers use.

## OTA updates

`electron-updater` against a **separate** GitHub repo (`rahin22/POS-Kiosk`) so kiosk releases
can never be served to the Linux terminal app or vice versa.

Behaviour on the device:

- Checks 30s after boot, then every 2 hours.
- Downloads automatically in the background.
- **Installs only while the kiosk is idle on the attract screen.** The renderer reports busy/idle
  to the main process, so an update can never restart the app mid-order.

To cut a release:

```bash
# one-time: create the repo and a token with repo scope
setx GH_TOKEN "ghp_..."          # or set it in the shell for this session

npm version patch                 # bump apps/kiosk/package.json
npm run release:win               # builds and publishes the installer + latest.yml
```

Then publish the draft release on GitHub. Kiosks pick it up within 2 hours and install at the
next idle moment.

First install on a new machine is manual: copy `release/AlTaherKiosk-Setup-x.y.z.exe` to the
kiosk and run it. Everything after that is OTA.

> **Building the installer needs symlink permission.** `electron-builder` unpacks its
> code-signing toolchain with symlinks, which Windows refuses unless Developer Mode is on or
> the shell is elevated. Without it the app itself still builds — you get a runnable
> `release/win-unpacked/AlTaherKiosk.exe` — but the NSIS installer step fails, and OTA needs
> the installer. Turn on **Settings → Privacy & security → For developers → Developer Mode**,
> or run `npm run package:win` from an administrator terminal.

## Kiosk-mode housekeeping (do once per device)

1. Install, launch, open the admin panel and set the API URL, printer and EFTPOS pairing.
2. Leave **Kiosk mode** on so the app runs fullscreen with no window chrome.
3. Add the app to `shell:startup` so it comes back after a reboot.
4. Windows: set the power plan to never sleep the display (the app also holds a power-save
   blocker while running), and turn off notifications/Windows Update restart prompts.
