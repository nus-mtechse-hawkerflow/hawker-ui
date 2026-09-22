import { StallSettings } from './settings.model';
import { Category, MenuItem } from './menu.model';
import { Order } from './order.model';

export interface StallAccount {
  id: string; // e.g. "stall-ah-huat", "stall-uncle-lim", "stall-1"
  numericId?: number; // Backend stall ID (e.g. 1, 2, 3)
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
  stallName: string;
  hawkerCentreName: string;
  unitNumber: string;
  stallDescription?: string;
  uenNumber?: string;
  contactNumber?: string;
  ownerName: string;
  email: string;
  password?: string;
  emoji?: string;
  cuisineCategory?: string;
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
  f_stall_owner_id: number;
  f_stall_owner_name: string;
  f_stall_owner_phone: string;
  f_stall_id: number;
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
    name: string;
    phone: string;
  };
}

