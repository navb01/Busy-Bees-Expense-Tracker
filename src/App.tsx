/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AppSettings, ScreenType, Transaction, TransactionType, UserProfile } from './types';
import { storage } from './services/storage';
import { notificationService } from './services/notifications';
import { Header } from './components/Header';
import { Drawer } from './components/Drawer';
import { DashboardScreen } from './components/screens/DashboardScreen';
import { AddTransactionScreen } from './components/screens/AddTransactionScreen';
import { SettingsScreen } from './components/screens/SettingsScreen';
import { ExportScreen } from './components/screens/ExportScreen';
import { AboutScreen } from './components/screens/AboutScreen';
import { ProfileScreen } from './components/screens/ProfileScreen';
import { ExitScreen } from './components/screens/ExitScreen';
import { AppLockModal } from './components/AppLockModal';
import { InAppNotificationBanner } from './components/InAppNotificationBanner';
import { SplashScreen } from './components/SplashScreen';

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('dashboard');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [profile, setProfile] = useState<UserProfile>(storage.getProfile());
  const [settings, setSettings] = useState<AppSettings>(storage.getSettings());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Initialize and check 24h inactivity reminder
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setIsLoading(false);
    }, 800);

    const loadedTx = storage.getTransactions();
    setTransactions(loadedTx);

    const loadedSettings = storage.getSettings();
    setSettings(loadedSettings);
    if (loadedSettings.appLock) {
      setIsLocked(true);
    }

    const loadedProfile = storage.getProfile();
    setProfile(loadedProfile);

    notificationService.checkAndTrigger24hReminder();
    storage.recordActivity();

    const handleFocus = () => {
      notificationService.checkAndTrigger24hReminder();
      storage.recordActivity();
    };

    window.addEventListener('focus', handleFocus);
    const interval = setInterval(() => {
      notificationService.checkAndTrigger24hReminder();
    }, 60 * 60 * 1000);

    return () => {
      clearTimeout(splashTimer);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  // Update theme appearance class on root html & body
  useEffect(() => {
    const isDark = settings.appearance === 'Dark';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  }, [settings.appearance]);

  const handleNavigate = (screen: ScreenType) => {
    if (screen !== 'edit-transaction') {
      setEditingTransaction(null);
    }
    setCurrentScreen(screen);
    storage.recordActivity();
  };

  const handleBack = () => {
    setCurrentScreen('dashboard');
    setEditingTransaction(null);
    storage.recordActivity();
  };

  const handleSaveTransaction = (txData: {
    type: TransactionType;
    amount: number;
    category: string;
    date: string;
    note: string;
  }) => {
    if (editingTransaction) {
      storage.updateTransaction(editingTransaction.id, txData);
    } else {
      storage.addTransaction(txData);
    }
    setTransactions(storage.getTransactions());
    setEditingTransaction(null);
    setCurrentScreen('dashboard');
  };

  const handleEditTransaction = (tx: Transaction) => {
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

  const handleConfirmExit = () => {
    if (settings.appLock) {
      setIsLocked(true);
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
              settings={settings}
              onSave={handleSaveTransaction}
              onCancel={handleBack}
            />
          )}

          {currentScreen === 'settings' && (
            <SettingsScreen
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
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
              onConfirmExit={handleConfirmExit}
            />
          )}
        </main>

        {/* Navigation Drawer */}
        <Drawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          onNavigate={handleNavigate}
        />

        {/* App Lock PIN Modal */}
        <AppLockModal
          isLocked={isLocked}
          onUnlock={() => setIsLocked(false)}
          correctPin={settings.pinCode}
        />
      </div>
    </div>
  );
}
