import React, { useState } from 'react';
import { ChevronRight, Bell, Smartphone, Download, Upload, Check, ShieldCheck } from 'lucide-react';
import {
  AppearanceMode,
  AppSettings,
  CURRENCY_CONFIGS,
  CurrencyCode,
  WeekStartDay,
} from '../../types';
import { notificationService } from '../../services/notifications';
import { storage } from '../../services/storage';

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
  const [notificationTestStatus, setNotificationTestStatus] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);

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

  const handleTestNotification = async () => {
    if (notificationService.isSupported()) {
      const perm = await notificationService.requestPermission();
      if (perm === 'granted') {
        notificationService.triggerTestNotification();
        setNotificationTestStatus('Notification sent! Check your notification center.');
      } else {
        notificationService.triggerTestNotification();
        setNotificationTestStatus('Triggered in-app notification banner.');
      }
    } else {
      notificationService.triggerTestNotification();
      setNotificationTestStatus('Notification sent (in-app preview mode).');
    }
    setTimeout(() => setNotificationTestStatus(null), 4000);
  };

  const handleSimulate25Hours = () => {
    const triggered = notificationService.simulate25HoursInactivity();
    setNotificationTestStatus(
      triggered
        ? 'Simulated 25 hours idle: 24h reminder notification triggered!'
        : 'Inactivity check executed.'
    );
    setTimeout(() => setNotificationTestStatus(null), 4500);
  };

  const handleExportJSON = () => {
    const json = storage.exportBackupJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `busy-bees-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const res = storage.importBackupJSON(content);
      if (res.success) {
        setImportStatus(`Restored ${res.count} transactions successfully!`);
        window.location.reload();
      } else {
        setImportStatus(`Import failed: ${res.error}`);
      }
      setTimeout(() => setImportStatus(null), 5000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto space-y-7 pb-20">
      {/* GENERAL section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          General
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {/* Currency Row */}
          <button
            type="button"
            onClick={() => setCurrencyModalOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 font-medium">Currency</span>
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <span>{currentCurrency.name}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* Week starts on */}
          <button
            type="button"
            onClick={toggleWeekStartsOn}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 font-medium">Week starts on</span>
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <span>{settings.weekStartsOn}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>

          {/* Appearance */}
          <button
            type="button"
            onClick={() => setAppearanceModalOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition text-left"
          >
            <span className="text-[15px] text-slate-800 font-medium">Appearance</span>
            <div className="flex items-center gap-1.5 text-slate-500 text-sm">
              <span>{settings.appearance}</span>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
          </button>
        </div>
      </div>

      {/* PRIVACY section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Privacy
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[15px] text-slate-800 font-medium">App lock</span>
            <button
              type="button"
              onClick={toggleAppLock}
              role="switch"
              aria-checked={settings.appLock}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.appLock ? 'bg-[#2357A4]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.appLock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Use your device passcode or biometrics to open Busy Bees Expense Tracker.
          </p>
        </div>
      </div>

      {/* 24-HOUR NOTIFICATIONS section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Reminders & Notifications
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#2357A4]" />
              <span className="text-[15px] text-slate-800 font-medium">24h Inactivity Reminder</span>
            </div>
            <button
              type="button"
              onClick={toggleInactivityReminder}
              role="switch"
              aria-checked={settings.inactivityReminder}
              className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.inactivityReminder ? 'bg-[#2357A4]' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  settings.inactivityReminder ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Notifies you if the app hasn't been used for more than 24 hours to keep your records up to date.
          </p>

          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              onClick={handleTestNotification}
              className="flex-1 py-2 px-3 text-xs font-medium text-[#2357A4] bg-blue-50 hover:bg-blue-100/70 rounded-xl transition text-center"
            >
              Test Notification Now
            </button>
            <button
              onClick={handleSimulate25Hours}
              className="flex-1 py-2 px-3 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition text-center"
            >
              Simulate 25h Idle Trigger
            </button>
          </div>

          {notificationTestStatus && (
            <p className="text-xs font-medium text-emerald-600 bg-emerald-50 p-2 rounded-lg">
              {notificationTestStatus}
            </p>
          )}
        </div>
      </div>

      {/* DATA & BACKUP */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Data & Local Backup
        </h3>

        <div className="bg-white rounded-2xl border border-slate-200/90 divide-y divide-slate-100 overflow-hidden shadow-xs">
          {/* Version Control JSON export */}
          <div className="p-4 flex items-center justify-between">
            <div>
              <div className="text-[15px] text-slate-800 font-medium">
                Offline Backup (JSON)
              </div>
              <div className="text-xs text-slate-400">
                Export snapshot for personal backup and version control
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportJSON}
                title="Export JSON"
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition"
              >
                <Download className="w-4 h-4" />
              </button>
              <label
                title="Import JSON"
                className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
        {importStatus && (
          <p className="text-xs font-medium text-blue-600 mt-2 px-1">{importStatus}</p>
        )}
      </div>

      <div className="pt-2 text-center">
        <p className="text-xs text-slate-400">Your preferences are saved automatically.</p>
      </div>

      {/* Currency Modal */}
      {currencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl border border-slate-100 max-h-[80vh] flex flex-col">
            <h3 className="font-semibold text-slate-900 text-base mb-3">Select Currency</h3>
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
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition text-left"
                  >
                    <span className="font-medium text-sm text-slate-800">{conf.name}</span>
                    {settings.currency === code && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setCurrencyModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Appearance Modal */}
      {appearanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl border border-slate-100">
            <h3 className="font-semibold text-slate-900 text-base mb-3">Appearance</h3>
            <div className="space-y-1">
              {(['Light', 'Dark', 'System'] as AppearanceMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    onUpdateSettings({ appearance: mode });
                    setAppearanceModalOpen(false);
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 transition text-left"
                >
                  <span className="font-medium text-sm text-slate-800">{mode}</span>
                  {settings.appearance === mode && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>
            <button
              onClick={() => setAppearanceModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
