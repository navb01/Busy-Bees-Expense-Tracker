import React, { useState } from 'react';
import { Calendar, ChevronDown, Check, AlertTriangle } from 'lucide-react';
import {
  AppSettings,
  CURRENCY_CONFIGS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Transaction,
  TransactionType,
} from '../../types';
import { getTodayISO } from '../../services/storage';

interface AddTransactionScreenProps {
  type: TransactionType;
  transactions: Transaction[];
  editingTransaction?: Transaction | null;
  prefillDraft?: {
    type: TransactionType;
    amount: number;
    category: string;
  } | null;
  settings: AppSettings;
  onSave: (tx: {
    type: TransactionType;
    amount: number;
    category: string;
    date: string;
    note: string;
  }) => void;
  onCancel: () => void;
}

export const AddTransactionScreen: React.FC<AddTransactionScreenProps> = ({
  type,
  transactions,
  editingTransaction,
  prefillDraft,
  settings,
  onSave,
}) => {
  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const todayISO = getTodayISO();

  const defaultAmount = editingTransaction
    ? editingTransaction.amount.toFixed(2)
    : prefillDraft && prefillDraft.amount > 0
    ? prefillDraft.amount.toFixed(2)
    : '';

  const defaultCategory = editingTransaction
    ? editingTransaction.category
    : prefillDraft && prefillDraft.category
    ? prefillDraft.category
    : type === 'income'
    ? 'Salary'
    : 'Food & groceries';

  const defaultDate = editingTransaction ? editingTransaction.date : todayISO;
  const defaultNote = editingTransaction ? editingTransaction.note : '';

  const [rawAmount, setRawAmount] = useState<string>(defaultAmount);
  const [isEditingAmount, setIsEditingAmount] = useState(!editingTransaction && !prefillDraft);
  const [category, setCategory] = useState<string>(defaultCategory);
  const [date, setDate] = useState<string>(defaultDate);
  const [note, setNote] = useState<string>(defaultNote);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Backdated warning modal state
  const [pendingBackdatedDate, setPendingBackdatedDate] = useState<string | null>(null);
  const [backdatedConfirmedForDate, setBackdatedConfirmedForDate] = useState<string | null>(
    editingTransaction && editingTransaction.date < todayISO ? editingTransaction.date : null
  );
  const [confirmOnSaveModal, setConfirmOnSaveModal] = useState(false);

  // Debit balance warning modal state (when an expense causes balance to go < 0 Dr.)
  const [debitWarningModalOpen, setDebitWarningModalOpen] = useState(false);

  const getFormattedDateDisplay = (isoDate: string) => {
    try {
      const d = new Date(isoDate + 'T00:00:00');
      if (isNaN(d.getTime())) return isoDate;
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoDate;
    }
  };

  const formatAmount = (val: number) => {
    return `${currencyConfig.symbol}${Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const parsedAmount = parseFloat(rawAmount) || 0;

  // Compute current balance for the target date's month (excluding editingTransaction if editing)
  const getMonthBalanceBeforeEntry = (targetIsoDate: string) => {
    const targetDateObj = new Date(targetIsoDate + 'T00:00:00');
    const targetYear = isNaN(targetDateObj.getTime())
      ? new Date().getFullYear()
      : targetDateObj.getFullYear();
    const targetMonth = isNaN(targetDateObj.getTime())
      ? new Date().getMonth()
      : targetDateObj.getMonth();

    const monthTxs = transactions.filter((tx) => {
      if (editingTransaction && tx.id === editingTransaction.id) return false;
      const d = new Date(tx.date + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === targetYear && d.getMonth() === targetMonth;
    });

    const inc = monthTxs
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const exp = monthTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return inc - exp;
  };

  const currentBalanceBeforeEntry = getMonthBalanceBeforeEntry(date);
  const resultingBalanceAfterExpense =
    type === 'expense' ? currentBalanceBeforeEntry - parsedAmount : currentBalanceBeforeEntry + parsedAmount;

  const handleDateChange = (newDate: string) => {
    if (!newDate) return;
    if (newDate > todayISO) {
      setErrorMsg('Future dates are not allowed');
      return;
    }
    setErrorMsg('');

    if (newDate < todayISO && backdatedConfirmedForDate !== newDate) {
      setPendingBackdatedDate(newDate);
    } else {
      setDate(newDate);
    }
  };

  const commitSave = (finalDate: string = date) => {
    onSave({
      type,
      amount: parsedAmount,
      category,
      date: finalDate,
      note: note.trim(),
    });
  };

  const handleSave = () => {
    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0');
      return;
    }
    if (!category.trim()) {
      setErrorMsg('Please select a category');
      return;
    }

    // 1. Check backdated warning first if not yet confirmed
    if (date < todayISO && backdatedConfirmedForDate !== date) {
      setConfirmOnSaveModal(true);
      return;
    }

    // 2. If this is a non-backdated (current date) expense and it causes the balance to become negative (Dr.), show debit warning popup (#16 & #19)
    if (type === 'expense' && date >= todayISO) {
      const balanceBefore = getMonthBalanceBeforeEntry(date);
      const balanceAfter = balanceBefore - parsedAmount;
      if (balanceAfter < 0) {
        setDebitWarningModalOpen(true);
        return;
      }
    }

    commitSave(date);
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-6 pb-12 sm:pb-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6">
        {/* Amount section */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
            Amount in {currencyConfig.code}
          </p>

          <div className="flex items-center justify-center">
            {isEditingAmount ? (
              <div className="inline-flex items-center border-b-2 border-blue-600 dark:border-blue-400 pb-1">
                <span className="text-3xl font-bold text-slate-900 dark:text-slate-100 mr-1">
                  {currencyConfig.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  autoFocus
                  value={rawAmount}
                  onChange={(e) => {
                    setRawAmount(e.target.value);
                    setErrorMsg('');
                  }}
                  onBlur={() => setIsEditingAmount(false)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setIsEditingAmount(false);
                  }}
                  className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 placeholder-slate-300 dark:placeholder-slate-600 bg-transparent w-48 text-center focus:outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingAmount(true)}
                title="Tap to change amount"
                className="group flex items-baseline justify-center text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight hover:text-blue-700 dark:hover:text-blue-400 transition"
              >
                <span>{currencyConfig.symbol}</span>
                <span>
                  {parsedAmount.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 opacity-75 group-hover:opacity-100 transition">
                  Edit
                </span>
              </button>
            )}
          </div>
          {errorMsg && (
            <p className="text-xs font-medium text-rose-500 mt-2">{errorMsg}</p>
          )}
        </div>

        {/* Quick Amount Pills */}
        <div className="flex justify-center gap-2 flex-wrap">
          {[10, 50, 100, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setRawAmount(String(amt));
                setIsEditingAmount(false);
                setErrorMsg('');
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-95 transition"
            >
              +{currencyConfig.symbol}{amt}
            </button>
          ))}
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Category Dropdown */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Category
            </label>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] font-medium shadow-xs text-left hover:border-slate-300 dark:hover:border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <span>{category}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Category Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-56 overflow-y-auto py-2 divide-y divide-slate-50 dark:divide-slate-700/50 animate-in fade-in zoom-in-95">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setIsCategoryOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-700 transition"
                  >
                    <span>{cat}</span>
                    {category === cat && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Picker (defaults to today) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">
                Date
              </label>
              {date < todayISO && (
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                  Backdated entry
                </span>
              )}
            </div>
            <div className="relative">
              <input
                type="date"
                value={date}
                max={todayISO}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-11"
              />
              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500 dark:text-slate-400">
                <Calendar className="w-5 h-5 stroke-[1.8]" />
              </div>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 pl-1">
              {getFormattedDateDisplay(date)}
            </p>
          </div>

          {/* Note Input (blank by default) */}
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Note
            </label>
            <input
              type="text"
              placeholder=""
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-6 mt-6">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm"
        >
          {editingTransaction
            ? 'Update record'
            : type === 'income'
            ? 'Save income'
            : 'Save expense'}
        </button>
      </div>

      {/* Backdated Transaction Warning Popup */}
      {(pendingBackdatedDate || confirmOnSaveModal) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Backdated Transaction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              You selected{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {getFormattedDateDisplay(pendingBackdatedDate || date)}
              </span>
              , which is earlier than today. Do you still want to proceed with this backdated entry?
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setPendingBackdatedDate(null);
                  setConfirmOnSaveModal(false);
                }}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const targetDate = pendingBackdatedDate || date;
                  setDate(targetDate);
                  setBackdatedConfirmedForDate(targetDate);
                  setPendingBackdatedDate(null);
                  if (confirmOnSaveModal) {
                    setConfirmOnSaveModal(false);
                    // Backdated entries do not require the Dr. balance warning (#19)
                    commitSave(targetDate);
                  }
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Debit Balance Warning Popup on Save (#16) */}
      {debitWarningModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              Balance Will Go to Debit (Dr.)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {currentBalanceBeforeEntry > 0 ? (
                <>
                  Your available balance is{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatAmount(currentBalanceBeforeEntry)}
                  </span>
                  . Saving this expense of{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatAmount(parsedAmount)}
                  </span>{' '}
                  will move your balance into a debit figure of{' '}
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatAmount(Math.abs(resultingBalanceAfterExpense))} Dr.
                  </span>{' '}
                  Do you want to continue?
                </>
              ) : (
                <>
                  Saving this expense of{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatAmount(parsedAmount)}
                  </span>{' '}
                  will result in a debit balance of{' '}
                  <span className="font-bold text-rose-600 dark:text-rose-400">
                    {formatAmount(Math.abs(resultingBalanceAfterExpense))} Dr.
                  </span>{' '}
                  Do you want to continue?
                </>
              )}
            </p>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setDebitWarningModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebitWarningModalOpen(false);
                  commitSave(date);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
