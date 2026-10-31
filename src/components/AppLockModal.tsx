import React, { useEffect, useState } from 'react';
import { Fingerprint, Delete } from 'lucide-react';
import { authenticateWithBiometrics, isBiometricSupported } from '../services/biometricAuth';
import { BusyBeesLogo } from './BusyBeesLogo';

interface AppLockModalProps {
  isLocked: boolean;
  onUnlock: () => void;
  correctPin: string;
  biometricEnabled?: boolean;
}

export const AppLockModal: React.FC<AppLockModalProps> = ({
  isLocked,
  onUnlock,
  correctPin,
  biometricEnabled = true,
}) => {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);

  useEffect(() => {
    if (!isLocked) {
      setPin('');
      setErrorMessage(null);
      setBiometricBusy(false);
      return;
    }

    let cancelled = false;

    const initBiometric = async () => {
      const support = await isBiometricSupported();
      if (cancelled) return;
      setBiometricAvailable(support.available);

      // Automatically prompt biometric unlock when lock screen opens if enabled & supported
      if (biometricEnabled && support.available) {
        setBiometricBusy(true);
        const result = await authenticateWithBiometrics();
        if (cancelled) return;
        setBiometricBusy(false);
        if (result.success) {
          setPin('');
          setErrorMessage(null);
          onUnlock();
        } else if (!result.cancelled && result.error) {
          setErrorMessage(result.error);
        }
      }
    };

    const timer = window.setTimeout(initBiometric, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLocked, biometricEnabled, onUnlock]);

  if (!isLocked) return null;

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      setErrorMessage(null);
      if (newPin.length === 4) {
        if (correctPin && newPin === correctPin) {
          setTimeout(() => {
            setPin('');
            setErrorMessage(null);
            onUnlock();
          }, 150);
        } else {
          setTimeout(() => {
            setErrorMessage('Incorrect PIN. Please try again.');
            setPin('');
          }, 200);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMessage(null);
  };

  const handleBiometrics = async () => {
    if (biometricBusy) return;
    setErrorMessage(null);

    if (!biometricEnabled) {
      setErrorMessage('Biometric unlock is turned off in Settings.');
      return;
    }

    const support = await isBiometricSupported();
    if (!support.available) {
      setErrorMessage(
        support.status === 'NONE_ENROLLED'
          ? 'No fingerprint or face unlock enrolled on this phone. Please use your PIN.'
          : 'Biometric unlock is not available on this device. Please use your PIN.'
      );
      return;
    }

    setBiometricBusy(true);
    const result = await authenticateWithBiometrics();
    setBiometricBusy(false);

    if (result.success) {
      setPin('');
      setErrorMessage(null);
      onUnlock();
    } else if (!result.cancelled && result.error) {
      setErrorMessage(result.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/85 backdrop-blur-md">
      <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl text-center border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95">
        <div className="flex justify-center mb-3">
          <BusyBeesLogo variant="monogram" size={52} animated={false} />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Busy Bees Locked</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {biometricEnabled && biometricAvailable
            ? 'Enter your 4-digit PIN or use Biometrics'
            : 'Enter your 4-digit PIN to unlock'}
        </p>

        {/* PIN dots */}
        <div className="flex justify-center gap-3 my-6">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? 'bg-[#2357A4] dark:bg-blue-400 scale-110'
                  : errorMessage
                  ? 'bg-rose-400'
                  : 'bg-slate-200 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {errorMessage && (
          <p className="text-xs text-rose-500 font-medium mb-3 px-2 leading-relaxed">
            {errorMessage}
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[220px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold text-lg active:scale-95 transition"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={handleBiometrics}
            disabled={biometricBusy}
            title="Biometric unlock"
            className={`h-12 rounded-2xl flex items-center justify-center active:scale-95 transition ${
              biometricEnabled
                ? 'bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#2357A4] dark:text-blue-400'
                : 'bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500'
            }`}
          >
            <Fingerprint className={`w-6 h-6 ${biometricBusy ? 'animate-pulse' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-semibold text-lg active:scale-95 transition"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleDelete}
            title="Backspace"
            className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center active:scale-95 transition"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
