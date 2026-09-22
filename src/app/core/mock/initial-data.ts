import { Category, MenuItem } from '../models/menu.model';
import { Order } from '../models/order.model';
import { StallAccount } from '../models/auth.model';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'all', name: 'All Items', chineseName: '全部', icon: 'utensils', displayOrder: 0 },
  { id: 'mains', name: 'Signatures & Mains', chineseName: '招牌主食', icon: 'flame', displayOrder: 1 },
  { id: 'sides', name: 'Sides & Snacks', chineseName: '小吃配菜', icon: 'shopping-bag', displayOrder: 2 },
  { id: 'drinks', name: 'Beverages', chineseName: '饮料', icon: 'coffee', displayOrder: 3 }
];

export const PRESET_STALLS: StallAccount[] = [];
export const INITIAL_CATEGORIES: Category[] = DEFAULT_CATEGORIES;
export const INITIAL_MENU_ITEMS: MenuItem[] = [];
export const INITIAL_ORDERS: Order[] = [];
