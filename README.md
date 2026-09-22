# Kebab Shop POS System

A complete Point of Sale system for kebab shops, featuring:

- **Customer Website** - Online ordering for customers
- **POS Terminal** - Electron-based checkout for staff (Ubuntu/Windows/Mac)
- **Admin Portal** - Web-based management dashboard

## Tech Stack

- **Backend**: Node.js, Express, Prisma, PostgreSQL
- **POS Terminal**: Electron, React, Vite, Tailwind CSS
- **Admin Portal**: React, Vite, Tailwind CSS
- **Customer Site**: React, Vite, Tailwind CSS
- **Shared**: TypeScript types, Zod validation

## Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- npm 9+

## Quick Start

### 1. Install Dependencies

```bash
# From the project root
npm install
```

### 2. Set Up PostgreSQL Database

Create a PostgreSQL database:

```sql
CREATE DATABASE kebab_pos;
```

### 3. Configure Environment

Copy the example environment file:

```bash
cp apps/backend/.env.example apps/backend/.env
```

Edit `apps/backend/.env` with your database credentials:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/kebab_pos"
JWT_SECRET="your-super-secret-jwt-key-change-this"
PORT=3001

# Printer Configuration
PRINTER_TYPE=none  # Options: usb, network, none
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
```

### 4. Initialize Database

```bash
# Generate Prisma client and run migrations
npm run db:generate -w apps/backend
npm run db:push -w apps/backend

# Seed with sample data
npm run db:seed -w apps/backend
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1 - Backend API (port 3001)
npm run dev -w apps/backend

# Terminal 2 - Admin Portal (port 3002)
npm run dev -w apps/admin

# Terminal 3 - Customer Website (port 3003)
npm run dev -w apps/customer

# Terminal 4 - POS Terminal (Electron app)
npm run dev -w apps/terminal
```

## Default Login Credentials

After seeding, use these accounts:

| Role  | Email                  | Password   |
|-------|------------------------|------------|
| Admin | admin@kebabshop.com    | admin123   |
| Staff | staff@kebabshop.com    | staff123   |

## Project Structure

```
pos-system/
├── apps/
│   ├── backend/          # Express API server
│   │   ├── prisma/       # Database schema
│   │   └── src/
│   │       ├── routes/   # API endpoints
│   │       ├── services/ # Business logic (printing)
│   │       └── middleware/
│   │
│   ├── terminal/         # Electron POS app
│   │   └── src/
│   │       ├── main/     # Electron main process
│   │       └── renderer/ # React UI
│   │
│   ├── admin/            # Admin dashboard
│   │   └── src/
│   │       ├── pages/    # Route components
│   │       ├── components/
│   │       └── context/
│   │
│   └── customer/         # Customer ordering site
│       └── src/
│           └── components/
│
└── packages/
    └── shared/           # Shared types & validation
        └── src/
```

## Shipping updates to the Android POS

The Sunmi runs a web bundle inside a native shell, and the two travel separately.

**Over the air** - anything under `apps/android/src`. Bump the version in
`apps/android/package.json`, then:

```bash
npm run release:android
```

That builds the bundle, zips it, and uploads it with a manifest to the public
`app-bundles` Supabase Storage bucket. Tills pick it up on their next launch, via
`POST /api/app/updates`. Nothing needs to be installed by hand.

**Needs a new APK** - anything under `apps/android/android`: `SunmiPrinterPlugin`,
`MainActivity`, adding or upgrading a Capacitor plugin, `capacitor.config.ts`,
permissions, the icon, or a Capacitor version bump.

If a release depends on new native code, publish it with a floor so it is held back
from devices still on the older APK:

```bash
npm run release:android -- --min-native 1.0.5
```

Keep `versionName` in `apps/android/android/app/build.gradle` in step with
`apps/android/package.json`, since that is the version devices report and what
`--min-native` is compared against.

### Safety

A bundle that fails to start is reverted automatically. The updater waits for
`notifyAppReady()` - called from `App.tsx` once the session has resolved and a real
screen has rendered - and rolls back to the previous bundle if it never arrives. The
release script refuses to publish a build in which that call is missing.

To roll back by hand, set `"disabled": true` on
`app-bundles/com.kebabpos.terminal/production.json`, or re-run the release from the
previous commit. Manifests are cached for 60s.

First-time setup is in `SETUP-APP-BUNDLES-BUCKET.sql`.

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List all products
- `POST /api/products` - Create product (admin)
- `PUT /api/products/:id` - Update product (admin)
- `DELETE /api/products/:id` - Delete product (admin)

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category (admin)
- `PUT /api/categories/:id` - Update category (admin)
- `DELETE /api/categories/:id` - Delete category (admin)

### App updates
- `POST /api/app/updates` - Live-update check for the Capacitor apps (public)

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `PUT /api/orders/:id` - Update order status
- `GET /api/orders/:id` - Get order details

### Settings
- `GET /api/settings` - Get all settings
- `PUT /api/settings` - Update settings (admin)

### Printing
- `POST /api/print/receipt` - Print receipt
- `POST /api/print/test` - Test printer

## Printer Setup

### USB Printer (Recommended for Ubuntu eposNow)

1. Connect your thermal printer via USB
2. Set environment:
   ```env
   PRINTER_TYPE=usb
   ```
3. On Ubuntu, you may need to add udev rules:
   ```bash
   sudo usermod -a -G lp $USER
   ```

### Network Printer

1. Connect printer to your network
2. Set environment:
   ```env
   PRINTER_TYPE=network
   PRINTER_IP=192.168.1.100
   PRINTER_PORT=9100
   ```

## Building for Production

### Backend
```bash
npm run build -w apps/backend
npm start -w apps/backend
```

### Admin Portal
```bash
npm run build -w apps/admin
# Serve dist/ folder with any static server
```

### Customer Website
```bash
npm run build -w apps/customer
# Serve dist/ folder with any static server
```

### POS Terminal (Electron)
```bash
npm run build -w apps/terminal
# Creates distributable in apps/terminal/dist/
```

## Development Notes

### Adding New Products

1. Go to Admin Portal → Products
2. Click "Add Product"
3. Fill in details and assign to a category
4. Product appears immediately in POS and customer site

### Order Flow

1. **Customer/Staff** creates order → Status: `pending`
2. **Staff** confirms order → Status: `confirmed`
3. **Kitchen** prepares → Status: `preparing`
4. **Ready for pickup** → Status: `ready`
5. **Customer collects** → Status: `completed`

### Receipt Printing

Receipts are printed via ESC/POS commands directly to the thermal printer. The backend handles all printing - no browser print dialogs involved.

## Troubleshooting

### "Cannot connect to database"
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env
- Verify database exists

### "Printer not working"
- Check PRINTER_TYPE is set correctly
- For USB: verify printer is connected and user has permissions
- For Network: verify IP address and port
- Use "Test Print" in admin settings to diagnose

### "CORS errors"
- Ensure backend is running on port 3001
- Check API_URL in frontend apps

## License

Private - All rights reserved
