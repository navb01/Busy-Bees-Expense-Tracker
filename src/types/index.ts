export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  date: string; // ISO format: 'YYYY-MM-DD'
  note: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  name: string;
  age: string;
  occupation: string;
  city: string;
}

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'AED';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
}

export type WeekStartDay = 'Monday' | 'Sunday';
export type AppearanceMode = 'Light' | 'Dark' | 'System';

export interface AppSettings {
  currency: CurrencyCode;
  weekStartsOn: WeekStartDay;
  appearance: AppearanceMode;
  appLock: boolean;
  pinCode: string;
  inactivityReminder: boolean;
  lastActiveTimestamp: number;
  notificationsEnabled: boolean;
}

export type ScreenType =
  | 'dashboard'
  | 'add-income'
  | 'add-expense'
  | 'edit-transaction'
  | 'settings'
  | 'export'
  | 'about'
  | 'profile'
  | 'exit';

export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: 'INR', symbol: '₹', name: 'INR (₹)' },
  USD: { code: 'USD', symbol: '$', name: 'USD ($)' },
  EUR: { code: 'EUR', symbol: '€', name: 'EUR (€)' },
  GBP: { code: 'GBP', symbol: '£', name: 'GBP (£)' },
  JPY: { code: 'JPY', symbol: '¥', name: 'JPY (¥)' },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'CAD ($)' },
  AUD: { code: 'AUD', symbol: 'AU$', name: 'AUD ($)' },
  AED: { code: 'AED', symbol: 'AED', name: 'AED (AED)' },
};

export const INCOME_CATEGORIES = [
  'Salary',
  'Rentals',
  'Freelance',
  'Investments',
  'Gift',
  'Refund',
  'Business',
  'Other',
];

export const EXPENSE_CATEGORIES = [
  'Food & groceries',
  'Shopping',
  'Transport',
  'Bills & utilities',
  'Entertainment',
  'Health & medical',
  'Education',
  'Housing & rent',
  'Personal care',
  'Travel',
  'Other',
];
