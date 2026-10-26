import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Trash2, Edit3, ArrowDownRight, ArrowUpRight, Search, Calendar } from 'lucide-react';
import { AppSettings, CURRENCY_CONFIGS, Transaction } from '../../types';

interface DashboardScreenProps {
  transactions: Transaction[];
  settings: AppSettings;
  onNavigateIncome: () => void;
  onNavigateExpense: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  transactions,
  settings,
  onNavigateIncome,
  onNavigateExpense,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const now = new Date();
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<'today' | 'month'>('today');

  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  // Monthly transactions for the top summary cards
  const monthlyTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.date + 'T00:00:00');
    if (isNaN(txDate.getTime())) return false;
    return txDate.getFullYear() === selectedYear && txDate.getMonth() === selectedMonth;
  });

  const totalIncome = monthlyTransactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = monthlyTransactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  // Current Day's transactions
  const todayTransactions = transactions.filter((tx) => tx.date === todayISO);

  // Choose which transactions to display based on viewScope
  const activeScopeTransactions = viewScope === 'today' ? todayTransactions : monthlyTransactions;

  // Search filter
  const displayedTransactions = (searchQuery.trim()
    ? activeScopeTransactions.filter(
        (t) =>
          t.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.note.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeScopeTransactions
  ).sort((a, b) => b.createdAt - a.createdAt);

  const formatAmount = (val: number) => {
    return `${currencyConfig.symbol}${val.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formattedToday = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex-1 px-5 py-6 pb-24 overflow-y-auto max-w-lg mx-auto w-full">
      {/* Month Navigator & Summary Card Container */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm transition">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-600">
            {monthNames[selectedMonth]} {selectedYear} summary
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              aria-label="Previous month"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              aria-label="Next month"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Side-by-side tiles matching Figma screen 1 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Income box */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="text-xs font-medium text-slate-500 mb-1">Income</div>
            <div className="text-[20px] font-bold text-slate-900 tracking-tight truncate">
              {formatAmount(totalIncome)}
            </div>
          </div>

          {/* Expense box */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="text-xs font-medium text-slate-500 mb-1">Expense</div>
            <div className="text-[20px] font-bold text-slate-900 tracking-tight truncate">
              {formatAmount(totalExpense)}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons matching Figma screen 1 */}
      <div className="mt-6 space-y-3">
        <button
          onClick={onNavigateIncome}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2"
        >
          <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
          <span>Income</span>
        </button>

        <button
          onClick={onNavigateExpense}
          className="w-full py-4 rounded-xl text-slate-800 font-semibold text-base bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="w-5 h-5 text-slate-600 stroke-[2.5]" />
          <span>Expense</span>
        </button>
      </div>

      {/* Current Day's Transactions Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800 tracking-tight">
              {viewScope === 'today' ? "Today's Transactions" : `${monthNames[selectedMonth]} Transactions`}
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-[#2357A4] border border-blue-100">
              {displayedTransactions.length}
            </span>
          </div>

          {/* Scope Toggle: Today vs Month */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setViewScope('today')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewScope === 'today'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setViewScope('month')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewScope === 'month'
                  ? 'bg-slate-200 text-slate-900 font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Date Subtitle */}
        <p className="text-xs text-slate-400 mb-3 px-1 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>
            {viewScope === 'today' ? `Recorded on ${formattedToday}` : `All entries for ${monthNames[selectedMonth]} ${selectedYear}`}
          </span>
        </p>

        {displayedTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl p-7 border border-slate-200/80 text-center shadow-xs">
            <p className="text-slate-600 text-sm font-medium">
              {viewScope === 'today' ? "No transactions logged today." : "No records for this month."}
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Tap Income or Expense above to record your money in 3 seconds.
            </p>
            {viewScope === 'today' && monthlyTransactions.length > 0 && (
              <button
                onClick={() => setViewScope('month')}
                className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
              >
                View all {monthlyTransactions.length} records from this month →
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200/80 divide-y divide-slate-100 overflow-hidden shadow-xs">
            {displayedTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-5 h-5 stroke-[2.2]" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 text-sm truncate">
                        {tx.category}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {formattedDate} {tx.note ? `· ${tx.note}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    <div
                      className={`font-semibold text-sm ${
                        isIncome ? 'text-emerald-600' : 'text-slate-900'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {currencyConfig.symbol}
                      {tx.amount.toFixed(2)}
                    </div>

                    {/* Edit & Delete actions */}
                    <button
                      onClick={() => onEditTransaction(tx)}
                      title="Edit"
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteId(tx.id)}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white rounded-2xl p-5 shadow-xl border border-slate-100 text-center animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-slate-900 text-base">Delete record?</h3>
            <p className="text-xs text-slate-500 mt-2">
              This transaction will be permanently removed from your device.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDeleteTransaction(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-medium hover:bg-rose-700"
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
