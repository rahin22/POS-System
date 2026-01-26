export interface Category {
    id: string;
    name: string;
    description?: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateCategoryInput {
    name: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
}
export interface UpdateCategoryInput {
    name?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
}
export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    categoryId: string;
    category?: Category;
    image?: string;
    isAvailable: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateProductInput {
    name: string;
    description?: string;
    price: number;
    categoryId: string;
    image?: string;
    isAvailable?: boolean;
    sortOrder?: number;
}
export interface UpdateProductInput {
    name?: string;
    description?: string;
    price?: number;
    categoryId?: string;
    image?: string;
    isAvailable?: boolean;
    sortOrder?: number;
}
export interface Modifier {
    id: string;
    name: string;
    price: number;
    isAvailable: boolean;
    groupId: string;
    group?: ModifierGroup;
}
export interface ModifierGroup {
    id: string;
    name: string;
    description?: string;
    isRequired: boolean;
    minSelections: number;
    maxSelections: number;
    modifiers: Modifier[];
    productIds: string[];
}
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type OrderType = 'dine-in' | 'takeaway' | 'delivery' | 'online';
export type PaymentMethod = 'cash' | 'card' | 'online';
export type PaymentStatus = 'pending' | 'paid' | 'refunded' | 'failed';
export interface OrderItem {
    id: string;
    orderId: string;
    productId: string;
    product?: Product;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes?: string;
    modifiers?: OrderItemModifier[];
}
export interface OrderItemModifier {
    id: string;
    orderItemId: string;
    modifierId: string;
    modifier?: Modifier;
    name: string;
    price: number;
}
export interface Order {
    id: string;
    orderNumber: number;
    status: OrderStatus;
    type: OrderType;
    items: OrderItem[];
    subtotal: number;
    tax: number;
    total: number;
    paymentMethod?: PaymentMethod;
    paymentStatus: PaymentStatus;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    createdById?: string;
}
export interface CreateOrderInput {
    type: OrderType;
    items: CreateOrderItemInput[];
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
    notes?: string;
}
export interface CreateOrderItemInput {
    productId: string;
    quantity: number;
    notes?: string;
    modifierIds?: string[];
}
export interface UpdateOrderInput {
    status?: OrderStatus;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    notes?: string;
}
export type UserRole = 'admin' | 'manager' | 'staff';
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    role: UserRole;
}
export interface LoginInput {
    email: string;
    password: string;
}
export interface AuthResponse {
    user: User;
    token: string;
}
export interface ShopSettings {
    shopName: string;
    address: string;
    phone: string;
    email?: string;
    vatNumber?: string;
    vatRate: number;
    currency: string;
    currencySymbol: string;
    receiptFooter?: string;
    logoUrl?: string;
}
export interface PrintReceiptRequest {
    orderId: string;
    printType: 'customer' | 'kitchen' | 'both';
}
export interface PrinterStatus {
    connected: boolean;
    name?: string;
    error?: string;
}
export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface PaginatedResponse<T> {
    items: T[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
