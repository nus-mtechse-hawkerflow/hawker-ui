import { StallSettings } from './settings.model';
import { Category, MenuItem } from './menu.model';
import { Order } from './order.model';

export interface StallAccount {
  id: string; // e.g. "stall-ah-huat", "stall-uncle-lim", "stall-1"
  numericId?: number; // Backend stall ID (e.g. 1, 2, 3)
  username?: string;
  stallName: string;
  hawkerCentreName: string;
  unitNumber: string;
  uenNumber: string;
  contactNumber: string;
  ownerName: string;
  email: string;
  password?: string;
  emoji: string;
  cuisineCategory: string;
  cognitoSub?: string;
  isEmailVerified?: boolean;
  settings: StallSettings;
  initialCategories?: Category[];
  initialMenuItems?: MenuItem[];
  initialOrders?: Order[];
}

export interface UserSession {
  stallId: string;
  numericStallId?: number;
  username?: string;
  email: string;
  ownerName: string;
  role: 'owner' | 'cashier' | 'cook';
  loggedInAt: string;
  cognitoSub?: string;
}

export interface HawkerDishFormItem {
  name: string;
  price: number;
  description: string;
}

export interface HawkerRegisterRequest {
  username: string;
  stallName: string;
  hawkerCentreName?: string;
  unitNumber: string;
  stallDescription?: string;
  uenNumber?: string;
  contactNumber?: string;
  ownerName: string;
  email: string;
  password: string;
  emoji?: string;
  cuisineCategory?: string;
  cognitoSub?: string;
  menuItems?: HawkerDishFormItem[];
}

export interface SignUpFlowResult {
  success: boolean;
  isSignUpComplete: boolean;
  nextStep?: string;
  cognitoSub?: string;
  error?: string;
}

export interface BackendStallMenuDto {
  f_menu_id: number;
  f_menu_name: string;
  f_menu_description: string;
  f_menu_price: number;
  f_stall_id: number;
}

export interface BackendStallOwnerDto {
  f_stall_owner_id?: number;
  f_stall_owner_name?: string;
  f_stall_owner_phone?: string;
  f_stall_owner_email?: string;
  f_stall_owner_sub?: string;
  f_stall_id?: number;
  stall_owner_id?: number;
  name?: string;
  phone?: string;
  email?: string;
  stall_owner_sub?: string;
}

export interface BackendStallDto {
  stall_name: string;
  stall_description: string;
  stall_location?: string;
  stall_number?: string;
  stall_menu: BackendStallMenuDto[];
  stall_owner: BackendStallOwnerDto[];
}

export interface BackendHawkerRegisterPayload {
  stall_name: string;
  stall_number: string;
  stall_description: string;
  stall_location: string;
  stall_menu: Array<{
    name: string;
    price: number;
    description: string;
  }>;
  stall_owner: {
    stall_owner_sub: string;
    name: string;
    phone: string;
    email: string;
  };
}

export interface HawkerMeMenuItemDto {
  menu_id: number;
  menu_name: string;
  menu_price: number;
  menu_description: string;
}

export interface HawkerMeStallDto {
  stall_id: number;
  stall_name: string;
  stall_description?: string;
  stall_location?: string;
  stall_number?: string;
  stall_menu: HawkerMeMenuItemDto[];
}

