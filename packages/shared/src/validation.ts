import { z } from 'zod';

// ============================================
// Zod Validation Schemas
// ============================================

// ---------- Category Schemas ----------
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// ---------- Product Schemas ----------
export const createProductSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  price: z.number().min(0, 'Price must be positive'),
  pricePerKg: z.number().min(0).optional().nullable(), // Optional price per kilogram for weight-based sales
  categoryId: z.string().min(1, 'Category is required'),
  image: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  isAvailable: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).optional().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().min(0).optional(),
  pricePerKg: z.number().min(0).optional().nullable(), // Optional price per kilogram for weight-based sales
  categoryId: z.string().optional(),
  image: z.string().url().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  isAvailable: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ---------- Order Schemas ----------
export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
  notes: z.string().max(200).optional(),
  modifierIds: z.array(z.string()).optional(),
});

export const createOrderSchema = z.object({
  type: z.enum(['dine-in', 'takeaway', 'delivery', 'online']),
  items: z.array(orderItemSchema).min(1, 'Order must have at least one item'),
  customerName: z.string().max(100).optional(),
  customerPhone: z.string().max(20).optional(),
  customerEmail: z.string().email().optional(),
  notes: z.string().max(500).optional(),
  discount: z.object({
    type: z.enum(['percentage', 'fixed', 'coupon']),
    value: z.number().min(0),
    amount: z.number().min(0),
    code: z.string().optional(),
  }).optional(),
});

export const updateOrderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled']).optional(),
  paymentMethod: z.enum(['cash', 'card', 'online']).optional(),
  paymentStatus: z.enum(['pending', 'paid', 'refunded', 'failed']).optional(),
  notes: z.string().max(500).optional(),
});

// ---------- User Schemas ----------
export const createUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['admin', 'manager', 'staff']),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

// ---------- Settings Schema ----------
export const settingsSchema = z.object({
  shopName: z.string().min(1).max(100),
  address: z.string().max(500).nullable().transform(val => val || ''),
  phone: z.string().max(20).nullable().transform(val => val || ''),
  email: z.string().email().or(z.literal('')).nullable().transform(val => val || ''),
  vatNumber: z.string().max(50).nullable().transform(val => val || ''),
  vatRate: z.number().min(0).max(100),
  currency: z.string().length(3),
  currencySymbol: z.string().max(5),
  receiptFooter: z.string().max(200).nullable().transform(val => val || ''),
  logoUrl: z.string().url().nullable().or(z.literal('')).or(z.literal(null)).transform(val => val || null),
});

// ---------- Print Schema ----------
export const printReceiptSchema = z.object({
  orderId: z.string().min(1),
  printType: z.enum(['customer', 'kitchen', 'both']),
});
