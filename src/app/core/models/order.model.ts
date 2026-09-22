export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'paynow' | 'nets' | 'card';
export type PaymentStatus = 'pending' | 'paid' | 'refunded';
export type DiningOption = 'dine_in' | 'takeaway';

export interface SelectedModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

export interface OrderItem {
  id: string; // unique item instance id in cart
  menuItemId: string;
  dishId?: number; // Backend dish ID
  name: string;
  chineseName?: string;
  basePrice: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  unitPriceWithModifiers: number;
  totalPrice: number;
  specialNotes?: string;
}

export interface Order {
  id: string;
  backendOrderId?: number; // Backend order_id (e.g. 26)
  backendStallOrderId?: number; // Backend stall_order_id (e.g. 26)
  stallId?: number; // Backend stall_id (e.g. 1)
  orderNumber: string; // e.g. "HF-101" or "ORD-26"
  dailySequence: number;
  diningOption: DiningOption;
  tableOrBuzzerNumber?: string;
  items: OrderItem[];
  subtotal: number;
  takeawayFee: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  cashTendered?: number;
  cashChange?: number;
  paynowRef?: string;
  status: OrderStatus;
  createdAt: string; // ISO string
  startedPrepAt?: string;
  readyAt?: string;
  completedAt?: string;
  orderNotes?: string;
  cancelledReason?: string;
}

export interface BackendDishDto {
  dish_id: number;
  quantity: number;
  price: number;
}

export interface BackendOrderGroupDto {
  stall_id: number;
  dishes: BackendDishDto[];
}

export interface BackendOrderSubmissionPayload {
  orders: BackendOrderGroupDto[];
  total_price: number;
}

export interface BackendStallOrderItemDto {
  dish_id: number;
  quantity: number;
  price: number;
}

export interface BackendStallOrderDto {
  stall_order_id: number;
  order_id: number;
  stall_id: number;
  status: string; // PENDING, COOKING, PREPARING, READY, COMPLETED, CANCELLED, COLLECTED
  subtotal: number;
  created_at: string;
  items: BackendStallOrderItemDto[];
}

export interface BackendStallOrdersResponseDto {
  stall_id: number;
  orders: BackendStallOrderDto[];
}

