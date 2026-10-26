import { AppSettings, Transaction, UserProfile } from '../types';

const STORAGE_KEYS = {
  VERSION: 'bb_storage_version',
  TRANSACTIONS: 'bb_transactions_v1',
  PROFILE: 'bb_profile_v1',
  SETTINGS: 'bb_settings_v1',
  LAST_ACTIVE: 'bb_last_active_time',
  LAST_NOTIFIED: 'bb_last_notified_time',
};

const CURRENT_STORAGE_VERSION = 1;

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Alex',
  age: '',
  occupation: '',
  city: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'INR',
  weekStartsOn: 'Monday',
  appearance: 'Light',
  appLock: false,
  pinCode: '1234',
  inactivityReminder: true,
  lastActiveTimestamp: Date.now(),
  notificationsEnabled: false,
};

const getTodayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Seed initial transactions that match the Figma screenshots perfectly
const todayDate = getTodayISO();

const SEED_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx_seed_1',
    type: 'income',
    amount: 2450.00,
    category: 'Salary',
    date: todayDate,
    note: 'October salary',
    createdAt: Date.now() - 3600000 * 3,
    updatedAt: Date.now() - 3600000 * 3,
  },
  {
    id: 'tx_seed_2',
    type: 'expense',
    amount: 42.50,
    category: 'Food & groceries',
    date: todayDate,
    note: 'Weekly groceries',
    createdAt: Date.now() - 3600000 * 1,
    updatedAt: Date.now() - 3600000 * 1,
  },
  {
    id: 'tx_seed_3',
    type: 'expense',
    amount: 15.00,
    category: 'Transport',
    date: '2026-10-16',
    note: 'Metro commute',
    createdAt: new Date('2026-10-16T08:15:00Z').getTime(),
    updatedAt: new Date('2026-10-16T08:15:00Z').getTime(),
  },
  {
    id: 'tx_seed_4',
    type: 'expense',
    amount: 35.20,
    category: 'Food & groceries',
    date: '2026-10-15',
    note: 'Farmer market vegetables',
    createdAt: new Date('2026-10-15T14:20:00Z').getTime(),
    updatedAt: new Date('2026-10-15T14:20:00Z').getTime(),
  },
  {
    id: 'tx_seed_5',
    type: 'expense',
    amount: 80.00,
    category: 'Bills & utilities',
    date: '2026-10-12',
    note: 'Home internet fiber plan',
    createdAt: new Date('2026-10-12T10:00:00Z').getTime(),
    updatedAt: new Date('2026-10-12T10:00:00Z').getTime(),
  },
  {
    id: 'tx_seed_6',
    type: 'expense',
    amount: 25.50,
    category: 'Entertainment',
    date: '2026-10-10',
    note: 'Cinema tickets',
    createdAt: new Date('2026-10-10T19:30:00Z').getTime(),
    updatedAt: new Date('2026-10-10T19:30:00Z').getTime(),
  },
  {
    id: 'tx_seed_7',
    type: 'income',
    amount: 450.00,
    category: 'Freelance',
    date: '2026-10-08',
    note: 'Logo design consultation',
    createdAt: new Date('2026-10-08T16:00:00Z').getTime(),
    updatedAt: new Date('2026-10-08T16:00:00Z').getTime(),
  },
  {
    id: 'tx_seed_8',
    type: 'expense',
    amount: 50.00,
    category: 'Shopping',
    date: '2026-10-05',
    note: 'Kitchen organizing bins',
    createdAt: new Date('2026-10-05T13:45:00Z').getTime(),
    updatedAt: new Date('2026-10-05T13:45:00Z').getTime(),
  },
  {
    id: 'tx_seed_9',
    type: 'expense',
    amount: 18.00,
    category: 'Transport',
    date: '2026-10-03',
    note: 'Cab to meeting',
    createdAt: new Date('2026-10-03T09:10:00Z').getTime(),
    updatedAt: new Date('2026-10-03T09:10:00Z').getTime(),
  },
  {
    id: 'tx_seed_10',
    type: 'expense',
    amount: 65.00,
    category: 'Health & medical',
    date: '2026-10-01',
    note: 'Routine vitamins & checkup',
    createdAt: new Date('2026-10-01T11:00:00Z').getTime(),
    updatedAt: new Date('2026-10-01T11:00:00Z').getTime(),
  },
];

class StorageService {
  private initialized = false;

  private init() {
    if (this.initialized) return;
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
      if (!storedVersion) {
        // First boot: set defaults & seed data
        localStorage.setItem(STORAGE_KEYS.VERSION, String(CURRENT_STORAGE_VERSION));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SEED_TRANSACTIONS));
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, String(Date.now()));
      }
      this.initialized = true;
    } catch (e) {
      console.warn('LocalStorage not accessible or error initializing', e);
    }
  }

  getTransactions(): Transaction[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!data) return [];
      return JSON.parse(data) as Transaction[];
    } catch {
      return [];
    }
  }

  saveTransactions(transactions: Transaction[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
      this.recordActivity();
    } catch (e) {
      console.error('Failed to save transactions to localStorage', e);
    }
  }

  addTransaction(tx: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>): Transaction {
    const list = this.getTransactions();
    const newTx: Transaction = {
      ...tx,
      id: 'tx_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [newTx, ...list];
    this.saveTransactions(updated);
    return newTx;
  }

  updateTransaction(id: string, updates: Partial<Omit<Transaction, 'id' | 'createdAt'>>): Transaction | null {
    const list = this.getTransactions();
    const index = list.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTx: Transaction = {
      ...list[index],
      ...updates,
      updatedAt: Date.now(),
    };
    list[index] = updatedTx;
    this.saveTransactions(list);
    return updatedTx;
  }

  deleteTransaction(id: string): boolean {
    const list = this.getTransactions();
    const filtered = list.filter((t) => t.id !== id);
    if (filtered.length !== list.length) {
      this.saveTransactions(filtered);
      return true;
    }
    return false;
  }

  getProfile(): UserProfile {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
      if (!data) return DEFAULT_PROFILE;
      return { ...DEFAULT_PROFILE, ...JSON.parse(data) };
    } catch {
      return DEFAULT_PROFILE;
    }
  }

  saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
      this.recordActivity();
    } catch (e) {
      console.error('Failed to save profile', e);
    }
  }

  getSettings(): AppSettings {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (!data) return DEFAULT_SETTINGS;
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated: AppSettings = { ...current, ...settings };
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
      this.recordActivity();
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    return updated;
  }

  recordActivity(): void {
    try {
      const now = Date.now();
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, String(now));
    } catch {
      // ignore
    }
  }

  getLastActive(): number {
    try {
      const val = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE);
      return val ? parseInt(val, 10) : Date.now();
    } catch {
      return Date.now();
    }
  }

  check24hInactivity(): { isInactive: boolean; hoursInactive: number } {
    const lastActive = this.getLastActive();
    const now = Date.now();
    const diffMs = now - lastActive;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    return {
      isInactive: hours >= 24,
      hoursInactive: hours,
    };
  }

  // Backup & Restore for version control
  exportBackupJSON(): string {
    const data = {
      version: CURRENT_STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      appName: 'Busy Bees Expense Tracker',
      profile: this.getProfile(),
      settings: this.getSettings(),
      transactions: this.getTransactions(),
    };
    return JSON.stringify(data, null, 2);
  }

  importBackupJSON(jsonStr: string): { success: boolean; count?: number; error?: string } {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.transactions || !Array.isArray(data.transactions)) {
        return { success: false, error: 'Invalid backup structure: transactions array missing.' };
      }
      this.saveTransactions(data.transactions);
      if (data.profile) this.saveProfile(data.profile);
      if (data.settings) this.saveSettings(data.settings);
      return { success: true, count: data.transactions.length };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }
}

export const storage = new StorageService();
