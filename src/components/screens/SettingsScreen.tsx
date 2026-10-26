import React, { useState } from 'react';
import { ChevronRight, Bell, Check } from 'lucide-react';
import {
  AppearanceMode,
  AppSettings,
  CURRENCY_CONFIGS,
  CurrencyCode,
  WeekStartDay,
} from '../../types';
import { notificationService } from '../../services/notifications';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
}) => {
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);

  const currentCurrency = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;

  const toggleWeekStartsOn = () => {
    const next: WeekStartDay = settings.weekStartsOn === 'Monday' ? 'Sunday' : 'Monday';
    onUpdateSettings({ weekStartsOn: next });
  };

  const toggleAppLock = () => {
    onUpdateSettings({ appLock: !settings.appLock });
  };

  const toggleInactivityReminder = async () => {
    const next = !settings.inactivityReminder;
    if (next && notificationService.isSupported()) {
      await notificationService.requestPermission();
    }
    onUpdateSettings({ inactivityReminder: next });
  };

  return (
    <div className="flex-1 px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto space-y-7 pb-20">
      {/* GENERAL section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          General
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* Currency Row */}
          <button
            type="button"
            onClick={() => setCurrencyModalOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">Currency</span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
              <span>{currentCurrency.name}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </button>

          {/* Week starts on */}
          <button
            type="button"
            onClick={toggleWeekStartsOn}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">Week starts on</span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
              <span>{settings.weekStartsOn}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </button>

          {/* Appearance */}
          <button
            type="button"
            onClick={() => setAppearanceModalOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">Appearance</span>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-sm">
              <span>{settings.appearance}</span>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            </div>
          </button>
        </div>
      </div>

      {/* PRIVACY section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Privacy
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">App lock</span>
            <button
              type="button"
              onClick={toggleAppLock}
              role="switch"
              aria-checked={settings.appLock}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.appLock ? 'bg-[#2357A4]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.appLock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400 mt-3 leading-relaxed">
            Use your passcode or biometrics to open Busy Bees Expense Tracker.
          </p>
        </div>
      </div>

      {/* 24-HOUR NOTIFICATIONS section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Reminders & Notifications
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#2357A4] dark:text-blue-400" />
              <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">24h Inactivity Reminder</span>
            </div>
            <button
              type="button"
              onClick={toggleInactivityReminder}
              role="switch"
              aria-checked={settings.inactivityReminder}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.inactivityReminder ? 'bg-[#2357A4]' : 'bg-slate-200 dark:bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.inactivityReminder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed">
            Notifies you if the app hasn't been used for more than 24 hours to keep your records up to date.
          </p>
        </div>
      </div>

      <div className="pt-2 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500">Your preferences are saved automatically.</p>
      </div>

      {/* Currency Modal */}
      {currencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700 max-h-[80vh] flex flex-col">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-3">Select Currency</h3>
            <div className="space-y-1 overflow-y-auto flex-1">
              {(Object.keys(CURRENCY_CONFIGS) as CurrencyCode[]).map((code) => {
                const conf = CURRENCY_CONFIGS[code];
                return (
                  <button
                    key={code}
                    onClick={() => {
                      onUpdateSettings({ currency: code });
                      setCurrencyModalOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 transition text-left"
                  >
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{conf.name}</span>
                    {settings.currency === code && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrencyModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Appearance Modal (Light & Dark only) */}
      {appearanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-3">Appearance</h3>
            <div className="space-y-1">
              {(['Light', 'Dark'] as AppearanceMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onUpdateSettings({ appearance: mode });
                    setAppearanceModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 transition text-left"
                >
                  <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{mode}</span>
                  {settings.appearance === mode && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAppearanceModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
