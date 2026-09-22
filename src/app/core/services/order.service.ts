import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DiningOption, Order, OrderItem, OrderStatus, PaymentMethod, SelectedModifier, BackendStallOrderDto, BackendOrderSubmissionPayload } from '../models/order.model';
import { MenuItem } from '../models/menu.model';
import { AudioService } from './audio.service';
import { SettingsService } from './settings.service';
import { AuthService } from './auth.service';
import { OrderApiService } from './order-api.service';

@Injectable({
  providedIn: 'root'
})
export class OrderService {
  private audioService = inject(AudioService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private orderApiService = inject(OrderApiService);

  // Cart State
  readonly cartItems = signal<OrderItem[]>(this.loadCart());
  readonly diningOption = signal<DiningOption>('dine_in');
  readonly tableOrBuzzerNumber = signal<string>('');
  readonly orderNotes = signal<string>('');

  // Orders State
  readonly orders = signal<Order[]>(this.loadOrders());
  readonly lastBumpedOrder = signal<Order | null>(null);
  readonly isSyncingOrders = signal<boolean>(false);
  readonly lastNotificationMessage = signal<string | null>(null);

  // Cart Computations
  readonly cartSubtotal = computed(() => {
    return this.cartItems().reduce((sum, item) => sum + item.totalPrice, 0);
  });

  readonly cartTakeawayFee = computed(() => {
    const settings = this.settingsService.settings();
    if (this.diningOption() === 'takeaway' && settings.enableTakeawayFee && this.cartItems().length > 0) {
      return settings.takeawayFeeAmount;
    }
    return 0;
  });

  readonly cartTax = computed(() => {
    const settings = this.settingsService.settings();
    if (settings.enableGst) {
      return (this.cartSubtotal() + this.cartTakeawayFee()) * settings.gstRate;
    }
    return 0;
  });

  readonly cartTotal = computed(() => {
    return Number((this.cartSubtotal() + this.cartTakeawayFee() + this.cartTax()).toFixed(2));
  });

  readonly cartItemCount = computed(() => {
    return this.cartItems().reduce((count, item) => count + item.quantity, 0);
  });

  // Orders Computations
  readonly activeOrders = computed(() => {
    return this.orders()
      .filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'ready')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  });

  readonly kdsPendingOrders = computed(() => {
    return this.orders().filter(o => o.status === 'pending');
  });

  readonly kdsPreparingOrders = computed(() => {
    return this.orders().filter(o => o.status === 'preparing');
  });

  readonly kdsReadyOrders = computed(() => {
    return this.orders().filter(o => o.status === 'ready');
  });

  readonly completedOrders = computed(() => {
    return this.orders()
      .filter(o => o.status === 'completed')
      .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime());
  });

  constructor() {
    // When stall changes, reload that stall's orders and cart + sync from backend 8082
    effect(() => {
      const stall = this.authService.currentStall();
      if (stall) {
        this.orders.set(this.loadOrders());
        this.cartItems.set(this.loadCart());
        this.lastBumpedOrder.set(null);
        this.syncBackendOrders(stall.numericId || 1).catch(err => {
          console.warn('Background backend order sync note:', err);
        });
      }
    });

    effect(() => {
      const stall = this.authService.currentStall();
      if (!stall) return;

      const ordersKey = `hawkerflow_orders_${stall.id}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(ordersKey, JSON.stringify(this.orders()));
        }
      } catch (e) {
        // fallback
      }
    });

    effect(() => {
      const stall = this.authService.currentStall();
      if (!stall) return;

      const cartKey = `hawkerflow_cart_${stall.id}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(cartKey, JSON.stringify(this.cartItems()));
        }
      } catch (e) {
        // fallback
      }
    });
  }

  /**
   * Fetch orders from backend 8082 for active stall
   */
  async syncBackendOrders(stallIdParam?: number): Promise<void> {
    const stall = this.authService.currentStall();
    const stallId = stallIdParam || stall?.numericId || 1;

    this.isSyncingOrders.set(true);
    try {
      const res = await this.orderApiService.getStallOrders(stallId);
      if (res && res.orders && Array.isArray(res.orders)) {
        const mappedBackendOrders = res.orders.map(dto => this.mapBackendOrderToOrder(dto, stall));
        
        // Merge with existing local orders by id / backendOrderId
        this.orders.update(existing => {
          const merged = [...mappedBackendOrders];
          for (const localOrd of existing) {
            if (!merged.some(m => m.id === localOrd.id || (m.backendOrderId && m.backendOrderId === localOrd.backendOrderId))) {
              merged.push(localOrd);
            }
          }
          return merged;
        });
      }
    } catch (err: any) {
      console.warn(`Could not sync orders from backend 8082 for stall ${stallId}:`, err);
    } finally {
      this.isSyncingOrders.set(false);
    }
  }

  private mapBackendOrderToOrder(dto: BackendStallOrderDto, stall: any): Order {
    const statusLower = (dto.status || '').toLowerCase();
    let status: OrderStatus = 'pending';
    if (statusLower === 'cooking' || statusLower === 'preparing') {
      status = 'preparing';
    } else if (statusLower === 'ready') {
      status = 'ready';
    } else if (statusLower === 'completed' || statusLower === 'collected') {
      status = 'completed';
    } else if (statusLower === 'cancelled') {
      status = 'cancelled';
    }

    const stallMenu = stall?.initialMenuItems || [];
    const items: OrderItem[] = (dto.items || []).map((it, idx) => {
      const matchItem = stallMenu.find((m: MenuItem) => m.dishId === it.dish_id);
      return {
        id: `backend-item-${dto.order_id}-${it.dish_id}-${idx}`,
        menuItemId: matchItem ? matchItem.id : `dish-${it.dish_id}`,
        dishId: it.dish_id,
        name: matchItem ? matchItem.name : `Specialty Dish #${it.dish_id}`,
        chineseName: matchItem?.chineseName,
        basePrice: it.price || 5.0,
        quantity: it.quantity || 1,
        selectedModifiers: [],
        unitPriceWithModifiers: it.price || 5.0,
        totalPrice: Number(((it.price || 5.0) * (it.quantity || 1)).toFixed(2))
      };
    });

    return {
      id: `ord-backend-${dto.order_id}`,
      backendOrderId: dto.order_id,
      backendStallOrderId: dto.stall_order_id,
      stallId: dto.stall_id,
      orderNumber: `HF-${String(dto.order_id).padStart(3, '0')}`,
      dailySequence: dto.order_id,
      diningOption: 'dine_in',
      tableOrBuzzerNumber: `Order #${dto.order_id}`,
      items: items.length > 0 ? items : [
        {
          id: `item-${dto.order_id}-1`,
          menuItemId: 'dish-1',
          name: stall?.stallName ? `${stall.stallName} Order Item` : 'Hawker Dish',
          basePrice: dto.subtotal || 5.0,
          quantity: 1,
          selectedModifiers: [],
          unitPriceWithModifiers: dto.subtotal || 5.0,
          totalPrice: dto.subtotal || 5.0
        }
      ],
      subtotal: dto.subtotal || 0,
      takeawayFee: 0,
      tax: 0,
      discount: 0,
      total: dto.subtotal || 0,
      paymentMethod: 'paynow',
      paymentStatus: 'paid',
      status: status,
      createdAt: dto.created_at || new Date().toISOString()
    };
  }


  private loadOrders(): Order[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_orders_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return stall.initialOrders || [];
  }

  private loadCart(): OrderItem[] {
    const stall = this.authService.currentStall();
    if (!stall) return [];

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem(`hawkerflow_cart_${stall.id}`);
        if (stored) return JSON.parse(stored);
      }
    } catch (e) {
      // fallback
    }

    return [];
  }

  // Cart Operations
  addToCart(
    item: MenuItem,
    selectedModifiers: SelectedModifier[],
    quantity = 1,
    specialNotes = ''
  ): void {
    const modifierSum = selectedModifiers.reduce((acc, m) => acc + m.priceDelta, 0);
    const unitPrice = item.basePrice + modifierSum;
    const modifierKey = selectedModifiers.map(m => m.optionId).sort().join('_') + '_' + (specialNotes || '');

    const existingIndex = this.cartItems().findIndex(cartItem => {
      const cartModKey = cartItem.selectedModifiers.map(m => m.optionId).sort().join('_') + '_' + (cartItem.specialNotes || '');
      return cartItem.menuItemId === item.id && cartModKey === modifierKey;
    });

    if (existingIndex > -1) {
      this.cartItems.update(items => {
        const copy = [...items];
        const updated = { ...copy[existingIndex] };
        updated.quantity += quantity;
        updated.totalPrice = Number((updated.quantity * updated.unitPriceWithModifiers).toFixed(2));
        copy[existingIndex] = updated;
        return copy;
      });
    } else {
      const newItem: OrderItem = {
        id: 'cart-item-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        menuItemId: item.id,
        name: item.name,
        chineseName: item.chineseName,
        basePrice: item.basePrice,
        quantity,
        selectedModifiers,
        unitPriceWithModifiers: unitPrice,
        totalPrice: Number((unitPrice * quantity).toFixed(2)),
        specialNotes
      };
      this.cartItems.update(items => [...items, newItem]);
    }
    this.audioService.playButtonTap();
  }

  updateQuantity(cartItemId: string, delta: number): void {
    this.cartItems.update(items => {
      return items
        .map(item => {
          if (item.id === cartItemId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              totalPrice: Number((newQty * item.unitPriceWithModifiers).toFixed(2))
            };
          }
          return item;
        })
        .filter((item): item is OrderItem => item !== null);
    });
  }

  removeCartItem(cartItemId: string): void {
    this.cartItems.update(items => items.filter(item => item.id !== cartItemId));
    this.audioService.playButtonTap();
  }

  clearCart(): void {
    this.cartItems.set([]);
    this.tableOrBuzzerNumber.set('');
    this.orderNotes.set('');
  }

  setDiningOption(option: DiningOption): void {
    this.diningOption.set(option);
  }

  setTableOrBuzzerNumber(value: string): void {
    this.tableOrBuzzerNumber.set(value);
  }

  setOrderNotes(notes: string): void {
    this.orderNotes.set(notes);
  }

  // Order Submission & KDS Flow
  submitOrder(paymentMethod: PaymentMethod, cashTendered?: number, paynowRef?: string): Order {
    const currentOrders = this.orders();
    const nextSeq = currentOrders.length + 1;
    const orderNum = `HF-${String(nextSeq).padStart(3, '0')}`;

    const subtotal = this.cartSubtotal();
    const takeawayFee = this.cartTakeawayFee();
    const tax = this.cartTax();
    const total = this.cartTotal();

    let cashChange: number | undefined = undefined;
    if (paymentMethod === 'cash' && cashTendered) {
      cashChange = Math.max(0, Number((cashTendered - total).toFixed(2)));
    }

    const currentStall = this.authService.currentStall();
    const stallNumericId = currentStall?.numericId || 1;

    const newOrder: Order = {
      id: 'ord-' + Date.now(),
      stallId: stallNumericId,
      orderNumber: orderNum,
      dailySequence: nextSeq,
      diningOption: this.diningOption(),
      tableOrBuzzerNumber: this.tableOrBuzzerNumber() || (this.diningOption() === 'dine_in' ? 'Table Walk-in' : 'Takeaway Counter'),
      items: [...this.cartItems()],
      subtotal,
      takeawayFee,
      tax,
      discount: 0,
      total,
      paymentMethod,
      paymentStatus: 'paid',
      cashTendered,
      cashChange,
      paynowRef: paynowRef || (paymentMethod === 'paynow' ? 'PN-' + Math.floor(10000000 + Math.random() * 90000000) : undefined),
      status: 'pending',
      createdAt: new Date().toISOString(),
      orderNotes: this.orderNotes()
    };

    this.orders.update(list => [newOrder, ...list]);
    this.clearCart();

    // Async submit to Backend Order Service (Port 8082)
    const backendPayload: BackendOrderSubmissionPayload = {
      orders: [
        {
          stall_id: stallNumericId,
          dishes: newOrder.items.map((item, idx) => ({
            dish_id: item.dishId || (idx + 1),
            quantity: item.quantity,
            price: item.unitPriceWithModifiers
          }))
        }
      ],
      total_price: newOrder.total
    };

    this.orderApiService.submitOrder(backendPayload).then(res => {
      console.log('Order submitted to backend 8082 successfully:', res);
      this.lastNotificationMessage.set(`Order ${orderNum} registered on HawkerFlow Backend (Port 8082)`);
      setTimeout(() => this.lastNotificationMessage.set(null), 4000);
    }).catch(err => {
      console.warn('Backend order submission note:', err);
    });

    // Audio & Feedback
    this.audioService.playCheckoutSuccess();
    setTimeout(() => {
      this.audioService.playNewOrderAlert();
    }, 500);

    return newOrder;
  }

  /**
   * Update order status locally and notify customer via Backend Service (Port 8082)
   */
  updateOrderStatus(orderId: string, newStatus: OrderStatus, customMessage?: string): void {
    const now = new Date().toISOString();
    let targetOrder: Order | undefined;

    this.orders.update(list =>
      list.map(order => {
        if (order.id !== orderId) return order;
        targetOrder = order;
        const updated = { ...order, status: newStatus };
        if (newStatus === 'preparing' && !order.startedPrepAt) {
          updated.startedPrepAt = now;
        } else if (newStatus === 'ready' && !order.readyAt) {
          updated.readyAt = now;
        } else if (newStatus === 'completed' && !order.completedAt) {
          updated.completedAt = now;
          this.lastBumpedOrder.set(order);
        }
        return updated;
      })
    );

    // Backend 8082 Status Sync & Customer Notification
    if (targetOrder) {
      const backendOrderId = targetOrder.backendOrderId || parseInt(targetOrder.orderNumber.replace(/[^0-9]/g, ''), 10) || 1;
      const stallId = targetOrder.stallId || this.authService.currentStall()?.numericId || 1;

      let backendStatus = 'PENDING';
      if (newStatus === 'preparing') backendStatus = 'PREPARING';
      else if (newStatus === 'ready') backendStatus = 'READY';
      else if (newStatus === 'completed') backendStatus = 'COMPLETED';
      else if (newStatus === 'cancelled') backendStatus = 'CANCELLED';

      // 1. PATCH stall order status on Backend 8082
      this.orderApiService.updateStallOrderStatus(stallId, backendOrderId, backendStatus).then(res => {
        console.log(`Backend 8082 stall order status updated for #${backendOrderId}:`, res);
      }).catch(err => {
        console.warn(`Stall order status patch warning:`, err);
      });

      // 2. PUT general order status to update customer on Backend 8082
      this.orderApiService.updateOrderStatus(backendOrderId, backendStatus).then(res => {
        console.log(`Backend 8082 customer order update:`, res);
      }).catch(err => {
        console.warn(`Customer order update warning:`, err);
      });

      // 3. User feedback toast
      const statusLabel = backendStatus;
      const feedback = customMessage || `Order ${targetOrder.orderNumber} updated to ${statusLabel} • Customer notified!`;
      this.lastNotificationMessage.set(feedback);
      setTimeout(() => {
        if (this.lastNotificationMessage() === feedback) {
          this.lastNotificationMessage.set(null);
        }
      }, 4000);
    }

    if (newStatus === 'completed') {
      this.audioService.playTicketBumped();
    } else {
      this.audioService.playButtonTap();
    }
  }

  recallLastBumpedOrder(): void {
    const last = this.lastBumpedOrder();
    if (!last) return;

    this.updateOrderStatus(last.id, 'ready', `Order ${last.orderNumber} recalled to READY`);
    this.lastBumpedOrder.set(null);
    this.audioService.playButtonTap();
  }

  cancelOrder(orderId: string, reason: string): void {
    const target = this.orders().find(o => o.id === orderId);
    this.orders.update(list =>
      list.map(order =>
        order.id === orderId
          ? { ...order, status: 'cancelled', paymentStatus: 'refunded', cancelledReason: reason }
          : order
      )
    );

    if (target) {
      const backendOrderId = target.backendOrderId || parseInt(target.orderNumber.replace(/[^0-9]/g, ''), 10) || 1;
      const stallId = target.stallId || this.authService.currentStall()?.numericId || 1;
      this.orderApiService.updateStallOrderStatus(stallId, backendOrderId, 'CANCELLED').catch(e => console.warn(e));
      this.orderApiService.updateOrderStatus(backendOrderId, 'CANCELLED').catch(e => console.warn(e));
      this.lastNotificationMessage.set(`Order ${target.orderNumber} cancelled • Customer notified of refund/cancellation.`);
      setTimeout(() => this.lastNotificationMessage.set(null), 4000);
    }

    this.audioService.playButtonTap();
  }

  resetOrders(): void {
    const stall = this.authService.currentStall();
    this.orders.set(stall ? (stall.initialOrders || []) : []);
    this.lastBumpedOrder.set(null);
  }
}

