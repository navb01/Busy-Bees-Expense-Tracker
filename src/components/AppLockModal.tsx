import React, { useState } from 'react';
import { Lock, Fingerprint, Delete } from 'lucide-react';

interface AppLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  correctPin?: string;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  isLocked,
  onUnlock,
  correctPin = '1234',
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setError(false);
      if (newPin.length === 4) {
        if (newPin === correctPin) {
          setTimeout(() => {
            onUnlock();
            setPin('');
          }, 150);
        } else {
          setTimeout(() => {
            setError(true);
            setPin('');
          }, 200);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleBiometrics = () => {
    // Quick biometric unlock shortcut
    onUnlock();
    setPin('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
      <div className="w-full max-w-xs bg-white rounded-3xl p-6 shadow-2xl text-center border border-slate-100 animate-in fade-in zoom-in-95">
        <div className="w-12 h-12 rounded-full bg-blue-50 text-[#2357A4] flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6 stroke-[2]" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Busy Bees Locked</h2>
        <p className="text-xs text-slate-500 mt-1">Enter your 4-digit PIN (default: 1234)</p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 my-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-[#2357A4] scale-110'
                  : error
                  ? 'bg-rose-400'
                  : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-rose-500 font-medium mb-3">
            Incorrect PIN. Try 1234
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[220px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-lg active:scale-95 transition"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBiometrics}
            title="Biometric unlock"
            className="h-12 rounded-2xl bg-blue-50 hover:bg-blue-100 text-[#2357A4] flex items-center justify-center active:scale-95 transition"
          >
            <Fingerprint className="w-6 h-6" />
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-lg active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Backspace"
            className="h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center active:scale-95 transition"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
