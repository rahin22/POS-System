# KebabPOS Android (Sunmi T2s)

This is the Android version of KebabPOS, specifically designed for the Sunmi T2s POS device.

## Prerequisites

1. **Android Studio** (for building the APK)
2. **Node.js 18+**
3. **Java JDK 17** (for Android builds)

## Setup

### 1. Install Dependencies

```bash
cd apps/android
npm install
```

### 2. Add Capacitor Android Platform

```bash
npx cap add android
```

### 3. Build the Web App

```bash
npm run build
```

### 4. Sync with Android

```bash
npx cap sync android
```

### 5. Open in Android Studio

```bash
npx cap open android
```

## Building the APK

### Debug APK

In Android Studio:
1. Build → Build Bundle(s) / APK(s) → Build APK(s)
2. APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Release APK

1. Create a keystore (first time only):
```bash
keytool -genkey -v -keystore kebabpos.keystore -alias kebabpos -keyalg RSA -keysize 2048 -validity 10000
```

2. Build signed APK via Android Studio:
   - Build → Generate Signed Bundle / APK
   - Select APK
   - Choose your keystore

## Sunmi Printer Integration

The Sunmi T2s has a built-in thermal printer. To fully integrate it, you need to add the Sunmi Printer SDK:

### Add Sunmi SDK

1. Download the Sunmi SDK from [Sunmi Developer Portal](https://developer.sunmi.com/)
2. Add the AAR to `android/app/libs/`
3. Update `android/app/build.gradle`:
```gradle
dependencies {
    implementation files('libs/sunmi-printer-sdk.aar')
}
```

### Create Native Bridge (Capacitor Plugin)

The `src/lib/sunmi-printer.ts` file expects a native bridge. You'll need to create a Capacitor plugin:

1. Create `android/app/src/main/java/com/kebabpos/terminal/SunmiPrinterPlugin.java`
2. Register it in `MainActivity.java`

For development without the Sunmi device, printing is simulated in web mode.

## Environment Variables

Copy the `.env` file and set your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Development

### Live Reload on Device

1. Find your dev machine IP address
2. Update `capacitor.config.ts`:
```typescript
server: {
  url: 'http://YOUR_IP:5173',
  cleartext: true
}
```

3. Run the dev server:
```bash
npm run dev
```

4. Run on device:
```bash
npx cap run android
```

## Project Structure

```
apps/android/
├── android/              # Native Android project (generated)
├── src/
│   ├── components/       # React components
│   ├── context/          # React context providers
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and platform abstractions
│   │   ├── capacitor.ts  # Capacitor initialization
│   │   ├── platform.ts   # Platform abstraction layer
│   │   ├── supabase.ts   # Supabase client
│   │   └── sunmi-printer.ts  # Sunmi printer interface
│   ├── styles/           # CSS styles
│   └── assets/           # Images, fonts, etc.
├── capacitor.config.ts   # Capacitor configuration
└── package.json
```

## Key Differences from Electron Version

| Feature | Electron (Linux) | Capacitor (Android) |
|---------|------------------|---------------------|
| Printing | ESC/POS via USB | Sunmi Print SDK |
| Storage | electron-store | Capacitor Preferences |
| Updates | electron-updater | Manual APK / Play Store |
| VFD Display | USB Serial | Not supported |

## Troubleshooting

### "Could not find method implementation()"
Make sure you're using Gradle 7+ and have the correct `build.gradle` syntax.

### Printer not working
1. Verify you're running on a real Sunmi device
2. Check the Sunmi SDK is properly integrated
3. Test with `adb logcat` to see any errors

### Network issues
On Android 9+, cleartext HTTP is blocked by default. Use HTTPS for your API, or add network security config for development.
