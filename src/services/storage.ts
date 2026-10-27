import { AppSettings, LocalBackupMetadata, Transaction, UserProfile } from '../types';

const STORAGE_KEYS = {
  VERSION: 'bb_storage_version',
  TRANSACTIONS: 'bb_transactions_v1',
  PROFILE: 'bb_profile_v1',
  SETTINGS: 'bb_settings_v1',
  LAST_ACTIVE: 'bb_last_active_time',
  LAST_NOTIFIED: 'bb_last_notified_time',
  INSTALLED_AT: 'bb_installed_at_v1',
  ONBOARDED: 'bb_onboarded_v1',
  BACKUP_META: 'bb_gdrive_backup_meta_v1',
};

const CURRENT_STORAGE_VERSION = 4;

export const DEFAULT_PROFILE: UserProfile = {
  name: '',
  age: '',
  occupation: '',
  city: '',
};

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'INR',
  weekStartsOn: 'Monday',
  appearance: 'Light',
  appLock: false,
  pinCode: '',
  customPinSet: false,
  biometricEnabled: true,
  inactivityReminder: true,
  lastActiveTimestamp: Date.now(),
  notificationsEnabled: false,
};

export const DEFAULT_BACKUP_META: LocalBackupMetadata = {
  lastBackupTime: null,
  lastBackupSize: null,
  lastBackupTxCount: null,
  googleEmail: '',
  frequency: 'Only when I tap "Back up"',
};

export interface AppBackupSnapshot {
  app: 'busy-bees-expense-tracker';
  schemaVersion: number;
  createdAt: number;
  installedAt: string;
  transactions: Transaction[];
  profile: UserProfile;
  settings: AppSettings;
}

export const getTodayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

class StorageService {
  private initialized = false;

  private init() {
    if (this.initialized) return;
    try {
      const storedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
      if (!storedVersion || Number(storedVersion) < CURRENT_STORAGE_VERSION) {
        // Initialize / reset to a clean, empty state with zero dummy or test values
        localStorage.setItem(STORAGE_KEYS.VERSION, String(CURRENT_STORAGE_VERSION));
        localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(DEFAULT_SETTINGS));
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, String(Date.now()));
        localStorage.setItem(STORAGE_KEYS.INSTALLED_AT, getTodayISO());
        localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'false');
      }
      this.initialized = true;
    } catch (e) {
      console.warn('LocalStorage not accessible or error initializing', e);
    }
  }

  isOnboarded(): boolean {
    this.init();
    try {
      return localStorage.getItem(STORAGE_KEYS.ONBOARDED) === 'true';
    } catch {
      return false;
    }
  }

  setOnboarded(value: boolean): void {
    this.init();
    try {
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, value ? 'true' : 'false');
    } catch {
      // ignore
    }
  }

  /**
   * Returns the starting calendar bound (earliest of installation date or any backdated transaction).
   */
  getInstallDate(): { year: number; month: number; iso: string } {
    this.init();
    const now = new Date();
    try {
      let earliestIso = localStorage.getItem(STORAGE_KEYS.INSTALLED_AT) || getTodayISO();
      if (!localStorage.getItem(STORAGE_KEYS.INSTALLED_AT)) {
        localStorage.setItem(STORAGE_KEYS.INSTALLED_AT, earliestIso);
      }

      const transactions = this.getTransactions();
      for (const tx of transactions) {
        if (tx.date && tx.date < earliestIso) {
          earliestIso = tx.date;
        }
      }

      const d = new Date(earliestIso + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        return {
          year: d.getFullYear(),
          month: d.getMonth(),
          iso: earliestIso,
        };
      }
    } catch {
      // fallback to current date
    }
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      iso: getTodayISO(),
    };
  }

  getTransactions(): Transaction[] {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!data) return [];
      const parsed = JSON.parse(data) as Transaction[];
      return parsed.filter((t) => !t.id.startsWith('tx_seed_'));
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

    try {
      const currentBound = localStorage.getItem(STORAGE_KEYS.INSTALLED_AT) || getTodayISO();
      if (tx.date && tx.date < currentBound) {
        localStorage.setItem(STORAGE_KEYS.INSTALLED_AT, tx.date);
      }
    } catch {
      // ignore
    }

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

    try {
      const currentBound = localStorage.getItem(STORAGE_KEYS.INSTALLED_AT) || getTodayISO();
      if (updatedTx.date && updatedTx.date < currentBound) {
        localStorage.setItem(STORAGE_KEYS.INSTALLED_AT, updatedTx.date);
      }
    } catch {
      // ignore
    }

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
      const parsed = JSON.parse(data) as UserProfile;
      return { ...DEFAULT_PROFILE, ...parsed };
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
      const parsed = JSON.parse(data);
      if (parsed.appearance !== 'Light' && parsed.appearance !== 'Dark') {
        parsed.appearance = 'Light';
      }
      // If legacy default '1234' was stored before user ever created a custom PIN, clear it
      if (!parsed.customPinSet) {
        parsed.pinCode = '';
        parsed.appLock = false;
      }
      return { ...DEFAULT_SETTINGS, ...parsed };
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

  getBackupMeta(): LocalBackupMetadata {
    this.init();
    try {
      const data = localStorage.getItem(STORAGE_KEYS.BACKUP_META);
      if (!data) return DEFAULT_BACKUP_META;
      return { ...DEFAULT_BACKUP_META, ...JSON.parse(data) };
    } catch {
      return DEFAULT_BACKUP_META;
    }
  }

  saveBackupMeta(updates: Partial<LocalBackupMetadata>): LocalBackupMetadata {
    const current = this.getBackupMeta();
    const updated: LocalBackupMetadata = { ...current, ...updates };
    try {
      localStorage.setItem(STORAGE_KEYS.BACKUP_META, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save backup metadata', e);
    }
    return updated;
  }

  getFullBackupSnapshot(): AppBackupSnapshot {
    this.init();
    const installInfo = this.getInstallDate();
    return {
      app: 'busy-bees-expense-tracker',
      schemaVersion: CURRENT_STORAGE_VERSION,
      createdAt: Date.now(),
      installedAt: installInfo.iso,
      transactions: this.getTransactions(),
      profile: this.getProfile(),
      settings: this.getSettings(),
    };
  }

  restoreFullBackupSnapshot(snapshot: AppBackupSnapshot): {
    transactions: Transaction[];
    profile: UserProfile;
    settings: AppSettings;
  } {
    this.init();
    const validTransactions = Array.isArray(snapshot.transactions)
      ? snapshot.transactions.filter((t) => t && typeof t.id === 'string' && !t.id.startsWith('tx_seed_'))
      : [];
    const validProfile: UserProfile = {
      ...DEFAULT_PROFILE,
      ...(snapshot.profile || {}),
    };
    const validSettings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...(snapshot.settings || {}),
      appearance:
        snapshot.settings?.appearance === 'Dark' ? 'Dark' : 'Light',
    };

    this.saveTransactions(validTransactions);
    this.saveProfile(validProfile);
    this.saveSettings(validSettings);

    try {
      let earliestIso = snapshot.installedAt || getTodayISO();
      for (const tx of validTransactions) {
        if (tx.date && tx.date < earliestIso) {
          earliestIso = tx.date;
        }
      }
      localStorage.setItem(STORAGE_KEYS.INSTALLED_AT, earliestIso);
      localStorage.setItem(STORAGE_KEYS.ONBOARDED, 'true');
    } catch {
      // ignore
    }

    return {
      transactions: validTransactions,
      profile: validProfile,
      settings: validSettings,
    };
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
}

export const storage = new StorageService();

