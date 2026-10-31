import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  AlertTriangle,
  ArrowLeft,
  Download,
} from 'lucide-react';
import { AppSettings, CURRENCY_CONFIGS, Transaction } from '../../types';
import { BusyBeesLogo } from '../BusyBeesLogo';
import {
  DateRangeOption,
  downloadCSV,
  filterTransactionsByRange,
  generateCSV,
  openLastExportedNativeFile,
  printOrSavePDF,
} from '../../services/exportService';

interface ExportScreenProps {
  transactions: Transaction[];
  settings: AppSettings;
}

export const ExportScreen: React.FC<ExportScreenProps> = ({ transactions, settings }) => {
  const [dateRange, setDateRange] = useState<DateRangeOption>('this_month');
  const [fileFormat, setFileFormat] = useState<'csv' | 'pdf'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canOpenSavedFile, setCanOpenSavedFile] = useState(false);

  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;

  const rangeLabels: Record<DateRangeOption, string> = {
    this_month: 'This month',
    quarter: 'Quarter',
    year: 'Year',
    all_time: 'All time',
  };

  const filtered = filterTransactionsByRange(transactions, dateRange);

  const totalIncome = filtered
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = filtered
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const netBalance = totalIncome - totalExpense;

  // Intercept hardware Back button when the Color PDF Preview is open so Back closes the preview cleanly
  useEffect(() => {
    if (!pdfPreviewOpen) return;

    const handleBackInPreview = (evt: Event) => {
      evt.stopImmediatePropagation();
      setPdfPreviewOpen(false);
    };

    window.addEventListener('bb-back-button', handleBackInPreview, true);
    return () => {
      window.removeEventListener('bb-back-button', handleBackInPreview, true);
    };
  }, [pdfPreviewOpen]);

  const getDateSpanLabel = () => {
    if (filtered.length === 0) return 'No transactions in period';
    const dates = filtered.map((t) => new Date(t.date + 'T00:00:00').getTime()).sort((a, b) => a - b);
    const earliest = new Date(dates[0]);
    const latest = new Date(dates[dates.length - 1]);

    const monthName = earliest.toLocaleDateString('en-US', { month: 'long' });
    const year = earliest.getFullYear();
    if (earliest.getMonth() === latest.getMonth() && earliest.getFullYear() === latest.getFullYear()) {
      return `${monthName} ${earliest.getDate()}–${latest.getDate()}, ${year} · Income & expenses`;
    }
    return `${earliest.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · Income & expenses`;
  };

  const handleSavePdfFile = async () => {
    setIsExporting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    setCanOpenSavedFile(false);

    const dateSuffix = new Date().toISOString().slice(0, 10);
    const filename = `busy_bees_${dateRange}_${dateSuffix}.pdf`;

    try {
      const res = await printOrSavePDF(
        filtered,
        settings.currency,
        rangeLabels[dateRange],
        filename
      );
      if (res.saved) {
        setSuccessMessage(`Saved ${filename} (${filtered.length} transactions).`);
        setCanOpenSavedFile(Boolean(res.isNative));
      } else if (!res.cancelled && res.error) {
        setErrorMessage(res.error);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Could not save PDF file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExport = async () => {
    setSuccessMessage(null);
    setErrorMessage(null);
    setCanOpenSavedFile(false);

    if (fileFormat === 'pdf') {
      // Open the color-formatted report preview with BB logo and Save PDF button
      setPdfPreviewOpen(true);
      return;
    }

    setIsExporting(true);
    const dateSuffix = new Date().toISOString().slice(0, 10);

    try {
      const csv = generateCSV(filtered, settings.currency);
      const filename = `busy_bees_${dateRange}_${dateSuffix}.csv`;
      const res = await downloadCSV(filename, csv);
      if (res.saved) {
        setSuccessMessage(`Saved ${filename} (${filtered.length} transactions).`);
        setCanOpenSavedFile(Boolean(res.isNative));
      } else if (!res.cancelled && res.error) {
        setErrorMessage(res.error);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage('Could not export file. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-6 pb-20 sm:pb-8 max-w-lg mx-auto w-full">
      <div className="space-y-6">
        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
          Take your transactions with you. Choose a date range and file format.
        </p>

        {/* Date range picker */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
            Date range
          </label>
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
              className="w-full appearance-none px-4 py-3.5 bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-slate-100 text-[15px] font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10 cursor-pointer"
            >
              <option value="this_month">This month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="all_time">All time</option>
            </select>
            <div className="absolute right-4 top-4 pointer-events-none text-slate-500 dark:text-slate-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* FILE FORMAT */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
            File format
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* CSV Option Card */}
            <button
              type="button"
              onClick={() => setFileFormat('csv')}
              className={`p-4 rounded-2xl flex items-center justify-between transition border-2 ${
                fileFormat === 'csv'
                  ? 'border-[#2357A4] dark:border-blue-400 bg-blue-50/20 dark:bg-blue-950/30 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">CSV</span>
              {fileFormat === 'csv' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2357A4] dark:text-blue-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
              )}
            </button>

            {/* PDF Option Card */}
            <button
              type="button"
              onClick={() => setFileFormat('pdf')}
              className={`p-4 rounded-2xl flex items-center justify-between transition border-2 ${
                fileFormat === 'pdf'
                  ? 'border-[#2357A4] dark:border-blue-400 bg-blue-50/20 dark:bg-blue-950/30 shadow-xs'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">PDF</span>
              {fileFormat === 'pdf' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2357A4] dark:text-blue-400" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600" />
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {fileFormat === 'csv'
              ? 'CSV works with Excel and Google Sheets.'
              : 'PDF is formatted with colors and the Busy Bees logo for sharing and archiving.'}
          </p>
        </div>

        {/* Summary Card */}
        <div className="bg-[#EDF2F7]/70 dark:bg-slate-800/80 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700">
          <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {getDateSpanLabel()}
          </div>
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          Only your transaction details are included. Choose where to save or share your file next.
        </p>

        {errorMessage && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-xs font-medium rounded-xl border border-rose-200 dark:border-rose-800 flex items-start gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 animate-in fade-in">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="truncate">{successMessage}</span>
            </div>
            {canOpenSavedFile && (
              <button
                type="button"
                onClick={openLastExportedNativeFile}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shrink-0 transition"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Export Action Button */}
      <div className="pt-6 mt-6 pb-6 sm:pb-0">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm disabled:opacity-50"
        >
          {isExporting
            ? 'Preparing file...'
            : fileFormat === 'csv'
            ? 'Export CSV'
            : 'Export PDF'}
        </button>
      </div>

      {/* In-App Color-Formatted PDF Report Preview & Save Modal */}
      {pdfPreviewOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-xs animate-in fade-in">
          {/* Fixed Non-Scrolling Top Bar inside Report Preview */}
          <div className="shrink-0 flex items-center justify-between px-4 pt-10 pb-3.5 sm:py-3.5 bg-slate-900 text-white border-b border-slate-800">
            <button
              type="button"
              onClick={() => setPdfPreviewOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold transition active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <span className="text-xs font-semibold text-slate-300 truncate px-2">
              PDF Report Preview · {rangeLabels[dateRange]}
            </span>

            <button
              type="button"
              disabled={isExporting}
              onClick={handleSavePdfFile}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-xs font-semibold shadow-xs transition active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Saving...' : 'Save PDF'}</span>
            </button>
          </div>

          {/* Scrollable Color-Formatted Document Sheet */}
          <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 pb-24">
            <div className="max-w-xl mx-auto bg-white text-slate-800 rounded-2xl shadow-2xl p-5 sm:p-8 border border-slate-200">
              {/* Status feedback inside preview if user saved */}
              {successMessage && (
                <div className="mb-5 p-3 bg-emerald-50 text-emerald-800 text-xs font-medium rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate">{successMessage}</span>
                  </div>
                  {canOpenSavedFile && (
                    <button
                      type="button"
                      onClick={openLastExportedNativeFile}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center gap-1 shrink-0"
                    >
                      <span>Open PDF</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {errorMessage && (
                <div className="mb-5 p-3 bg-rose-50 text-rose-800 text-xs font-medium rounded-xl border border-rose-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Report Header with Royal Blue Title & Rupee-Bee Emblem */}
              <div className="flex items-center justify-between border-b-2 border-[#2357A4] pb-4 mb-5">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-[#2357A4]">
                    Busy Bees Expense Tracker
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Exported: {new Date().toLocaleDateString()} · {rangeLabels[dateRange]}
                  </p>
                </div>
                <div className="shrink-0 ml-3">
                  <BusyBeesLogo
                    variant={settings.logoVariant || 'swoosh'}
                    size={46}
                    animated={false}
                  />
                </div>
              </div>

              {/* 3 Colored Summary Cards */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6">
                <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Total Income
                  </div>
                  <div className="text-xs sm:text-base font-bold text-emerald-600 break-words">
                    +{currencyConfig.symbol}
                    {totalIncome.toFixed(2)}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Total Expense
                  </div>
                  <div className="text-xs sm:text-base font-bold text-rose-600 break-words">
                    -{currencyConfig.symbol}
                    {totalExpense.toFixed(2)}
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl p-2.5 sm:p-3 bg-slate-50">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Net Balance
                  </div>
                  <div
                    className={`text-xs sm:text-base font-bold break-words ${
                      netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {netBalance < 0 ? '-' : ''}
                    {currencyConfig.symbol}
                    {Math.abs(netBalance).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Colored Transactions Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b-2 border-slate-300 text-slate-700">
                      <th className="text-left py-2 px-2 font-semibold">Date</th>
                      <th className="text-left py-2 px-2 font-semibold">Type</th>
                      <th className="text-left py-2 px-2 font-semibold">Category</th>
                      <th className="text-left py-2 px-2 font-semibold">Note</th>
                      <th className="text-right py-2 px-2 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400">
                          No transactions recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 px-2 text-slate-700 whitespace-nowrap">{t.date}</td>
                          <td className="py-2 px-2 whitespace-nowrap">
                            <span
                              className={`font-bold ${
                                t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                              }`}
                            >
                              {t.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-slate-800 font-medium">{t.category}</td>
                          <td className="py-2 px-2 text-slate-500">{t.note || '-'}</td>
                          <td
                            className={`py-2 px-2 text-right font-bold whitespace-nowrap ${
                              t.type === 'income' ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            {t.type === 'income' ? '+' : '-'}
                            {currencyConfig.symbol}
                            {t.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <BusyBeesLogo variant="monogram" size={18} animated={false} />
                <span>Busy Bees Expense Tracker · 100% Offline and Private on your device</span>
              </div>
            </div>

            {/* Bottom Save & Back Buttons with Clearance Above System Navigation Bar */}
            <div className="max-w-xl mx-auto mt-5 pb-6 flex gap-3">
              <button
                type="button"
                onClick={() => setPdfPreviewOpen(false)}
                className="flex-1 py-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition"
              >
                Back to Export
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleSavePdfFile}
                className="flex-1 py-3.5 rounded-xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white font-semibold text-sm shadow-md flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isExporting ? 'Saving...' : 'Save PDF File'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
