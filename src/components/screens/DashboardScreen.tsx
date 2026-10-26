import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  X,
  AlertTriangle,
  Gauge,
} from 'lucide-react';
import { AppSettings, CURRENCY_CONFIGS, Transaction } from '../../types';
import { getTodayISO, storage } from '../../services/storage';

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
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayISO = getTodayISO();

  // Installation month/year boundary (or earliest backdated transaction)
  const installDateInfo = storage.getInstallDate();
  const minYear = installDateInfo.year;
  const minMonth = installDateInfo.month;

  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [viewScope, setViewScope] = useState<'today' | 'month'>('today');

  // Pop-up modal state for clickable Income / Expense summary counters (#15)
  const [summaryModalType, setSummaryModalType] = useState<'income' | 'expense' | null>(null);

  // Warning pop-up state when clicking Expense at 0 or Debit balance (#16)
  const [zeroBalanceWarningOpen, setZeroBalanceWarningOpen] = useState(false);

  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  // Check boundaries: cannot move before installation/earliest month, cannot move to future month
  const canGoPrev =
    selectedYear > minYear || (selectedYear === minYear && selectedMonth > minMonth);
  const canGoNext =
    selectedYear < currentYear || (selectedYear === currentYear && selectedMonth < currentMonth);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
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

  const monthlyIncomeList = monthlyTransactions
    .filter((tx) => tx.type === 'income')
    .sort((a, b) => b.createdAt - a.createdAt);

  const monthlyExpenseList = monthlyTransactions
    .filter((tx) => tx.type === 'expense')
    .sort((a, b) => b.createdAt - a.createdAt);

  const totalIncome = monthlyIncomeList.reduce((sum, tx) => sum + tx.amount, 0);
  const totalExpense = monthlyExpenseList.reduce((sum, tx) => sum + tx.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const isDebit = netBalance < 0;

  // Balance Meter calculation (#14):
  // Starts at 100% (green) when expenses are 0 and transitions towards 0% (red) as balance decreases
  const balanceRatio =
    totalIncome > 0
      ? Math.max(0, Math.min(1, netBalance / totalIncome))
      : netBalance < 0
      ? 0
      : 0;

  const balancePercent =
    totalIncome > 0 ? Math.round(balanceRatio * 100) : isDebit ? 0 : 0;

  // Dynamic HSL color from Green (hue 142) -> Yellow/Amber (hue 45) -> Red (hue 0)
  const meterHue = Math.round(balanceRatio * 142);
  const meterColor =
    totalIncome === 0 && totalExpense === 0
      ? '#10b981'
      : isDebit || balanceRatio === 0
      ? '#ef4444'
      : `hsl(${meterHue}, 82%, 42%)`;

  // Current Day's transactions
  const todayTransactions = transactions.filter((tx) => tx.date === todayISO);

  // Choose which transactions to display based on viewScope
  const displayedTransactions = (
    viewScope === 'today' ? todayTransactions : monthlyTransactions
  ).sort((a, b) => b.createdAt - a.createdAt);

  const formatAmount = (val: number) => {
    return `${currencyConfig.symbol}${Math.abs(val).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const formatBalanceDisplay = (val: number) => {
    if (val < 0) {
      return `${formatAmount(Math.abs(val))} Dr.`;
    }
    return formatAmount(val);
  };

  const handleExpenseButtonClick = () => {
    if (netBalance <= 0) {
      setZeroBalanceWarningOpen(true);
    } else {
      onNavigateExpense();
    }
  };

  const formattedToday = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const modalEntries =
    summaryModalType === 'income'
      ? monthlyIncomeList
      : summaryModalType === 'expense'
      ? monthlyExpenseList
      : [];

  return (
    <div className="flex-1 px-5 py-6 pb-24 overflow-y-auto max-w-lg mx-auto w-full">
      {/* Month Navigator & Summary Card Container */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl p-5 border border-slate-200/90 dark:border-slate-700/80 shadow-sm transition">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
            {monthNames[selectedMonth]} {selectedYear} summary
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-25 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              aria-label="Next month"
              className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition disabled:opacity-25 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Balance Meter (#14) */}
        <div className="mb-3.5 bg-slate-50/90 dark:bg-slate-900/80 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Gauge
                className="w-4 h-4 shrink-0 transition-colors duration-300"
                style={{ color: meterColor }}
              />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Balance Meter
              </span>
            </div>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isDebit
                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300'
                  : 'bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {isDebit
                ? 'DEBIT (Dr.)'
                : totalIncome > 0
                ? `${balancePercent}% left`
                : '0%'}
            </span>
          </div>

          {/* Net Balance Figure (never cropped, shows Dr. when negative) */}
          <div
            className={`text-xl sm:text-2xl font-extrabold tracking-tight break-words mb-3 ${
              isDebit
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-900 dark:text-slate-100'
            }`}
          >
            {formatBalanceDisplay(netBalance)}
          </div>

          {/* Gauge Meter Track with Scale Spectrum & Indicator */}
          <div className="relative">
            {/* Meter background track with subtle tick divisions */}
            <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden relative shadow-inner">
              {isDebit ? (
                /* Full red warning bar when in Debit (Dr.) */
                <div
                  className="h-full w-full transition-all duration-500 rounded-full"
                  style={{ backgroundColor: '#ef4444' }}
                />
              ) : (
                /* Dynamic fill bar transitioning from Green (100%) -> Amber -> Red (0%) */
                <div
                  className="h-full transition-all duration-500 rounded-full"
                  style={{
                    width: `${totalIncome > 0 ? Math.max(4, balancePercent) : 0}%`,
                    backgroundColor: meterColor,
                  }}
                />
              )}

              {/* Meter gauge tick marks overlay */}
              <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((tick) => (
                  <div
                    key={tick}
                    className="h-full w-[1px] bg-white/35 dark:bg-slate-900/35"
                  />
                ))}
              </div>
            </div>

            {/* Meter scale labels */}
            <div className="flex justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-1 px-0.5">
              <span className="text-rose-500 dark:text-rose-400">Low / Dr.</span>
              <span>50%</span>
              <span className="text-emerald-600 dark:text-emerald-400">Full (100%)</span>
            </div>
          </div>
        </div>

        {/* Stacked Income and Expense Counters (#13 & #15) */}
        <div className="flex flex-col gap-3">
          {/* Clickable Income Counter Box */}
          <button
            type="button"
            onClick={() => setSummaryModalType('income')}
            className="w-full text-left bg-white dark:bg-slate-900/70 hover:bg-blue-50/40 dark:hover:bg-slate-700/60 active:scale-[0.99] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Income ({monthlyIncomeList.length})
              </span>
              <span className="text-[11px] font-medium text-[#2357A4] dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                View entries
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#2357A4] dark:text-blue-400 tracking-tight break-words">
              {formatAmount(totalIncome)}
            </div>
          </button>

          {/* Clickable Expense Counter Box */}
          <button
            type="button"
            onClick={() => setSummaryModalType('expense')}
            className="w-full text-left bg-white dark:bg-slate-900/70 hover:bg-blue-50/40 dark:hover:bg-slate-700/60 active:scale-[0.99] rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Expense ({monthlyExpenseList.length})
              </span>
              <span className="text-[11px] font-medium text-[#2357A4] dark:text-blue-400 group-hover:underline flex items-center gap-0.5">
                View entries
                <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-bold text-[#2357A4] dark:text-blue-400 tracking-tight break-words">
              {formatAmount(totalExpense)}
            </div>
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 space-y-3">
        <button
          onClick={onNavigateIncome}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2"
        >
          <ArrowDownRight className="w-5 h-5 stroke-[2.5]" />
          <span>Income</span>
        </button>

        <button
          onClick={handleExpenseButtonClick}
          className="w-full py-4 rounded-xl text-[#2357A4] dark:text-slate-100 font-semibold text-base bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/80 active:scale-[0.99] transition shadow-sm flex items-center justify-center gap-2"
        >
          <ArrowUpRight className="w-5 h-5 text-[#2357A4] dark:text-slate-300 stroke-[2.5]" />
          <span>Expense</span>
        </button>
      </div>

      {/* Current Day's Transactions Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">
              {viewScope === 'today' ? "Today's Transactions" : `${monthNames[selectedMonth]} Transactions`}
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 text-[#2357A4] dark:text-blue-400 border border-blue-100 dark:border-blue-900">
              {displayedTransactions.length}
            </span>
          </div>

          {/* Scope Toggle: Today vs Month */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              onClick={() => setViewScope('today')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewScope === 'today'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setViewScope('month')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                viewScope === 'month'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              This Month
            </button>
          </div>
        </div>

        {/* Date Subtitle */}
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 px-1 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
          <span>
            {viewScope === 'today' ? `Recorded on ${formattedToday}` : `All entries for ${monthNames[selectedMonth]} ${selectedYear}`}
          </span>
        </p>

        {displayedTransactions.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-7 border border-slate-200/80 dark:border-slate-700/80 text-center shadow-xs">
            <p className="text-slate-600 dark:text-slate-300 text-sm font-medium">
              {viewScope === 'today' ? "No transactions logged today." : "No records for this month."}
            </p>
            <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">
              Tap Income or Expense above to record your money in 3 seconds.
            </p>
            {viewScope === 'today' && monthlyTransactions.length > 0 && (
              <button
                onClick={() => setViewScope('month')}
                className="mt-3 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                View all {monthlyTransactions.length} records from this month →
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden shadow-xs">
            {displayedTransactions.map((tx) => {
              const isIncome = tx.type === 'income';
              const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3.5 hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isIncome
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                          : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isIncome ? (
                        <ArrowDownRight className="w-5 h-5 stroke-[2.2]" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5 stroke-[2.2]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                        {tx.category}
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-400 truncate">
                        {formattedDate} {tx.note ? `· ${tx.note}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-3 shrink-0">
                    <div
                      className={`font-semibold text-sm ${
                        isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'
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
                      className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={() => setConfirmDeleteId(tx.id)}
                      title="Delete"
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
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

      {/* Monthly Income / Expense Entries Pop-up Modal (#15) */}
      {summaryModalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[82vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {monthNames[selectedMonth]} {selectedYear}{' '}
                  {summaryModalType === 'income' ? 'Income' : 'Expenses'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total:{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatAmount(summaryModalType === 'income' ? totalIncome : totalExpense)}
                  </span>{' '}
                  · {modalEntries.length} {modalEntries.length === 1 ? 'entry' : 'entries'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSummaryModalType(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 my-3 divide-y divide-slate-100 dark:divide-slate-700/60">
              {modalEntries.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    No {summaryModalType} entries recorded in {monthNames[selectedMonth]} {selectedYear}.
                  </p>
                </div>
              ) : (
                modalEntries.map((tx) => {
                  const isIncome = tx.type === 'income';
                  const formattedDate = new Date(tx.date + 'T00:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  });

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3 px-1 hover:bg-slate-50/70 dark:hover:bg-slate-700/30 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isIncome
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                              : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isIncome ? (
                            <ArrowDownRight className="w-4 h-4 stroke-[2.2]" />
                          ) : (
                            <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">
                            {tx.category}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-400 truncate">
                            {formattedDate} {tx.note ? `· ${tx.note}` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 pl-2 shrink-0">
                        <span
                          className={`font-semibold text-sm ${
                            isIncome
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {currencyConfig.symbol}
                          {tx.amount.toLocaleString('en-IN', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSummaryModalType(null);
                            onEditTransaction(tx);
                          }}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <button
              type="button"
              onClick={() => setSummaryModalType(null)}
              className="w-full py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Zero / Debit Balance Warning Pop-up (#16) */}
      {zeroBalanceWarningOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-2xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
              {netBalance === 0 ? 'Balance is Zero' : 'Balance in Debit (Dr.)'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              {netBalance === 0
                ? `Your current balance is ${formatAmount(0)}. Adding an expense will move your balance into a debit figure (Dr.). Do you want to continue?`
                : `Your current balance is ${formatBalanceDisplay(netBalance)}. Adding another expense will increase your debit figure (Dr.). Do you want to continue?`}
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setZeroBalanceWarningOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setZeroBalanceWarningOpen(false);
                  onNavigateExpense();
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-sm font-semibold transition"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-xl border border-slate-100 dark:border-slate-700 text-center animate-in fade-in zoom-in-95">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">Delete record?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              This transaction will be permanently removed from your device.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
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
