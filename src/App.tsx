/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { LogOut, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  AppSettings,
  DetectedSmsTransaction,
  ScreenType,
  Transaction,
  TransactionType,
  UserProfile,
} from './types';
import { getTodayISO, storage } from './services/storage';
import { notificationService } from './services/notifications';
import { Header } from './components/Header';
import { Drawer } from './components/Drawer';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { AddTransactionScreen } from './components/screens/AddTransactionScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { BackupRestoreScreen } from './components/screens/BackupRestoreScreen';
import { ExportScreen } from './components/screens/ExportScreen';
import { AboutScreen } from './components/screens/AboutScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { ExitScreen } from './components/screens/ExitScreen';
import { WelcomeScreen } from './components/screens/WelcomeScreen';
import { AppLockModal } from './components/AppLockModal';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { SmsDetectionPopup } from './components/SmsDetectionPopup';
import { SplashScreen } from './components/SplashScreen';
import {
  findCloudBackup,
  getAccessToken,
  hasActiveAccessToken,
  uploadCloudBackup,
} from './services/googleDriveBackup';
import {
  consumeNativeNotificationAction,
  consumeNativePendingSmsTransactions,
  consumeUrlSmsTrigger,
  syncNativeSmsAutoDetectEnabled,
} from './services/smsTransactionParser';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState<boolean>(() => storage.isOnboarded());
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() => storage.getProfile());
  const [settings, setSettings] = useState<AppSettings>(() => storage.getSettings());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [smsPrefillDraft, setSmsPrefillDraft] = useState<{
    type: TransactionType;
    amount: number;
    category: string;
  } | null>(null);
  const [smsQueue, setSmsQueue] = useState<DetectedSmsTransaction[]>(() =>
    storage.getPendingSmsTransactions()
  );
  const [isLocked, setIsLocked] = useState(false);

  // Unified Exit Confirmation Pop-up (#21)
  const [exitModalOpen, setExitModalOpen] = useState(false);

  // Unsaved Transaction Data Loss Warning Pop-up (#22)
  const [unsavedWarningOpen, setUnsavedWarningOpen] = useState(false);

  // Small fading bottom toast message on save (#22)
  const [saveToastText, setSaveToastText] = useState<string | null>(null);
  const [saveToastVisible, setSaveToastVisible] = useState(false);
  const toastFadeTimerRef = useRef<number | null>(null);
  const toastClearTimerRef = useRef<number | null>(null);

  // Keep latest state in a ref for hardware back button listeners
  const stateRef = useRef({
    currentScreen,
    drawerOpen,
    exitModalOpen,
    unsavedWarningOpen,
    isOnboarded,
  });
  useEffect(() => {
    stateRef.current = {
      currentScreen,
      drawerOpen,
      exitModalOpen,
      unsavedWarningOpen,
      isOnboarded,
    };
  }, [currentScreen, drawerOpen, exitModalOpen, unsavedWarningOpen, isOnboarded]);

  const triggerSaveToast = (message: string) => {
    if (toastFadeTimerRef.current) window.clearTimeout(toastFadeTimerRef.current);
    if (toastClearTimerRef.current) window.clearTimeout(toastClearTimerRef.current);

    setSaveToastText(message);
    setSaveToastVisible(true);

    toastFadeTimerRef.current = window.setTimeout(() => {
      setSaveToastVisible(false);
    }, 1800);

    toastClearTimerRef.current = window.setTimeout(() => {
      setSaveToastText(null);
    }, 2300);
  };

  // Optional auto-backup when user has an active session and frequency interval has elapsed
  const maybeRunScheduledAutoBackup = async () => {
    if (!hasActiveAccessToken()) return;
    const meta = storage.getBackupMeta();
    if (meta.frequency === 'Never' || meta.frequency === 'Only when I tap "Back up"') {
      return;
    }

    const now = Date.now();
    const last = meta.lastBackupTime || 0;
    const elapsedMs = now - last;
    const dayMs = 24 * 60 * 60 * 1000;

    const isDue =
      (meta.frequency === 'Daily' && elapsedMs >= dayMs) ||
      (meta.frequency === 'Weekly' && elapsedMs >= 7 * dayMs) ||
      (meta.frequency === 'Monthly' && elapsedMs >= 30 * dayMs);

    if (!isDue) return;

    try {
      const token = await getAccessToken(false);
      const existing = await findCloudBackup(token);
      const snapshot = storage.getFullBackupSnapshot();
      await uploadCloudBackup(token, snapshot, existing?.id, false);
    } catch {
      // silent background check
    }
  };

  // Initialize and check 24h inactivity reminder
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    const loadedTx = storage.getTransactions();
    setTransactions(loadedTx);

    const loadedSettings = storage.getSettings();
    setSettings(loadedSettings);
    syncNativeSmsAutoDetectEnabled(loadedSettings.smsAutoDetectEnabled !== false);
    if (loadedSettings.appLock && loadedSettings.customPinSet && loadedSettings.pinCode) {
      setIsLocked(true);
    }

    const loadedProfile = storage.getProfile();
    setProfile(loadedProfile);
    setIsOnboarded(storage.isOnboarded());

    const executeNotificationAction = (actionObj: {
      action: 'save' | 'edit';
      id: string;
      type: TransactionType;
      amount: number;
    }) => {
      const defaultCategory = actionObj.type === 'income' ? 'Salary' : 'Shopping';
      if (actionObj.action === 'save') {
        storage.addTransaction({
          type: actionObj.type,
          amount: actionObj.amount,
          category: defaultCategory,
          date: getTodayISO(),
          note: '',
        });
        setTransactions(storage.getTransactions());
        const remaining = storage.removePendingSmsTransaction(actionObj.id);
        setSmsQueue(remaining);
        triggerSaveToast(
          actionObj.type === 'income' ? 'Income saved successfully' : 'Expense saved successfully'
        );
        void maybeRunScheduledAutoBackup();
      } else if (actionObj.action === 'edit') {
        const remaining = storage.removePendingSmsTransaction(actionObj.id);
        setSmsQueue(remaining);
        setEditingTransaction(null);
        setSmsPrefillDraft({
          type: actionObj.type,
          amount: actionObj.amount,
          category: defaultCategory,
        });
        setCurrentScreen(actionObj.type === 'income' ? 'add-income' : 'add-expense');
      }
    };

    // Drain any SMS transactions detected by Android SMS Receiver / NotificationListenerService or iOS URL trigger
    const syncDetectedSms = () => {
      const currentSettings = storage.getSettings();
      if (currentSettings.smsAutoDetectEnabled === false) return;

      const nativeDetected = consumeNativePendingSmsTransactions();
      for (const item of nativeDetected) {
        storage.enqueueDetectedSmsTransaction(item);
      }

      const urlTriggered = consumeUrlSmsTrigger();
      if (urlTriggered) {
        storage.enqueueDetectedSmsTransaction(urlTriggered);
      }

      setSmsQueue(storage.getPendingSmsTransactions());

      const notifAction = consumeNativeNotificationAction();
      if (notifAction) {
        executeNotificationAction(notifAction);
      }
    };

    syncDetectedSms();

    const handleLiveNativeSmsEvent = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        id?: string;
        type?: TransactionType;
        amount?: number;
        detectedAt?: number;
        dismissedId?: string;
      }>;
      const detail = customEvt.detail;
      if (detail?.dismissedId) {
        const remaining = storage.removePendingSmsTransaction(detail.dismissedId);
        setSmsQueue(remaining);
        return;
      }
      if (
        detail &&
        (detail.type === 'income' || detail.type === 'expense') &&
        typeof detail.amount === 'number' &&
        detail.amount > 0
      ) {
        const updatedQueue = storage.enqueueDetectedSmsTransaction({
          id: detail.id,
          type: detail.type,
          amount: detail.amount,
          detectedAt: detail.detectedAt,
        });
        setSmsQueue(updatedQueue);
      } else {
        syncDetectedSms();
      }
    };

    const handleLiveNotifAction = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        action?: 'save' | 'edit';
        id?: string;
        type?: TransactionType;
        amount?: number;
      }>;
      const d = customEvt.detail;
      if (
        d &&
        (d.action === 'save' || d.action === 'edit') &&
        (d.type === 'income' || d.type === 'expense') &&
        typeof d.amount === 'number' &&
        d.amount > 0
      ) {
        executeNotificationAction({
          action: d.action,
          id: String(d.id || ''),
          type: d.type,
          amount: d.amount,
        });
      }
    };

    notificationService.checkAndTrigger24hReminder();
    storage.recordActivity();

    const handleFocus = () => {
      notificationService.checkAndTrigger24hReminder();
      storage.recordActivity();
      syncDetectedSms();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    window.addEventListener('bb-sms-detected', handleLiveNativeSmsEvent);
    window.addEventListener('bb-sms-notif-action', handleLiveNotifAction);
    const interval = setInterval(() => {
      notificationService.checkAndTrigger24hReminder();
    }, 60 * 60 * 1000);

    return () => {
      clearTimeout(splashTimer);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.removeEventListener('bb-sms-detected', handleLiveNativeSmsEvent);
      window.removeEventListener('bb-sms-notif-action', handleLiveNotifAction);
      clearInterval(interval);
    };
  }, []);

  // Intercept Android hardware/gesture Back button & browser popstate (#21 & #22)
  useEffect(() => {
    // Push a guard state so browser/WebView back navigation stays inside the app
    try {
      window.history.pushState({ bbGuard: true }, '');
    } catch {
      // ignore
    }

    const handleHardwareBack = () => {
      const {
        currentScreen: screen,
        drawerOpen: isDrawerOpen,
        exitModalOpen: isExitOpen,
        unsavedWarningOpen: isUnsavedOpen,
        isOnboarded: onboarded,
      } = stateRef.current;

      if (!onboarded) {
        setExitModalOpen(true);
        return;
      }

      if (isDrawerOpen) {
        setDrawerOpen(false);
        return;
      }

      if (isUnsavedOpen) {
        setUnsavedWarningOpen(false);
        return;
      }

      if (isExitOpen) {
        setExitModalOpen(false);
        return;
      }

      // If entering a transaction, raise pop-up warning regarding loss of entered data (#22)
      if (screen === 'add-income' || screen === 'add-expense') {
        setUnsavedWarningOpen(true);
        return;
      }

      // Pressing phone Back button triggers the same pop-up as clicking on Exit (#21)
      setExitModalOpen(true);
    };

    const handlePopState = () => {
      try {
        window.history.pushState({ bbGuard: true }, '');
      } catch {
        // ignore
      }
      handleHardwareBack();
    };

    window.addEventListener('bb-back-button', handleHardwareBack);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('bb-back-button', handleHardwareBack);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Update theme appearance class on root html & body
  useEffect(() => {
    const isDark = settings.appearance === 'Dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);

    const win = window as unknown as {
      BusyBeesNative?: { setDarkMode?: (isDark: boolean) => void };
    };
    win.BusyBeesNative?.setDarkMode?.(isDark);
  }, [settings.appearance]);

  const handleNavigate = (screen: ScreenType) => {
    if (screen === 'exit') {
      setExitModalOpen(true);
      return;
    }
    if (screen !== 'edit-transaction') {
      setEditingTransaction(null);
    }
    setSmsPrefillDraft(null);
    setCurrentScreen(screen);
    storage.recordActivity();
  };

  // Top-left Header Back button handler
  const handleBack = () => {
    if (currentScreen === 'add-income' || currentScreen === 'add-expense') {
      setUnsavedWarningOpen(true);
      return;
    }
    setCurrentScreen('dashboard');
    setEditingTransaction(null);
    setSmsPrefillDraft(null);
    storage.recordActivity();
  };

  const handleConfirmDiscardTransaction = () => {
    setUnsavedWarningOpen(false);
    setEditingTransaction(null);
    setSmsPrefillDraft(null);
    setCurrentScreen('dashboard');
    storage.recordActivity();
  };

  const handleSaveTransaction = (txData: {
    type: TransactionType;
    amount: number;
    category: string;
    date: string;
    note: string;
  }) => {
    const isUpdating = Boolean(editingTransaction);
    if (editingTransaction) {
      storage.updateTransaction(editingTransaction.id, txData);
    } else {
      storage.addTransaction(txData);
    }
    setTransactions(storage.getTransactions());
    setEditingTransaction(null);
    setSmsPrefillDraft(null);
    setCurrentScreen('dashboard');

    // Trigger small fading bottom message (#22)
    if (isUpdating) {
      triggerSaveToast(
        txData.type === 'income' ? 'Income updated successfully' : 'Expense updated successfully'
      );
    } else {
      triggerSaveToast(
        txData.type === 'income' ? 'Income saved successfully' : 'Expense saved successfully'
      );
    }

    void maybeRunScheduledAutoBackup();
  };

  const handleSaveSmsAsIs = (
    itemId: string,
    txData: {
      type: TransactionType;
      amount: number;
      category: string;
      date: string;
      note: string;
    }
  ) => {
    storage.addTransaction(txData);
    setTransactions(storage.getTransactions());
    const remaining = storage.removePendingSmsTransaction(itemId);
    setSmsQueue(remaining);

    triggerSaveToast(
      txData.type === 'income' ? 'Income saved successfully' : 'Expense saved successfully'
    );

    void maybeRunScheduledAutoBackup();
  };

  const handleEditSmsDetected = (
    itemId: string,
    draft: {
      type: TransactionType;
      amount: number;
      category: string;
    }
  ) => {
    const remaining = storage.removePendingSmsTransaction(itemId);
    setSmsQueue(remaining);
    setEditingTransaction(null);
    setSmsPrefillDraft(draft);
    setCurrentScreen(draft.type === 'income' ? 'add-income' : 'add-expense');
  };

  const handleDismissSmsDetected = (itemId: string) => {
    const remaining = storage.removePendingSmsTransaction(itemId);
    setSmsQueue(remaining);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setSmsPrefillDraft(null);
    setEditingTransaction(tx);
    setCurrentScreen(tx.type === 'income' ? 'add-income' : 'add-expense');
  };

  const handleDeleteTransaction = (id: string) => {
    storage.deleteTransaction(id);
    setTransactions(storage.getTransactions());
  };

  const handleUpdateSettings = (updates: Partial<AppSettings>) => {
    const updated = storage.saveSettings(updates);
    setSettings(updated);
  };

  const handleSaveProfile = (newProfile: UserProfile) => {
    storage.saveProfile(newProfile);
    setProfile(newProfile);
  };

  const handleCompleteWelcome = (newProfile: UserProfile) => {
    storage.saveProfile(newProfile);
    storage.setOnboarded(true);
    setProfile(newProfile);
    setIsOnboarded(true);
  };

  const handleCloudRestored = (restored: {
    transactions: Transaction[];
    profile: UserProfile;
    settings: AppSettings;
  }) => {
    setTransactions(restored.transactions);
    setProfile(restored.profile);
    setSettings(restored.settings);
    setIsOnboarded(true);
    triggerSaveToast('Restored from Google Drive');
  };

  const executeNativeExit = () => {
    storage.recordActivity();
    if (settings.appLock) {
      setIsLocked(true);
    }
    setExitModalOpen(false);

    const win = window as unknown as {
      BusyBeesNative?: { exitApp?: () => void };
      Capacitor?: { Plugins?: { App?: { exitApp?: () => void } } };
    };
    if (win.BusyBeesNative?.exitApp) {
      win.BusyBeesNative.exitApp();
      return;
    }

    if (win.Capacitor?.Plugins?.App?.exitApp) {
      win.Capacitor.Plugins.App.exitApp();
      return;
    }

    const nav = navigator as unknown as { app?: { exitApp?: () => void } };
    if (nav.app?.exitApp) {
      nav.app.exitApp();
      return;
    }

    try {
      window.close();
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={`min-h-screen flex justify-center items-start sm:py-6 selection:bg-blue-100 selection:text-blue-900 ${
        settings.appearance === 'Dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Mobile viewport frame */}
      <div className="w-full max-w-md min-h-screen sm:min-h-[844px] sm:max-h-[920px] bg-slate-50 dark:bg-slate-900 flex flex-col shadow-2xl sm:rounded-[36px] overflow-hidden border border-slate-200/80 dark:border-slate-800 relative transition-colors duration-200">
        {/* Loading Splash Screen */}
        {isLoading && <SplashScreen />}

        {/* First-Time User Welcome Screen (#18) */}
        {!isLoading && !isOnboarded ? (
          <WelcomeScreen
            initialProfile={profile}
            onComplete={handleCompleteWelcome}
            onRestoredFromCloud={handleCloudRestored}
          />
        ) : (
          <>
            {/* Global In-app notification toast */}
            <InAppNotificationBanner
              onOpenAddExpense={() => handleNavigate('add-expense')}
            />

            {/* Top Header */}
            <Header
              currentScreen={currentScreen}
              onBack={handleBack}
              onOpenDrawer={() => setDrawerOpen(true)}
              onOpenProfile={() => handleNavigate('profile')}
              profile={profile}
            />

            {/* Main Screen Content */}
            <main className="flex-1 flex flex-col overflow-y-auto">
              {currentScreen === 'dashboard' && (
                <DashboardScreen
                  transactions={transactions}
                  settings={settings}
                  onNavigateIncome={() => handleNavigate('add-income')}
                  onNavigateExpense={() => handleNavigate('add-expense')}
                  onEditTransaction={handleEditTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                />
              )}

              {currentScreen === 'add-income' && (
                <AddTransactionScreen
                  type="income"
                  transactions={transactions}
                  editingTransaction={editingTransaction}
                  prefillDraft={smsPrefillDraft?.type === 'income' ? smsPrefillDraft : null}
                  settings={settings}
                  onSave={handleSaveTransaction}
                  onCancel={handleBack}
                />
              )}

              {currentScreen === 'add-expense' && (
                <AddTransactionScreen
                  type="expense"
                  transactions={transactions}
                  editingTransaction={editingTransaction}
                  prefillDraft={smsPrefillDraft?.type === 'expense' ? smsPrefillDraft : null}
                  settings={settings}
                  onSave={handleSaveTransaction}
                  onCancel={handleBack}
                />
              )}

              {currentScreen === 'settings' && (
                <SettingsScreen
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onOpenBackup={() => handleNavigate('backup')}
                  onShowToast={triggerSaveToast}
                />
              )}

              {currentScreen === 'backup' && (
                <BackupRestoreScreen
                  transactions={transactions}
                  profile={profile}
                  settings={settings}
                  onRestored={handleCloudRestored}
                  onShowToast={triggerSaveToast}
                />
              )}

              {currentScreen === 'export' && (
                <ExportScreen
                  transactions={transactions}
                  settings={settings}
                />
              )}

              {currentScreen === 'about' && (
                <AboutScreen />
              )}

              {currentScreen === 'profile' && (
                <ProfileScreen
                  profile={profile}
                  onSaveProfile={handleSaveProfile}
                />
              )}

              {currentScreen === 'exit' && (
                <ExitScreen
                  onCancel={handleBack}
                  onConfirmExit={executeNativeExit}
                />
              )}
            </main>

            {/* Navigation Drawer */}
            <Drawer
              isOpen={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              onNavigate={handleNavigate}
              onRequestExit={() => setExitModalOpen(true)}
            />
          </>
        )}

        {/* Small Fading Bottom Message for Saved Income / Expense (#22) */}
        {saveToastText && (
          <div
            className={`fixed bottom-12 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-500 ${
              saveToastVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/90 dark:bg-slate-100/95 text-white dark:text-slate-900 text-xs font-medium shadow-lg backdrop-blur-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
              <span>{saveToastText}</span>
            </div>
          </div>
        )}

        {/* Unsaved Transaction Data Loss Warning Pop-up (#22) */}
        {unsavedWarningOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Discard Unsaved Entry?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Going back now will result in the loss of the transaction details you have entered. Do you want to discard this entry?
              </p>
              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setUnsavedWarningOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Stay
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDiscardTransaction}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition"
                >
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Unified Exit Confirmation Pop-up (#21: triggered by clicking Exit or pressing Phone Back button) */}
        {exitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
              <div className="w-12 h-12 rounded-full bg-blue-50/90 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 text-[#2357A4] dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
                <LogOut className="w-6 h-6 stroke-[1.8]" />
              </div>
              <h3 className="font-brand text-slate-900 dark:text-slate-100 text-lg tracking-wide leading-snug">
                Exit Busy Bees Expense Tracker?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Your saved income and expenses will stay on this device. You can pick up where you left off next time.
              </p>
              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setExitModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={executeNativeExit}
                  className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Truecaller-Style SMS Detected Transaction Popup */}
        {!isLoading &&
          isOnboarded &&
          !isLocked &&
          settings.smsAutoDetectEnabled !== false &&
          smsQueue.length > 0 && (
            <SmsDetectionPopup
              queue={smsQueue}
              transactions={transactions}
              settings={settings}
              onSaveAsIs={handleSaveSmsAsIs}
              onEditItem={handleEditSmsDetected}
              onDismissItem={handleDismissSmsDetected}
            />
          )}

        {/* App Lock PIN & Biometric Modal */}
        <AppLockModal
          isLocked={isLocked}
          onUnlock={() => setIsLocked(false)}
          correctPin={settings.pinCode}
          biometricEnabled={settings.biometricEnabled !== false}
        />
      </div>
    </div>
  );
}
