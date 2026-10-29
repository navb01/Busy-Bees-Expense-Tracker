import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Edit3,
  MessageSquare,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  AppSettings,
  CURRENCY_CONFIGS,
  DetectedSmsTransaction,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Transaction,
  TransactionType,
} from '../types';
import { getTodayISO } from '../services/storage';

interface SmsDetectionPopupProps {
  queue: DetectedSmsTransaction[];
  transactions: Transaction[];
  settings: AppSettings;
  onSaveAsIs: (
    itemId: string,
    txData: {
      type: TransactionType;
      amount: number;
      category: string;
      date: string;
      note: string;
    }
  ) => void;
  onEditItem: (
    itemId: string,
    draft: {
      type: TransactionType;
      amount: number;
      category: string;
    }
  ) => void;
  onDismissItem: (itemId: string) => void;
}

export const SmsDetectionPopup: React.FC<SmsDetectionPopupProps> = ({
  queue,
  transactions,
  settings,
  onSaveAsIs,
  onEditItem,
  onDismissItem,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('Shopping');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [debitWarningOpen, setDebitWarningOpen] = useState(false);

  const safeIndex = queue.length > 0 ? Math.min(activeIndex, queue.length - 1) : 0;
  const currentItem = queue[safeIndex] || null;

  useEffect(() => {
    if (!currentItem) return;
    setSelectedType(currentItem.type);
    setSelectedCategory(currentItem.type === 'income' ? 'Salary' : 'Shopping');
    setCategoryDropdownOpen(false);
    setDebitWarningOpen(false);
  }, [currentItem?.id]);

  if (!currentItem) return null;

  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;
  const categories = selectedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const todayISO = getTodayISO();

  const formatAmount = (val: number) => {
    return `${currencyConfig.symbol}${Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatDetectedTime = (timestamp: number) => {
    try {
      const d = new Date(timestamp);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Just now';
    }
  };

  const getCurrentMonthBalance = () => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const monthTxs = transactions.filter((tx) => {
      const d = new Date(tx.date + 'T00:00:00');
      if (isNaN(d.getTime())) return false;
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });

    const inc = monthTxs
      .filter((tx) => tx.type === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const exp = monthTxs
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0);

    return inc - exp;
  };

  const balanceBefore = getCurrentMonthBalance();
  const balanceAfterExpense = balanceBefore - currentItem.amount;

  const handleToggleType = (nextType: TransactionType) => {
    if (nextType === selectedType) return;
    setSelectedType(nextType);
    setSelectedCategory(nextType === 'income' ? 'Salary' : 'Shopping');
    setCategoryDropdownOpen(false);
    setDebitWarningOpen(false);
  };

  const commitQuickSave = () => {
    onSaveAsIs(currentItem.id, {
      type: selectedType,
      amount: currentItem.amount,
      category: selectedCategory,
      date: todayISO,
      note: '',
    });
    setDebitWarningOpen(false);
  };

  const handleSaveAsIsClick = () => {
    if (selectedType === 'expense' && balanceAfterExpense < 0) {
      setDebitWarningOpen(true);
      return;
    }
    commitQuickSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200/90 dark:border-slate-700 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
        {/* Truecaller-style Top Banner */}
        <div
          className={`px-5 py-3.5 flex items-center justify-between ${
            selectedType === 'expense'
              ? 'bg-gradient-to-r from-[#2357A4] to-[#1D4A8C] text-white'
              : 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Transaction Detected
                </span>
              </div>
              <p className="text-[11px] text-white/80">
                Detected at {formatDetectedTime(currentItem.detectedAt)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {queue.length > 1 && (
              <div className="flex items-center bg-black/20 rounded-full px-2 py-0.5 text-[11px] font-semibold mr-1">
                <button
                  type="button"
                  onClick={() => setActiveIndex(Math.max(0, safeIndex - 1))}
                  disabled={safeIndex === 0}
                  className="p-0.5 disabled:opacity-40 hover:text-white/90"
                  title="Previous detected transaction"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-1">
                  {safeIndex + 1} / {queue.length}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveIndex(Math.min(queue.length - 1, safeIndex + 1))}
                  disabled={safeIndex === queue.length - 1}
                  className="p-0.5 disabled:opacity-40 hover:text-white/90"
                  title="Next detected transaction"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => onDismissItem(currentItem.id)}
              className="p-1.5 rounded-full hover:bg-white/15 transition"
              title="Dismiss"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Privacy Reassurance Strip */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
              Only <strong>Debit/Credit</strong> &amp; <strong>Amount</strong> captured. Zero bank info stored.
            </span>
          </div>

          {!debitWarningOpen ? (
            <>
              {/* Detected Amount & Debit/Credit Status */}
              <div className="text-center py-2">
                <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-slate-100 dark:bg-slate-700/70 mb-2.5">
                  <button
                    type="button"
                    onClick={() => handleToggleType('expense')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
                      selectedType === 'expense'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Debit (Expense)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleType('income')}
                    className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition ${
                      selectedType === 'income'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <ArrowDownLeft className="w-3.5 h-3.5" />
                    <span>Credit (Income)</span>
                  </button>
                </div>

                <div className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
                  {formatAmount(currentItem.amount)}
                </div>
              </div>

              {/* Quick Category Dropdown inside Popup */}
              <div className="relative">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="w-full flex items-center justify-between px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 transition"
                >
                  <span>{selectedCategory}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      categoryDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {categoryDropdownOpen && (
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-44 overflow-y-auto py-1.5 divide-y divide-slate-50 dark:divide-slate-700/40">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2 text-left text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-700 transition"
                      >
                        <span>{cat}</span>
                        {selectedCategory === cat && (
                          <Check className="w-3.5 h-3.5 text-[#2357A4] dark:text-blue-400" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Equal-Sized Action Buttons (L -> R: Save, Edit, Ignore) */}
              <div className="pt-1 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleSaveAsIsClick}
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-xs font-semibold shadow-sm active:scale-[0.99] transition"
                >
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>Save</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onEditItem(currentItem.id, {
                      type: selectedType,
                      amount: currentItem.amount,
                      category: selectedCategory,
                    })
                  }
                  className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-[#2357A4]/30 dark:border-blue-400/30 bg-blue-50/60 dark:bg-blue-950/40 text-[#2357A4] dark:text-blue-300 text-xs font-semibold hover:bg-blue-100/70 dark:hover:bg-blue-900/50 transition"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDismissItem(currentItem.id)}
                  className="w-full flex items-center justify-center py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  <span>Ignore</span>
                </button>
              </div>
            </>
          ) : (
            /* Inline Debit Balance (Dr.) Warning when quick-saving an expense that makes balance < 0 */
            <div className="text-center py-2 space-y-3 animate-in fade-in zoom-in-95">
              <div className="w-11 h-11 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Balance Will Go to Debit (Dr.)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Saving this expense of{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatAmount(currentItem.amount)}
                </span>{' '}
                will result in a debit balance of{' '}
                <span className="font-bold text-rose-600 dark:text-rose-400">
                  {formatAmount(Math.abs(balanceAfterExpense))} Dr.
                </span>{' '}
                Do you want to continue?
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDebitWarningOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitQuickSave}
                  className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-xs font-semibold transition"
                >
                  Continue &amp; Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
