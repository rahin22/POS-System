import { z } from 'zod';
export declare const createCategorySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sortOrder: number;
    isActive: boolean;
    description?: string | undefined;
}, {
    name: string;
    description?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const updateCategorySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    sortOrder?: number | undefined;
    isActive?: boolean | undefined;
}>;
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodNumber;
    pricePerKg: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    categoryId: z.ZodString;
    image: z.ZodOptional<z.ZodString>;
    imageUrl: z.ZodOptional<z.ZodString>;
    isAvailable: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    sortOrder: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    sortOrder: number;
    price: number;
    categoryId: string;
    isAvailable: boolean;
    description?: string | undefined;
    pricePerKg?: number | null | undefined;
    image?: string | undefined;
    imageUrl?: string | undefined;
}, {
    name: string;
    price: number;
    categoryId: string;
    description?: string | undefined;
    sortOrder?: number | undefined;
    pricePerKg?: number | null | undefined;
    image?: string | undefined;
    imageUrl?: string | undefined;
    isAvailable?: boolean | undefined;
}>;
export declare const updateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    pricePerKg: z.ZodNullable<z.ZodOptional<z.ZodNumber>>;
    categoryId: z.ZodOptional<z.ZodString>;
    image: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    imageUrl: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    isAvailable: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | undefined;
    sortOrder?: number | undefined;
    price?: number | undefined;
    pricePerKg?: number | null | undefined;
    categoryId?: string | undefined;
    image?: string | null | undefined;
    imageUrl?: string | null | undefined;
    isAvailable?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | undefined;
    sortOrder?: number | undefined;
    price?: number | undefined;
    pricePerKg?: number | null | undefined;
    categoryId?: string | undefined;
    image?: string | null | undefined;
    imageUrl?: string | null | undefined;
    isAvailable?: boolean | undefined;
}>;
export declare const orderItemSchema: z.ZodObject<{
    productId: z.ZodString;
    quantity: z.ZodNumber;
    notes: z.ZodOptional<z.ZodString>;
    modifierIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    productId: string;
    quantity: number;
    notes?: string | undefined;
    modifierIds?: string[] | undefined;
}, {
    productId: string;
    quantity: number;
    notes?: string | undefined;
    modifierIds?: string[] | undefined;
}>;
export declare const createOrderSchema: z.ZodObject<{
    type: z.ZodEnum<["dine-in", "takeaway", "delivery", "online"]>;
    items: z.ZodArray<z.ZodObject<{
        productId: z.ZodString;
        quantity: z.ZodNumber;
        notes: z.ZodOptional<z.ZodString>;
        modifierIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        productId: string;
        quantity: number;
        notes?: string | undefined;
        modifierIds?: string[] | undefined;
    }, {
        productId: string;
        quantity: number;
        notes?: string | undefined;
        modifierIds?: string[] | undefined;
    }>, "many">;
    customerName: z.ZodOptional<z.ZodString>;
    customerPhone: z.ZodOptional<z.ZodString>;
    customerEmail: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    discount: z.ZodOptional<z.ZodObject<{
        type: z.ZodEnum<["percentage", "fixed", "coupon"]>;
        value: z.ZodNumber;
        amount: z.ZodNumber;
        code: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: number;
        type: "percentage" | "fixed" | "coupon";
        amount: number;
        code?: string | undefined;
    }, {
        value: number;
        type: "percentage" | "fixed" | "coupon";
        amount: number;
        code?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    type: "dine-in" | "takeaway" | "delivery" | "online";
    items: {
        productId: string;
        quantity: number;
        notes?: string | undefined;
        modifierIds?: string[] | undefined;
    }[];
    notes?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    discount?: {
        value: number;
        type: "percentage" | "fixed" | "coupon";
        amount: number;
        code?: string | undefined;
    } | undefined;
}, {
    type: "dine-in" | "takeaway" | "delivery" | "online";
    items: {
        productId: string;
        quantity: number;
        notes?: string | undefined;
        modifierIds?: string[] | undefined;
    }[];
    notes?: string | undefined;
    customerName?: string | undefined;
    customerPhone?: string | undefined;
    customerEmail?: string | undefined;
    discount?: {
        value: number;
        type: "percentage" | "fixed" | "coupon";
        amount: number;
        code?: string | undefined;
    } | undefined;
}>;
export declare const updateOrderSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["pending", "confirmed", "preparing", "ready", "completed", "cancelled"]>>;
    paymentMethod: z.ZodOptional<z.ZodEnum<["cash", "card", "online"]>>;
    paymentStatus: z.ZodOptional<z.ZodEnum<["pending", "paid", "refunded", "failed"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" | undefined;
    notes?: string | undefined;
    paymentMethod?: "online" | "cash" | "card" | undefined;
    paymentStatus?: "pending" | "paid" | "refunded" | "failed" | undefined;
}, {
    status?: "pending" | "confirmed" | "preparing" | "ready" | "completed" | "cancelled" | undefined;
    notes?: string | undefined;
    paymentMethod?: "online" | "cash" | "card" | undefined;
    paymentStatus?: "pending" | "paid" | "refunded" | "failed" | undefined;
}>;
export declare const createUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["admin", "manager", "staff"]>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    role: "admin" | "manager" | "staff";
}, {
    name: string;
    email: string;
    password: string;
    role: "admin" | "manager" | "staff";
}>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const settingsSchema: z.ZodObject<{
    shopName: z.ZodString;
    address: z.ZodEffects<z.ZodNullable<z.ZodString>, string, string | null>;
    phone: z.ZodEffects<z.ZodNullable<z.ZodString>, string, string | null>;
    email: z.ZodEffects<z.ZodNullable<z.ZodUnion<[z.ZodString, z.ZodLiteral<"">]>>, string, string | null>;
    vatNumber: z.ZodEffects<z.ZodNullable<z.ZodString>, string, string | null>;
    vatRate: z.ZodNumber;
    currency: z.ZodString;
    currencySymbol: z.ZodString;
    receiptFooter: z.ZodEffects<z.ZodNullable<z.ZodString>, string, string | null>;
    logoUrl: z.ZodEffects<z.ZodUnion<[z.ZodUnion<[z.ZodNullable<z.ZodString>, z.ZodLiteral<"">]>, z.ZodLiteral<null>]>, string | null, string | null>;
}, "strip", z.ZodTypeAny, {
    email: string;
    shopName: string;
    address: string;
    phone: string;
    vatNumber: string;
    vatRate: number;
    currency: string;
    currencySymbol: string;
    receiptFooter: string;
    logoUrl: string | null;
}, {
    email: string | null;
    shopName: string;
    address: string | null;
    phone: string | null;
    vatNumber: string | null;
    vatRate: number;
    currency: string;
    currencySymbol: string;
    receiptFooter: string | null;
    logoUrl: string | null;
}>;
export declare const printReceiptSchema: z.ZodObject<{
    orderId: z.ZodString;
    printType: z.ZodEnum<["customer", "kitchen", "both"]>;
}, "strip", z.ZodTypeAny, {
    orderId: string;
    printType: "customer" | "kitchen" | "both";
}, {
    orderId: string;
    printType: "customer" | "kitchen" | "both";
}>;
