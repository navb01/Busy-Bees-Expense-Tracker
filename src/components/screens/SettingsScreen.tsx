import React, { useEffect, useState } from 'react';
import {
  ChevronRight,
  Bell,
  Check,
  Cloud,
  Lock,
  Fingerprint,
  KeyRound,
  Delete,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import {
  AppearanceMode,
  AppSettings,
  CURRENCY_CONFIGS,
  CurrencyCode,
  WeekStartDay,
} from '../../types';
import { notificationService } from '../../services/notifications';
import { storage } from '../../services/storage';
import { formatBackupTimestamp } from '../../services/googleDriveBackup';
import { authenticateWithBiometrics, isBiometricSupported } from '../../services/biometricAuth';
import {
  isNativeSmsDetectionSupported,
  isOverlayBubblePermissionGranted,
  isSmsNotificationAccessGranted,
  openSmsNotificationAccessSettings,
  requestOverlayBubblePermission,
  syncNativeSmsAutoDetectEnabled,
} from '../../services/smsTransactionParser';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onOpenBackup?: () => void;
  onShowToast?: (msg: string) => void;
}

type PinModalMode =
  | null
  | 'setup-create'
  | 'setup-confirm'
  | 'verify-disable'
  | 'verify-change'
  | 'change-create'
  | 'change-confirm';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onOpenBackup,
  onShowToast,
}) => {
  const [currencyModalOpen, setCurrencyModalOpen] = useState(false);
  const [appearanceModalOpen, setAppearanceModalOpen] = useState(false);
  const [nativeSmsSupported, setNativeSmsSupported] = useState(false);
  const [nativeSmsAccessGranted, setNativeSmsAccessGranted] = useState(false);
  const [overlayBubbleGranted, setOverlayBubbleGranted] = useState(false);

  // PIN Setup / Change / Verify Modal state
  const [pinModalMode, setPinModalMode] = useState<PinModalMode>(null);
  const [pinInput, setPinInput] = useState('');
  const [firstPinDraft, setFirstPinDraft] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState<'AVAILABLE' | 'NONE_ENROLLED' | 'UNAVAILABLE'>('UNAVAILABLE');

  const currentCurrency = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;
  const backupMeta = storage.getBackupMeta();

  useEffect(() => {
    let mounted = true;
    isBiometricSupported().then((res) => {
      if (!mounted) return;
      setBiometricSupported(res.available);
      setBiometricStatus(res.status);
    });

    const refreshSmsAccess = () => {
      if (!mounted) return;
      const supported = isNativeSmsDetectionSupported();
      setNativeSmsSupported(supported);
      if (supported) {
        setNativeSmsAccessGranted(isSmsNotificationAccessGranted());
        setOverlayBubbleGranted(isOverlayBubblePermissionGranted());
      }
    };

    refreshSmsAccess();
    window.addEventListener('focus', refreshSmsAccess);
    document.addEventListener('visibilitychange', refreshSmsAccess);
    window.addEventListener('bb-sms-permission-changed', refreshSmsAccess);

    return () => {
      mounted = false;
      window.removeEventListener('focus', refreshSmsAccess);
      document.removeEventListener('visibilitychange', refreshSmsAccess);
      window.removeEventListener('bb-sms-permission-changed', refreshSmsAccess);
    };
  }, []);

  const toggleWeekStartsOn = () => {
    const next: WeekStartDay = settings.weekStartsOn === 'Monday' ? 'Sunday' : 'Monday';
    onUpdateSettings({ weekStartsOn: next });
  };

  const openPinModal = (mode: PinModalMode) => {
    setPinModalMode(mode);
    setPinInput('');
    setFirstPinDraft('');
    setPinError(null);
  };

  const closePinModal = () => {
    setPinModalMode(null);
    setPinInput('');
    setFirstPinDraft('');
    setPinError(null);
  };

  const toggleAppLock = () => {
    if (!settings.appLock) {
      // Turning App Lock ON -> always ask user to set their 4-digit PIN
      openPinModal('setup-create');
    } else {
      // Turning App Lock OFF -> verify current PIN or Biometric first
      openPinModal('verify-disable');
    }
  };

  const handleStartChangePin = () => {
    openPinModal('verify-change');
  };

  const toggleBiometricUnlock = async () => {
    const currentBio = settings.biometricEnabled !== false;
    if (!currentBio) {
      // Turning ON biometric unlock -> verify biometric works on this device
      const support = await isBiometricSupported();
      if (!support.available) {
        onShowToast?.(
          support.status === 'NONE_ENROLLED'
            ? 'Please enroll a fingerprint or face lock in your phone settings first'
            : 'Biometric sensor is not available on this device'
        );
        return;
      }
      const res = await authenticateWithBiometrics();
      if (res.success) {
        onUpdateSettings({ biometricEnabled: true });
        onShowToast?.('Biometric unlock enabled');
      } else if (!res.cancelled && res.error) {
        onShowToast?.(res.error);
      }
    } else {
      onUpdateSettings({ biometricEnabled: false });
      onShowToast?.('Biometric unlock turned off');
    }
  };

  const handlePinDigit = (digit: string) => {
    if (pinInput.length >= 4) return;
    const nextPin = pinInput + digit;
    setPinInput(nextPin);
    setPinError(null);

    if (nextPin.length === 4) {
      window.setTimeout(() => {
        processCompletedPin(nextPin);
      }, 150);
    }
  };

  const processCompletedPin = (enteredPin: string) => {
    if (pinModalMode === 'setup-create') {
      setFirstPinDraft(enteredPin);
      setPinInput('');
      setPinError(null);
      setPinModalMode('setup-confirm');
      return;
    }

    if (pinModalMode === 'setup-confirm') {
      if (enteredPin !== firstPinDraft) {
        setPinError('PINs did not match. Please try again.');
        setPinInput('');
        setFirstPinDraft('');
        setPinModalMode('setup-create');
        return;
      }
      onUpdateSettings({
        appLock: true,
        pinCode: enteredPin,
        customPinSet: true,
        biometricEnabled: true,
      });
      closePinModal();
      onShowToast?.('App Lock enabled with your 4-digit PIN');
      return;
    }

    if (pinModalMode === 'verify-disable') {
      if (enteredPin === settings.pinCode) {
        onUpdateSettings({ appLock: false });
        closePinModal();
        onShowToast?.('App Lock turned off');
      } else {
        setPinError('Incorrect PIN. Please try again.');
        setPinInput('');
      }
      return;
    }

    if (pinModalMode === 'verify-change') {
      if (enteredPin === settings.pinCode) {
        setPinInput('');
        setPinError(null);
        setPinModalMode('change-create');
      } else {
        setPinError('Incorrect current PIN. Please try again.');
        setPinInput('');
      }
      return;
    }

    if (pinModalMode === 'change-create') {
      setFirstPinDraft(enteredPin);
      setPinInput('');
      setPinError(null);
      setPinModalMode('change-confirm');
      return;
    }

    if (pinModalMode === 'change-confirm') {
      if (enteredPin !== firstPinDraft) {
        setPinError('New PINs did not match. Please enter your new PIN again.');
        setPinInput('');
        setFirstPinDraft('');
        setPinModalMode('change-create');
        return;
      }
      onUpdateSettings({
        appLock: true,
        pinCode: enteredPin,
        customPinSet: true,
      });
      closePinModal();
      onShowToast?.('App Lock PIN updated');
    }
  };

  const handleVerifyWithBiometrics = async () => {
    setPinError(null);
    const res = await authenticateWithBiometrics();
    if (res.success) {
      if (pinModalMode === 'verify-disable') {
        onUpdateSettings({ appLock: false });
        closePinModal();
        onShowToast?.('App Lock turned off');
      } else if (pinModalMode === 'verify-change') {
        setPinInput('');
        setPinError(null);
        setPinModalMode('change-create');
      }
    } else if (!res.cancelled && res.error) {
      setPinError(res.error);
    }
  };

  const toggleInactivityReminder = async () => {
    const next = !settings.inactivityReminder;
    if (next && notificationService.isSupported()) {
      await notificationService.requestPermission();
    }
    onUpdateSettings({ inactivityReminder: next });
  };

  const getPinModalTitle = () => {
    switch (pinModalMode) {
      case 'setup-create':
        return 'Create 4-Digit PIN';
      case 'setup-confirm':
        return 'Confirm 4-Digit PIN';
      case 'verify-disable':
        return 'Verify PIN to Turn Off';
      case 'verify-change':
        return 'Enter Current PIN';
      case 'change-create':
        return 'Enter New 4-Digit PIN';
      case 'change-confirm':
        return 'Confirm New 4-Digit PIN';
      default:
        return '';
    }
  };

  const getPinModalSubtitle = () => {
    switch (pinModalMode) {
      case 'setup-create':
        return 'Choose a 4-digit PIN to protect Busy Bees Expense Tracker.';
      case 'setup-confirm':
        return 'Re-enter the same 4-digit PIN to confirm.';
      case 'verify-disable':
        return 'Enter your current 4-digit PIN to disable App Lock.';
      case 'verify-change':
        return 'Verify your existing 4-digit PIN before setting a new one.';
      case 'change-create':
        return 'Choose your new 4-digit PIN.';
      case 'change-confirm':
        return 'Re-enter your new 4-digit PIN to save.';
      default:
        return '';
    }
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

      {/* CLOUD BACKUP & RESTORE section */}
      {onOpenBackup && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
            Backup & Restore
          </h3>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 overflow-hidden shadow-xs">
            <button
              type="button"
              onClick={onOpenBackup}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[15px] text-slate-800 dark:text-slate-100 font-medium">
                    Google Drive Backup
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    Last backup: {formatBackupTimestamp(backupMeta.lastBackupTime)}
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* PRIVACY section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Privacy
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Lock className="w-4 h-4 text-[#2357A4] dark:text-blue-400" />
                <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">App lock</span>
              </div>
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
            <p className="text-xs text-slate-400 dark:text-slate-400 mt-2.5 leading-relaxed">
              Protect Busy Bees Expense Tracker with your own 4-digit PIN and device biometrics.
            </p>
          </div>

          {settings.appLock && (
            <>
              {/* Biometric Unlock Toggle */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Fingerprint className="w-4 h-4 text-[#2357A4] dark:text-blue-400 shrink-0" />
                    <span className="text-[14px] text-slate-800 dark:text-slate-100 font-medium">
                      Unlock with Biometrics
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-400 mt-1">
                    {biometricSupported
                      ? 'Use fingerprint or face recognition to unlock'
                      : biometricStatus === 'NONE_ENROLLED'
                      ? 'No fingerprint/face enrolled on this device yet'
                      : 'Use device fingerprint or face unlock when available'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleBiometricUnlock}
                  role="switch"
                  aria-checked={settings.biometricEnabled !== false}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    settings.biometricEnabled !== false
                      ? 'bg-[#2357A4]'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      settings.biometricEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Change PIN Button */}
              <button
                type="button"
                onClick={handleStartChangePin}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <KeyRound className="w-4 h-4 text-[#2357A4] dark:text-blue-400" />
                  <span className="text-[14px] text-slate-800 dark:text-slate-100 font-medium">
                    Change 4-Digit PIN
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* SMART SMS TRANSACTION DETECTION section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Smart SMS Transaction Detection
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MessageSquare className="w-4 h-4 text-[#2357A4] dark:text-blue-400" />
                <span className="text-[15px] text-slate-800 dark:text-slate-100 font-medium">
                  Auto-Detect from SMS
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = settings.smsAutoDetectEnabled === false;
                  onUpdateSettings({ smsAutoDetectEnabled: next });
                  syncNativeSmsAutoDetectEnabled(next);
                  onShowToast?.(
                    next ? 'SMS transaction auto-detection enabled' : 'SMS auto-detection paused'
                  );
                }}
                role="switch"
                aria-checked={settings.smsAutoDetectEnabled !== false}
                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  settings.smsAutoDetectEnabled !== false
                    ? 'bg-[#2357A4]'
                    : 'bg-slate-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.smsAutoDetectEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed">
              Automatically identifies Debit/Credit keywords and amount from incoming SMS notifications and shows a quick summary popup to Save or Edit.
            </p>

            {/* Strict Privacy Disclosure Banner (Google Play & App Store Compliant) */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/50">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <strong>100% On-Device Privacy:</strong> Only Debit/Credit status and Amount are extracted. Bank names, account numbers, balances, and raw SMS text are strictly ignored and never stored.
              </p>
            </div>
          </div>

          {settings.smsAutoDetectEnabled !== false && nativeSmsSupported && (
            <>
              {/* Android Smart SMS Permission Status / Button */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[14px] text-slate-800 dark:text-slate-100 font-medium">
                    Android Smart SMS Permission
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                    {nativeSmsAccessGranted
                      ? 'Active — Detecting incoming Debit & Credit SMS'
                      : 'One-tap permission for automatic SMS detection'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openSmsNotificationAccessSettings()}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                    nativeSmsAccessGranted
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-[#2357A4] hover:bg-[#1D4A8C] text-white'
                  }`}
                >
                  {nativeSmsAccessGranted ? 'Connected' : 'Grant Access'}
                </button>
              </div>

              {/* Floating Bubble Overlay Permission Row */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block text-[14px] text-slate-800 dark:text-slate-100 font-medium">
                    Floating Bubble Overlay
                  </span>
                  <span className="block text-xs text-slate-400 dark:text-slate-400 mt-0.5">
                    {overlayBubbleGranted
                      ? 'Active — Shows draggable bubble over other apps'
                      : 'Show FB Messenger-style floating bubble over apps'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => requestOverlayBubblePermission()}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition ${
                    overlayBubbleGranted
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-[#2357A4] hover:bg-[#1D4A8C] text-white'
                  }`}
                >
                  {overlayBubbleGranted ? 'Enabled' : 'Enable Bubble'}
                </button>
              </div>
            </>
          )}
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

      {/* PIN Setup / Change / Verify Modal */}
      {pinModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl text-center border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2357A4] dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6 stroke-[2]" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {getPinModalTitle()}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {getPinModalSubtitle()}
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-3 my-5">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                    pinInput.length > idx
                      ? 'bg-[#2357A4] dark:bg-blue-400 scale-110'
                      : pinError
                      ? 'bg-rose-400'
                      : 'bg-slate-200 dark:bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {pinError && (
              <p className="text-xs text-rose-500 font-medium mb-3 leading-relaxed">
                {pinError}
              </p>
            )}

            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[220px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinDigit(digit)}
                  className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold text-base active:scale-95 transition"
                >
                  {digit}
                </button>
              ))}

              {(pinModalMode === 'verify-disable' || pinModalMode === 'verify-change') &&
              biometricSupported &&
              settings.biometricEnabled !== false ? (
                <button
                  type="button"
                  onClick={handleVerifyWithBiometrics}
                  title="Verify with Biometrics"
                  className="h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#2357A4] dark:text-blue-400 flex items-center justify-center active:scale-95 transition"
                >
                  <Fingerprint className="w-5 h-5" />
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => handlePinDigit('0')}
                className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold text-base active:scale-95 transition"
              >
                0
              </button>

              <button
                type="button"
                onClick={() => {
                  setPinInput((prev) => prev.slice(0, -1));
                  setPinError(null);
                }}
                title="Backspace"
                className="h-11 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition"
              >
                <Delete className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={closePinModal}
              className="mt-5 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
