import React, { useState } from 'react';
import { CloudDownload, RefreshCw, AlertTriangle } from 'lucide-react';
import { AppSettings, Transaction, UserProfile } from '../../types';
import { AppBackupSnapshot, storage } from '../../services/storage';
import {
  CloudBackupFileInfo,
  connectGoogleAccount,
  downloadCloudBackup,
  findCloudBackup,
  formatBackupTimestamp,
  formatBytes,
} from '../../services/googleDriveBackup';

interface WelcomeScreenProps {
  initialProfile: UserProfile;
  onComplete: (profile: UserProfile) => void;
  onRestoredFromCloud?: (restored: {
    transactions: Transaction[];
    profile: UserProfile;
    settings: AppSettings;
  }) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  initialProfile,
  onComplete,
  onRestoredFromCloud,
}) => {
  const [name, setName] = useState(initialProfile.name || '');
  const [age, setAge] = useState(initialProfile.age || '');
  const [occupation, setOccupation] = useState(initialProfile.occupation || '');
  const [city, setCity] = useState(initialProfile.city || '');

  const [isCheckingCloud, setIsCheckingCloud] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [foundBackup, setFoundBackup] = useState<{
    fileInfo: CloudBackupFileInfo;
    snapshot: AppBackupSnapshot;
    email: string;
  } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete({
      name: name.trim(),
      age: age.trim(),
      occupation: occupation.trim(),
      city: city.trim(),
    });
  };

  const handleSkip = () => {
    onComplete({
      name: name.trim(),
      age: age.trim(),
      occupation: occupation.trim(),
      city: city.trim(),
    });
  };

  const handleCheckDriveRestore = async () => {
    setCloudError(null);
    setIsCheckingCloud(true);
    try {
      const { user, accessToken } = await connectGoogleAccount(true);
      const fileInfo = await findCloudBackup(accessToken);
      if (!fileInfo) {
        setCloudError(
          `No Busy Bees backup was found in Google Drive for ${user.email || 'this account'}. You can set up your profile below.`
        );
        return;
      }

      const snapshot = await downloadCloudBackup(accessToken, fileInfo.id);
      setFoundBackup({
        fileInfo,
        snapshot,
        email: user.email || '',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to check Google Drive backup.';
      if (!msg.includes('popup-closed-by-user')) {
        setCloudError(msg);
      }
    } finally {
      setIsCheckingCloud(false);
    }
  };

  const handleConfirmCloudRestore = () => {
    if (!foundBackup) return;
    const restored = storage.restoreFullBackupSnapshot(foundBackup.snapshot);
    storage.saveBackupMeta({
      lastBackupTime: new Date(foundBackup.fileInfo.modifiedTime).getTime(),
      lastBackupSize: foundBackup.fileInfo.sizeBytes,
      lastBackupTxCount: restored.transactions.length,
      googleEmail: foundBackup.email,
    });
    setFoundBackup(null);
    if (onRestoredFromCloud) {
      onRestoredFromCloud(restored);
    } else {
      onComplete(restored.profile);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-11 pb-10 sm:pt-8 sm:pb-8 max-w-lg mx-auto w-full overflow-y-auto bg-slate-50 dark:bg-slate-900">
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
        <div className="space-y-5">
          {/* Brand Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-[#2357A4] dark:text-blue-400">
                Welcome Aboard
              </span>
              <h1 className="text-xl sm:text-2xl font-brand text-slate-900 dark:text-slate-100 leading-tight mt-0.5 tracking-wide">
                Busy Bees Expense Tracker
              </h1>
            </div>
            <div
              className="w-11 h-11 rounded-full border-2 border-[#2357A4] dark:border-blue-400 flex items-center justify-center text-[#2357A4] dark:text-blue-400 font-bold text-sm bg-white dark:bg-slate-800 shadow-xs select-none shrink-0"
              aria-label="Busy Bees Logo"
            >
              BB
            </div>
          </div>

          {/* WhatsApp-Style Restore from Google Drive Banner (for Reinstalls / New Phone) */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <CloudDownload className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Reinstalling or switching phones?
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Restore your previous transactions, profile, and settings from your Google Drive backup.
                </p>
              </div>
            </div>

            {cloudError && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{cloudError}</span>
              </div>
            )}

            <button
              type="button"
              disabled={isCheckingCloud}
              onClick={handleCheckDriveRestore}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              {isCheckingCloud ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Checking Google Drive...</span>
                </>
              ) : (
                <>
                  <CloudDownload className="w-3.5 h-3.5" />
                  <span>Restore from Google Drive</span>
                </>
              )}
            </button>
          </div>

          {/* Intro Card */}
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Or start fresh on this phone
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Set up your user profile below. You can enable Google Drive backup anytime from the menu.
            </p>
          </div>

          {/* User Profile Fields */}
          <div className="space-y-3.5">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Add name"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* Age */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Age
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Add age"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* Occupation */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                Occupation
              </label>
              <input
                type="text"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                placeholder="Add occupation"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Add city"
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400 dark:placeholder-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-5 mt-5 space-y-2">
          <button
            type="submit"
            className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm"
          >
            Save & Continue
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-2.5 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            Skip for now
          </button>
        </div>
      </form>

      {/* Restore Confirmation Modal */}
      {foundBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CloudDownload className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Backup Found!
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              Would you like to restore your Busy Bees data from Google Drive?
            </p>
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-700 text-left text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Account:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                  {foundBackup.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Backed Up:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatBackupTimestamp(foundBackup.fileInfo.modifiedTime)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Transactions:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {foundBackup.snapshot.transactions.length} entries
                </span>
              </div>
              {foundBackup.snapshot.profile?.name && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Profile:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {foundBackup.snapshot.profile.name}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Size:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatBytes(foundBackup.fileInfo.sizeBytes)}
                </span>
              </div>
            </div>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setFoundBackup(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCloudRestore}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition"
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

