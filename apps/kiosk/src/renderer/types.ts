export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  pricePerKg?: number | null;
  image?: string;
  imageUrl?: string;
  categoryId: string;
  isAvailable: boolean;
  sortOrder: number;
  modifierGroups?: ModifierGroup[];
}

export interface CartLine {
  /** Unique per cart line, not per product: the same product can be added twice with different options */
  lineId: string;
  product: Product;
  quantity: number;
  modifiers: Modifier[];
  /** product price + modifiers, for one unit */
  unitPrice: number;
}

export interface ShopSettings {
  shopName: string;
  address: string;
  phone: string;
  vatNumber?: string;
  vatRate: number;
  currencySymbol: string;
  receiptFooter?: string;
}

export type OrderType = 'dine-in' | 'takeaway';

/**
 * How the menu is browsed.
 * 'cards'  - a grid of category cards, each opening a sheet of its products
 * 'scroll' - one continuous menu with category divider headings
 */
export type MenuLayout = 'cards' | 'scroll';

export interface PlacedOrder {
  id: string;
  orderNumber: number;
  total: number;
  createdAt: string;
}

export interface KioskSettings {
  apiUrl: string;
  kioskMode: boolean;
  printerEnabled: boolean;
  printerName: string;
  paperWidthMm: number;
  receiptCopies: number;
  menuLayout: MenuLayout;
  attractTimeoutSeconds: number;
  adminPin: string;
  orderTypePrompt: boolean;
  eftposEnabled: boolean;
  eftposEnvironment: 'dev' | 'prod';
  eftposRegisterID: string;
  eftposRegisterName: string;
  eftposBusinessName: string;
  eftposPrintReceipt: boolean;
}

export type EftposOutcome =
  | 'Accepted'
  | 'Declined'
  | 'Cancelled'
  | 'DeviceOffline'
  | 'Failed';

export interface EftposResult {
  outcome: EftposOutcome;
  amountTotal?: number;
  authId?: string;
  terminalRef?: string;
  cardPan?: string;
  cardType?: string;
  receipt?: string;
  transactionId?: string;
  error?: string;
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error';
  version?: string;
  percent?: number;
  error?: string;
}

declare global {
  interface Window {
    kioskAPI: {
      getSettings: () => Promise<KioskSettings>;
      setSettings: (settings: Partial<KioskSettings>) => Promise<boolean>;
      getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
      getPrinters: () => Promise<Array<{ name: string; displayName: string; isDefault: boolean }>>;
      printReceipt: (data: any) => Promise<{ success: boolean; error?: string; skipped?: boolean }>;
      printTest: () => Promise<{ success: boolean; error?: string }>;
      eftpos: {
        pair: (pairingCode: string) => Promise<{ success: boolean; error?: string }>;
        purchase: (amountCents: number) => Promise<EftposResult>;
        onDelayed: (callback: () => void) => () => void;
      };
      setBusy: (busy: boolean) => Promise<boolean>;
      quit: () => Promise<boolean>;
      updates: {
        getState: () => Promise<UpdateState>;
        check: () => Promise<{ success: boolean; version?: string; message?: string }>;
        installNow: () => Promise<{ success: boolean; message?: string }>;
        onState: (callback: (state: UpdateState) => void) => () => void;
      };
    };
  }
}
