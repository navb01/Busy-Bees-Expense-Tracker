import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';
import {
  AppSettings,
  CURRENCY_CONFIGS,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  Transaction,
  TransactionType,
} from '../../types';

interface AddTransactionScreenProps {
  type: TransactionType;
  editingTransaction?: Transaction | null;
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
  editingTransaction,
  settings,
  onSave,
  onCancel,
}) => {
  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;
  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  // Initialize values
  const defaultAmount = editingTransaction
    ? editingTransaction.amount.toFixed(2)
    : type === 'income'
    ? '2450.00'
    : '42.50';

  const defaultCategory = editingTransaction
    ? editingTransaction.category
    : type === 'income'
    ? 'Salary'
    : 'Food & groceries';

  const defaultDate = editingTransaction ? editingTransaction.date : '2026-10-17';

  const defaultNote = editingTransaction
    ? editingTransaction.note
    : type === 'income'
    ? 'October salary'
    : 'Weekly groceries';

  const [rawAmount, setRawAmount] = useState<string>(defaultAmount);
  const [isEditingAmount, setIsEditingAmount] = useState(false);
  const [category, setCategory] = useState<string>(defaultCategory);
  const [date, setDate] = useState<string>(defaultDate);
  const [note, setNote] = useState<string>(defaultNote);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Format date for display: "October 17, 2026"
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

  const parsedAmount = parseFloat(rawAmount) || 0;

  const handleSave = () => {
    if (parsedAmount <= 0) {
      setErrorMsg('Please enter a valid amount greater than 0');
      return;
    }
    if (!category.trim()) {
      setErrorMsg('Please select a category');
      return;
    }

    onSave({
      type,
      amount: parsedAmount,
      category,
      date,
      note,
    });
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6">
        {/* Amount section matching Figma screen 3 & 6 */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            Amount in {currencyConfig.code}
          </p>

          <div className="flex items-center justify-center">
            {isEditingAmount ? (
              <div className="inline-flex items-center border-b-2 border-blue-600 pb-1">
                <span className="text-3xl font-bold text-slate-900 mr-1">
                  {currencyConfig.symbol}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
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
                  className="text-4xl sm:text-5xl font-extrabold text-slate-900 bg-transparent w-44 text-center focus:outline-none"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingAmount(true)}
                title="Tap to change amount"
                className="group flex items-baseline justify-center text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight hover:text-blue-700 transition"
              >
                <span>{currencyConfig.symbol}</span>
                <span>
                  {parsedAmount.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 opacity-60 group-hover:opacity-100 transition">
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
        <div className="flex justify-center gap-2">
          {[10, 50, 100, 500, 1000].map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => {
                setRawAmount(String(amt));
                setErrorMsg('');
              }}
              className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition"
            >
              +{currencyConfig.symbol}{amt}
            </button>
          ))}
        </div>

        {/* Form Fields matching Figma screen 3 & 6 */}
        <div className="space-y-5">
          {/* Category Dropdown */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Category
            </label>
            <button
              type="button"
              onClick={() => setIsCategoryOpen(!isCategoryOpen)}
              className="w-full flex items-center justify-between px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-[15px] font-medium shadow-xs text-left hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <span>{category}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${isCategoryOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Category Dropdown Menu */}
            {isCategoryOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 z-20 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto py-2 divide-y divide-slate-50 animate-in fade-in zoom-in-95">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategory(cat);
                      setIsCategoryOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-4 py-2.5 text-left text-sm text-slate-800 hover:bg-blue-50/70 transition"
                  >
                    <span>{cat}</span>
                    {category === cat && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Date
            </label>
            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-[15px] font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-11"
              />
              <div className="absolute right-4 top-3.5 pointer-events-none text-slate-500">
                <Calendar className="w-5 h-5 stroke-[1.8]" />
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-1 pl-1">
              {getFormattedDateDisplay(date)}
            </p>
          </div>

          {/* Note Input */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Note
            </label>
            <input
              type="text"
              placeholder={type === 'income' ? 'e.g. October salary' : 'e.g. Weekly groceries'}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-[15px] shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 placeholder-slate-400"
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
    </div>
  );
};
