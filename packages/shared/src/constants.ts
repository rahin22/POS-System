// ============================================
// Constants for Kebab POS System
// ============================================

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'completed',
  'cancelled',
] as const;

export const ORDER_TYPES = [
  'dine-in',
  'takeaway',
  'delivery',
  'online',
] as const;

export const PAYMENT_METHODS = [
  'cash',
  'card',
  'online',
] as const;

export const PAYMENT_STATUSES = [
  'pending',
  'paid',
  'refunded',
  'failed',
] as const;

export const USER_ROLES = [
  'admin',
  'manager',
  'staff',
] as const;

export const DEFAULT_SETTINGS = {
  shopName: 'Kebab Shop',
  address: '',
  phone: '',
  vatRate: 20,
  currency: 'GBP',
  currencySymbol: '£',
  receiptFooter: 'Thank you for your order!',
};

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/api/auth/login',
  LOGOUT: '/api/auth/logout',
  ME: '/api/auth/me',
  
  // Products
  PRODUCTS: '/api/products',
  PRODUCT: (id: string) => `/api/products/${id}`,
  
  // Categories
  CATEGORIES: '/api/categories',
  CATEGORY: (id: string) => `/api/categories/${id}`,
  
  // Orders
  ORDERS: '/api/orders',
  ORDER: (id: string) => `/api/orders/${id}`,
  ORDER_STATUS: (id: string) => `/api/orders/${id}/status`,
  
  // Users
  USERS: '/api/users',
  USER: (id: string) => `/api/users/${id}`,
  
  // Settings
  SETTINGS: '/api/settings',
  
  // Printing
  PRINT_RECEIPT: '/api/print/receipt',
  PRINTER_STATUS: '/api/print/status',
  
  // Reports
  REPORTS_DAILY: '/api/reports/daily',
  REPORTS_SALES: '/api/reports/sales',
};
