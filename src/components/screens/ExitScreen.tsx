import React, { useState } from 'react';
import { LogOut, CheckCircle2, RotateCcw } from 'lucide-react';
import { storage } from '../../services/storage';

interface ExitScreenProps {
  onCancel: () => void;
  onConfirmExit: () => void;
}

export const ExitScreen: React.FC<ExitScreenProps> = ({ onCancel, onConfirmExit }) => {
  const [hasExited, setHasExited] = useState(false);

  const handleExit = () => {
    storage.recordActivity();
    setHasExited(true);
    onConfirmExit();
  };

  if (hasExited) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full text-center animate-in fade-in">
        <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-5 border border-emerald-100">
          <CheckCircle2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Session Saved Securely</h2>
        <p className="text-sm text-slate-500 mt-2 max-w-xs leading-relaxed">
          All your income and expenses are safely stored in your device's local storage. You can safely close your browser or app.
        </p>

        <div className="mt-8 w-full max-w-xs">
          <button
            onClick={() => {
              setHasExited(false);
              onCancel();
            }}
            className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Resume Tracker</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6 pt-4">
        {/* Exit Icon in rounded square matching Figma screen 9 */}
        <div className="w-14 h-14 rounded-2xl bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#2357A4]">
          <LogOut className="w-7 h-7 stroke-[1.8]" />
        </div>

        {/* Heading */}
        <h2 className="text-2xl font-bold text-slate-900 leading-tight">
          Exit Busy Bees Expense
          <br />
          Tracker?
        </h2>

        {/* Description */}
        <p className="text-[15px] text-slate-500 leading-relaxed">
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
          className="w-full py-4 rounded-xl text-slate-800 font-semibold text-base bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] transition shadow-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
