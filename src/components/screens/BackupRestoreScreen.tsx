import React, { useEffect, useState } from 'react';
import {
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Check,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  UserCheck,
  ChevronRight,
  ShieldCheck,
  LogOut,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  AppSettings,
  BackupFrequency,
  LocalBackupMetadata,
  Transaction,
  UserProfile,
} from '../../types';
import { AppBackupSnapshot, storage } from '../../services/storage';
import {
  CloudBackupFileInfo,
  connectGoogleAccount,
  deleteCloudBackup,
  disconnectGoogleAccount,
  downloadCloudBackup,
  findCloudBackup,
  formatBackupTimestamp,
  formatBytes,
  getAccessToken,
  hasActiveAccessToken,
  isNativeDriveBridgeAvailable,
  pickAndDownloadNativeBackup,
  subscribeAuthUser,
  uploadCloudBackup,
} from '../../services/googleDriveBackup';

interface BackupRestoreScreenProps {
  transactions: Transaction[];
  profile: UserProfile;
  settings: AppSettings;
  onRestored: (restored: {
    transactions: Transaction[];
    profile: UserProfile;
    settings: AppSettings;
  }) => void;
  onShowToast: (msg: string) => void;
}

const BACKUP_FREQUENCIES: BackupFrequency[] = [
  'Never',
  'Only when I tap "Back up"',
  'Daily',
  'Weekly',
  'Monthly',
];

export const BackupRestoreScreen: React.FC<BackupRestoreScreenProps> = ({
  transactions,
  profile,
  onRestored,
  onShowToast,
}) => {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [backupMeta, setBackupMeta] = useState<LocalBackupMetadata>(() =>
    storage.getBackupMeta()
  );
  const [cloudBackup, setCloudBackup] = useState<CloudBackupFileInfo | null>(null);

  const [isBusy, setIsBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<string>('');
  const [statusBanner, setStatusBanner] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals
  const [frequencyModalOpen, setFrequencyModalOpen] = useState(false);
  const [confirmBackupModalOpen, setConfirmBackupModalOpen] = useState(false);
  const [confirmRestoreModalOpen, setConfirmRestoreModalOpen] = useState(false);
  const [confirmDeleteModalOpen, setConfirmDeleteModalOpen] = useState(false);
  const [pendingRestoreSnapshot, setPendingRestoreSnapshot] = useState<{
    fileInfo: CloudBackupFileInfo;
    snapshot?: AppBackupSnapshot;
  } | null>(null);

  useEffect(() => {
    const unsub = subscribeAuthUser((user) => {
      setAuthUser(user);
      setBackupMeta(storage.getBackupMeta());
    });
    return () => unsub();
  }, []);

  // Automatically check cloud backup metadata if an access token is already active in memory
  useEffect(() => {
    if (hasActiveAccessToken()) {
      void handleCheckCloudBackup(true);
    }
  }, []);

  const handleConnectAccount = async (switchAccount = false) => {
    setStatusBanner(null);
    setIsBusy(true);
    setBusyAction('Connecting Google account...');
    try {
      const { user, accessToken } = await connectGoogleAccount(switchAccount);
      setAuthUser(user);
      setBackupMeta(storage.getBackupMeta());

      setBusyAction('Checking Google Drive for existing backups...');
      const found = await findCloudBackup(accessToken);
      setCloudBackup(found);
      if (found) {
        const updated = storage.saveBackupMeta({
          lastBackupTime: new Date(found.modifiedTime).getTime(),
          lastBackupSize: found.sizeBytes,
          lastBackupTxCount: found.txCount ?? null,
          googleEmail: user.email || '',
        });
        setBackupMeta(updated);
        setStatusBanner({
          type: 'info',
          message: `Connected as ${user.email}. Found backup from ${formatBackupTimestamp(found.modifiedTime)}.`,
        });
      } else {
        setStatusBanner({
          type: 'success',
          message: `Connected as ${user.email}. Ready to back up to Google Drive.`,
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not connect Google account.';
      if (!msg.includes('popup-closed-by-user')) {
        setStatusBanner({ type: 'error', message: msg });
      }
    } finally {
      setIsBusy(false);
      setBusyAction('');
    }
  };

  const handleDisconnectAccount = async () => {
    setStatusBanner(null);
    try {
      await disconnectGoogleAccount();
      setAuthUser(null);
      setCloudBackup(null);
      setBackupMeta(storage.getBackupMeta());
      onShowToast('Google account disconnected');
    } catch {
      setStatusBanner({ type: 'error', message: 'Failed to disconnect account.' });
    }
  };

  const handleCheckCloudBackup = async (silent = false) => {
    if (!silent) {
      setStatusBanner(null);
      setIsBusy(true);
      setBusyAction('Checking Google Drive...');
    }
    try {
      const token = await getAccessToken(false);
      const found = await findCloudBackup(token);
      setCloudBackup(found);
      if (found) {
        const updated = storage.saveBackupMeta({
          lastBackupTime: new Date(found.modifiedTime).getTime(),
          lastBackupSize: found.sizeBytes,
          lastBackupTxCount: found.txCount ?? null,
        });
        setBackupMeta(updated);
        if (!silent) {
          setStatusBanner({
            type: 'info',
            message: `Backup found on Google Drive (${formatBackupTimestamp(found.modifiedTime)}).`,
          });
        }
      } else if (!silent) {
        setStatusBanner({
          type: 'info',
          message: 'No existing backup found on Google Drive for this account.',
        });
      }
    } catch (err) {
      if (!silent) {
        const msg = err instanceof Error ? err.message : 'Unable to check Google Drive.';
        if (!msg.includes('popup-closed-by-user')) {
          setStatusBanner({ type: 'error', message: msg });
        }
      }
    } finally {
      if (!silent) {
        setIsBusy(false);
        setBusyAction('');
      }
    }
  };

  // Step 1 of Backup: Open confirmation modal before writing/overwriting to Google Drive
  const handleInitiateBackup = () => {
    setStatusBanner(null);
    setConfirmBackupModalOpen(true);
  };

  // Step 2 of Backup: Execute backup after user confirms
  const handleConfirmBackupNow = async () => {
    setConfirmBackupModalOpen(false);
    setStatusBanner(null);
    setIsBusy(true);
    setBusyAction('Connecting to Google Drive...');

    try {
      let token = await getAccessToken(false);
      setBusyAction('Checking previous backup...');
      let existing: CloudBackupFileInfo | null = null;
      try {
        existing = await findCloudBackup(token);
      } catch (e) {
        if (e instanceof Error && e.message === 'AUTH_EXPIRED') {
          token = await getAccessToken(false);
          existing = await findCloudBackup(token);
        } else {
          throw e;
        }
      }

      setBusyAction('Uploading encrypted data to Google Drive...');
      const snapshot = storage.getFullBackupSnapshot();
      const uploaded = await uploadCloudBackup(token, snapshot, existing?.id);

      setCloudBackup(uploaded);
      setBackupMeta(storage.getBackupMeta());
      setStatusBanner({
        type: 'success',
        message: `Backed up ${snapshot.transactions.length} transaction(s) to Google Drive (${formatBytes(uploaded.sizeBytes)}).`,
      });
      onShowToast('Backup saved to Google Drive');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Backup failed. Please try again.';
      if (!msg.includes('popup-closed-by-user')) {
        setStatusBanner({ type: 'error', message: msg });
      }
    } finally {
      setIsBusy(false);
      setBusyAction('');
    }
  };

  // Step 1 of Restore: Locate cloud backup and open confirmation modal before overwriting local data
  const handleInitiateRestore = async () => {
    setStatusBanner(null);
    setIsBusy(true);
    setBusyAction('Searching Google Drive for backup...');

    try {
      let token = await getAccessToken(false);
      let found: CloudBackupFileInfo | null = null;
      try {
        found = await findCloudBackup(token);
      } catch (e) {
        if (e instanceof Error && e.message === 'AUTH_EXPIRED') {
          token = await getAccessToken(false);
          found = await findCloudBackup(token);
        } else {
          throw e;
        }
      }

      if (!found) {
        if (isNativeDriveBridgeAvailable()) {
          setBusyAction('Select your backup file from Google Drive...');
          const picked = await pickAndDownloadNativeBackup();
          setCloudBackup(picked.fileInfo);
          setPendingRestoreSnapshot({ fileInfo: picked.fileInfo, snapshot: picked.snapshot });
          setConfirmRestoreModalOpen(true);
          return;
        }
        setStatusBanner({
          type: 'error',
          message: 'No backup file was found on Google Drive for this Google account.',
        });
        return;
      }

      setBusyAction('Fetching backup details...');
      const snapshot = await downloadCloudBackup(token, found.id);
      setCloudBackup(found);
      setPendingRestoreSnapshot({ fileInfo: found, snapshot });
      setConfirmRestoreModalOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to inspect backup on Google Drive.';
      if (!msg.includes('popup-closed-by-user')) {
        setStatusBanner({ type: 'error', message: msg });
      }
    } finally {
      setIsBusy(false);
      setBusyAction('');
    }
  };

  // Step 2 of Restore: User confirmed overwriting local data with cloud backup
  const handleConfirmRestoreNow = () => {
    if (!pendingRestoreSnapshot?.snapshot) return;
    const { snapshot, fileInfo } = pendingRestoreSnapshot;
    setConfirmRestoreModalOpen(false);

    const restored = storage.restoreFullBackupSnapshot(snapshot);
    const updatedMeta = storage.saveBackupMeta({
      lastBackupTime: new Date(fileInfo.modifiedTime).getTime(),
      lastBackupSize: fileInfo.sizeBytes,
      lastBackupTxCount: restored.transactions.length,
    });
    setBackupMeta(updatedMeta);
    setPendingRestoreSnapshot(null);

    onRestored(restored);
    setStatusBanner({
      type: 'success',
      message: `Restored ${restored.transactions.length} transaction(s), profile, and settings from Google Drive.`,
    });
    onShowToast('Data restored from Google Drive');
  };

  // Delete Cloud Backup after confirmation
  const handleConfirmDeleteCloudBackup = async () => {
    setConfirmDeleteModalOpen(false);
    setStatusBanner(null);
    setIsBusy(true);
    setBusyAction('Deleting backup from Google Drive...');

    try {
      const token = await getAccessToken(false);
      const targetId = cloudBackup?.id || (await findCloudBackup(token))?.id;
      if (!targetId) {
        setStatusBanner({
          type: 'info',
          message: 'No backup file found on Google Drive to delete.',
        });
        return;
      }
      await deleteCloudBackup(token, targetId);
      setCloudBackup(null);
      setBackupMeta(storage.getBackupMeta());
      setStatusBanner({
        type: 'success',
        message: 'Backup deleted from Google Drive. Your local phone data remains untouched.',
      });
      onShowToast('Cloud backup deleted');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete backup from Google Drive.';
      if (!msg.includes('popup-closed-by-user')) {
        setStatusBanner({ type: 'error', message: msg });
      }
    } finally {
      setIsBusy(false);
      setBusyAction('');
    }
  };

  const handleSelectFrequency = (freq: BackupFrequency) => {
    const updated = storage.saveBackupMeta({ frequency: freq });
    setBackupMeta(updated);
    setFrequencyModalOpen(false);
    onShowToast(`Auto-backup set to: ${freq}`);
  };

  const connectedEmail = authUser?.email || backupMeta.googleEmail;
  const lastTimeDisplay = cloudBackup
    ? formatBackupTimestamp(cloudBackup.modifiedTime)
    : formatBackupTimestamp(backupMeta.lastBackupTime);
  const lastSizeDisplay = cloudBackup
    ? formatBytes(cloudBackup.sizeBytes)
    : backupMeta.lastBackupSize !== null
    ? formatBytes(backupMeta.lastBackupSize)
    : '—';
  const lastTxCount =
    cloudBackup?.txCount !== undefined
      ? cloudBackup.txCount
      : backupMeta.lastBackupTxCount !== null
      ? backupMeta.lastBackupTxCount
      : null;

  return (
    <div className="flex-1 px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto space-y-6 pb-20">
      {/* Status Banner */}
      {statusBanner && (
        <div
          className={`p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs leading-relaxed ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300'
              : statusBanner.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/70 text-rose-800 dark:text-rose-300'
              : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/70 text-blue-800 dark:text-blue-300'
          }`}
        >
          {statusBanner.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{statusBanner.message}</span>
        </div>
      )}

      {/* WhatsApp-Style Last Backup Hero Card */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Cloud className="w-6 h-6 stroke-[2]" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Last Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Back up your transactions, profile, and settings to Google Drive. You can restore them anytime you reinstall Busy Bees or switch phones.
            </p>
          </div>
        </div>

        {/* Backup Metadata Summary Box */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700/60 p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Google Drive:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {lastTimeDisplay}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">Backup Size:</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">
              {lastSizeDisplay}
            </span>
          </div>
          {lastTxCount !== null && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Saved Entries in Backup:</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {lastTxCount} transaction{lastTxCount === 1 ? '' : 's'}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-slate-200/70 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400">Current Phone Data:</span>
            <span className="font-medium text-[#2357A4] dark:text-blue-400">
              {transactions.length} transaction{transactions.length === 1 ? '' : 's'}
              {profile.name ? ` • ${profile.name}` : ''}
            </span>
          </div>
        </div>

        {/* Active Progress State */}
        {isBusy && (
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 flex items-center gap-3">
            <RefreshCw className="w-4 h-4 text-[#2357A4] dark:text-blue-400 animate-spin shrink-0" />
            <span className="text-xs font-medium text-[#2357A4] dark:text-blue-300">
              {busyAction || 'Working with Google Drive...'}
            </span>
          </div>
        )}

        {/* Primary Action Buttons: Back Up & Restore */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={isBusy}
            onClick={handleInitiateBackup}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-sm shadow-xs transition disabled:opacity-50"
          >
            <CloudUpload className="w-4 h-4 stroke-[2.2]" />
            <span>Back Up</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={handleInitiateRestore}
            className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] text-white font-semibold text-sm shadow-xs transition disabled:opacity-50"
          >
            <CloudDownload className="w-4 h-4 stroke-[2.2]" />
            <span>Restore</span>
          </button>
        </div>
      </div>

      {/* Google Drive Settings Section */}
      <div>
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3">
          Google Drive Settings
        </h3>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/90 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
          {/* Google Account Row */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <span className="block text-[15px] text-slate-800 dark:text-slate-100 font-medium">
                Google Account
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {connectedEmail || 'No Google account linked'}
              </span>
            </div>

            {connectedEmail ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleConnectAccount(true)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Switch
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={handleDisconnectAccount}
                  title="Disconnect Google Account"
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => handleConnectAccount(false)}
                className="px-3.5 py-2 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-xs font-semibold transition flex items-center gap-1.5 shrink-0"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Connect</span>
              </button>
            )}
          </div>

          {/* Back up to Google Drive Frequency */}
          <button
            type="button"
            onClick={() => setFrequencyModalOpen(true)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left"
          >
            <div>
              <span className="block text-[15px] text-slate-800 dark:text-slate-100 font-medium">
                Back up to Google Drive
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {backupMeta.frequency}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          </button>

          {/* Check Cloud Status Row */}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleCheckCloudBackup(false)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition text-left disabled:opacity-50"
          >
            <div>
              <span className="block text-[15px] text-slate-800 dark:text-slate-100 font-medium">
                Check Cloud Backup Status
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verify latest backup stored on Google Drive
              </span>
            </div>
            <RefreshCw className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
          </button>

          {/* Delete Cloud Backup Row */}
          {(cloudBackup || backupMeta.lastBackupTime) && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmDeleteModalOpen(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition text-left disabled:opacity-50"
            >
              <div>
                <span className="block text-[15px] text-rose-600 dark:text-rose-400 font-medium">
                  Delete Google Drive Backup
                </span>
                <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Remove backup file from Google Drive
                </span>
              </div>
              <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Privacy & App Folder Note */}
      <div className="p-4 rounded-2xl bg-slate-100/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-700/60 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-[#2357A4] dark:text-blue-400 shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Busy Bees only accesses its own private backup file in your Google Drive. It cannot view or access any of your other Google Drive files or photos.
        </p>
      </div>

      {/* Modal 1: Backup Frequency Selector */}
      {frequencyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base mb-3">
              Back up to Google Drive
            </h3>
            <div className="space-y-1">
              {BACKUP_FREQUENCIES.map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => handleSelectFrequency(freq)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/60 transition text-left"
                >
                  <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
                    {freq}
                  </span>
                  {backupMeta.frequency === freq && (
                    <Check className="w-4 h-4 text-[#2357A4] dark:text-blue-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setFrequencyModalOpen(false)}
              className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Modal 2: Explicit Confirmation Before Backing Up / Overwriting Cloud Backup */}
      {confirmBackupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CloudUpload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Back Up to Google Drive?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              This will upload your current device data ({transactions.length} transaction
              {transactions.length === 1 ? '' : 's'}, profile, and settings) to Google Drive
              {connectedEmail ? ` (${connectedEmail})` : ''} and replace any previous backup.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmBackupModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBackupNow}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
              >
                Back Up Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Explicit Confirmation Before Restoring & Replacing Local Data */}
      {confirmRestoreModalOpen && pendingRestoreSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/60 text-[#2357A4] dark:text-blue-400 flex items-center justify-center mx-auto mb-3">
              <CloudDownload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Restore from Google Drive?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Restoring will replace the current data on this phone with the backup from Google Drive:
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-700 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Backup Date:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatBackupTimestamp(pendingRestoreSnapshot.fileInfo.modifiedTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transactions:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {pendingRestoreSnapshot.snapshot?.transactions.length ?? 0} entries
                </span>
              </div>
              {pendingRestoreSnapshot.snapshot?.profile?.name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Profile:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {pendingRestoreSnapshot.snapshot.profile.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Size:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatBytes(pendingRestoreSnapshot.fileInfo.sizeBytes)}
                </span>
              </div>
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setConfirmRestoreModalOpen(false);
                  setPendingRestoreSnapshot(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRestoreNow}
                className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Explicit Confirmation Before Deleting Cloud Backup */}
      {confirmDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Delete Cloud Backup?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              This will permanently delete your Busy Bees backup file from Google Drive. Your data on this phone will not be deleted.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCloudBackup}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
