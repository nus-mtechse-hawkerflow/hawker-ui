import { Injectable, signal, computed, effect, inject, DestroyRef } from '@angular/core';
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
  private destroyRef = inject(DestroyRef);

  // Cart State
  readonly cartItems = signal<OrderItem[]>(this.loadCart());
  readonly diningOption = signal<DiningOption>('dine_in');
  readonly tableOrBuzzerNumber = signal<string>('');
  readonly orderNotes = signal<string>('');

  // Orders State
  readonly orders = signal<Order[]>(this.loadOrders());
  readonly lastBumpedOrder = signal<Order | null>(null);
  readonly isSyncingOrders = signal<boolean>(false);
  readonly isPollingPendingOrders = signal<boolean>(false);
  readonly lastNotificationMessage = signal<string | null>(null);

  private pollingIntervalTimer: any = null;
  private isPollInProgress = false;

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
    this.destroyRef.onDestroy(() => {
      this.stopPendingOrdersWorker();
    });

    // When stall changes, reload that stall's orders and cart + start background polling worker
    effect(() => {
      const stall = this.authService.currentStall();
      if (stall) {
        this.orders.set(this.loadOrders());
        this.cartItems.set(this.loadCart());
        this.lastBumpedOrder.set(null);
        // Initial sync of all stall orders
        this.syncBackendOrders(stall.numericId || 1).catch(err => {
          console.warn('Initial backend order sync note:', err);
        });
        // Start 5s recurring background worker for /v1/order/stalls/me/orders (pending status)
        this.startPendingOrdersWorker();
      } else {
        this.stopPendingOrdersWorker();
      }
    });
  }

  /**
   * Starts background worker that pings /v1/order/stalls/me/orders every 5s for pending orders.
   */
  startPendingOrdersWorker(): void {
    this.stopPendingOrdersWorker();
    
    // Initial immediate poll
    this.pollPendingOrders();

    if (typeof window !== 'undefined') {
      this.pollingIntervalTimer = setInterval(() => {
        this.pollPendingOrders();
      }, 5000);
    }
  }

  /**
   * Stops background polling worker.
   */
  stopPendingOrdersWorker(): void {
    if (this.pollingIntervalTimer) {
      clearInterval(this.pollingIntervalTimer);
      this.pollingIntervalTimer = null;
    }
    this.isPollingPendingOrders.set(false);
  }

  /**
   * Worker task: pings GET /v1/order/stalls/me/orders with status=pending every 5 seconds.
   */
  async pollPendingOrders(): Promise<void> {
    const stall = this.authService.currentStall();
    if (!stall) {
      this.stopPendingOrdersWorker();
      return;
    }

    if (this.isPollInProgress) return;
    this.isPollInProgress = true;
    this.isPollingPendingOrders.set(true);

    try {
      const res = await this.orderApiService.getMyStallOrders(stall.numericId, 'pending');
      if (res && res.orders && Array.isArray(res.orders)) {
        const mappedPending = res.orders.map(dto => this.mapBackendOrderToOrder(dto, stall));
        
        let newPendingCount = 0;

        this.orders.update(existing => {
          const map = new Map<string | number, Order>();
          for (const ord of existing) {
            map.set(ord.backendOrderId || ord.id, ord);
          }

          for (const pendingOrd of mappedPending) {
            const key = pendingOrd.backendOrderId || pendingOrd.id;
            const existingOrd = map.get(key);

            if (!existingOrd) {
              newPendingCount++;
              map.set(key, pendingOrd);
            } else {
              // Update details while keeping current status progression if bumped locally
              map.set(key, { ...existingOrd, ...pendingOrd });
            }
          }

          return Array.from(map.values());
        });

        if (newPendingCount > 0) {
          this.audioService.playNewOrderAlert();
          this.lastNotificationMessage.set(
            newPendingCount === 1 ? 'New customer pending order received!' : `${newPendingCount} new pending orders received!`
          );
        }
      }
    } catch (err: any) {
      // Graceful error capture for background polling
      console.debug('Background worker pending orders ping (/v1/order/stalls/me/orders) status:', err?.message || err);
    } finally {
      this.isPollInProgress = false;
      this.isPollingPendingOrders.set(false);
    }
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
      tableOrBuzzerNumber: dto.order_id ? `#${dto.order_id}` : '',
      items: items,
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
    return stall.initialOrders || [];
  }

  private loadCart(): OrderItem[] {
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
  async submitOrder(paymentMethod: PaymentMethod, cashTendered?: number, paynowRef?: string): Promise<Order> {
    const items = [...this.cartItems()];
    const diningOption = this.diningOption();
    const tableOrBuzzerNumber = this.tableOrBuzzerNumber() || (diningOption === 'dine_in' ? 'Table Walk-in' : 'Takeaway Counter');
    const orderNotes = this.orderNotes();
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

    const backendPayload: BackendOrderSubmissionPayload = {
      orders: [
        {
          stall_id: stallNumericId,
          dishes: items.map((item, idx) => ({
            dish_id: item.dishId || (idx + 1),
            quantity: item.quantity,
            price: item.unitPriceWithModifiers
          }))
        }
      ],
      total_price: total
    };

    let backendOrderId: number | undefined = undefined;
    let backendStallOrderId: number | undefined = undefined;

    try {
      const res = await this.orderApiService.submitOrder(backendPayload);
      console.log('Order submitted to backend 8082 successfully:', res);
      
      backendOrderId = res?.order_id ?? res?.id ?? res?.data?.order_id ?? res?.orders?.[0]?.order_id ?? (typeof res === 'number' ? res : undefined);
      backendStallOrderId = res?.stall_order_id ?? res?.data?.stall_order_id ?? res?.orders?.[0]?.stall_order_id ?? backendOrderId;
    } catch (err: any) {
      console.warn('Backend order submission note:', err);
    }

    const finalOrderId = backendOrderId ? `ord-backend-${backendOrderId}` : `ord-local-${Date.now()}`;
    const orderNum = backendOrderId ? `HF-${String(backendOrderId).padStart(3, '0')}` : `HF-${Date.now().toString().slice(-4)}`;
    const dailySeq = backendOrderId || (this.orders().length + 1);

    const newOrder: Order = {
      id: finalOrderId,
      backendOrderId: backendOrderId,
      backendStallOrderId: backendStallOrderId,
      stallId: stallNumericId,
      orderNumber: orderNum,
      dailySequence: dailySeq,
      diningOption,
      tableOrBuzzerNumber,
      items,
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
      orderNotes
    };

    this.orders.update(list => {
      const filtered = list.filter(o => {
        if (backendOrderId && o.backendOrderId === backendOrderId) return false;
        if (o.id === finalOrderId) return false;
        return true;
      });
      return [newOrder, ...filtered];
    });

    this.clearCart();

    if (backendOrderId) {
      this.lastNotificationMessage.set(`Order ${orderNum} created (Backend ID: ${backendOrderId})`);
      setTimeout(() => this.lastNotificationMessage.set(null), 4000);
    }

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

