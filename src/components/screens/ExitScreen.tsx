import React from 'react';
import { LogOut } from 'lucide-react';
import { storage } from '../../services/storage';

interface ExitScreenProps {
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const ExitScreen: React.FC<ExitScreenProps> = ({ onCancel, onConfirmExit }) => {
  const handleExit = () => {
    storage.recordActivity();
    onConfirmExit();

    // 1. Native Android JavascriptInterface bridge (closes the Android Activity directly)
    const win = window as unknown as {
      BusyBeesNative?: { exitApp?: () => void };
      Capacitor?: { Plugins?: { App?: { exitApp?: () => void } } };
    };
    if (win.BusyBeesNative?.exitApp) {
      win.BusyBeesNative.exitApp();
      return;
    }

    // 2. Capacitor App plugin bridge if available
    if (win.Capacitor?.Plugins?.App?.exitApp) {
      win.Capacitor.Plugins.App.exitApp();
      return;
    }

    // 3. Cordova / WebView navigator exitApp fallback
    const nav = navigator as unknown as { app?: { exitApp?: () => void } };
    if (nav.app?.exitApp) {
      nav.app.exitApp();
      return;
    }

    // 4. Standard standalone window close fallback
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6 pt-4">
        {/* Exit Icon in rounded square */}
        <div className="w-14 h-14 rounded-2xl bg-blue-50/80 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-[#2357A4] dark:text-blue-400">
          <LogOut className="w-7 h-7 stroke-[1.8]" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-brand text-slate-900 dark:text-slate-100 leading-tight tracking-wide">
          Exit Busy Bees Expense
          <br />
          Tracker?
        </h2>

        {/* Description */}
        <p className="text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Your saved income and expenses will stay on this device. You can pick up where you left off next time.
        </p>
      </div>

      {/* Buttons */}
      <div className="pt-6 mt-6 space-y-3">
        <button
          type="button"
          onClick={handleExit}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm"
        >
          Exit
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-4 rounded-xl text-slate-800 dark:text-slate-100 font-semibold text-base bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] transition shadow-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
