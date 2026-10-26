import React, { useState } from 'react';
import { CheckCircle2, ChevronDown } from 'lucide-react';
import { AppSettings, Transaction } from '../../types';
import {
  DateRangeOption,
  downloadCSV,
  filterTransactionsByRange,
  generateCSV,
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const rangeLabels: Record<DateRangeOption, string> = {
    this_month: 'This month',
    quarter: 'Quarter',
    year: 'Year',
    all_time: 'All time',
  };

  const filtered = filterTransactionsByRange(transactions, dateRange);

  // Compute date range span string e.g. "October 1–17, 2026 · Income & expenses"
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

  const handleExport = () => {
    setIsExporting(true);
    setSuccessMessage(null);

    try {
      if (fileFormat === 'csv') {
        const csv = generateCSV(filtered, settings.currency);
        const filename = `busy_bees_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadCSV(filename, csv);
        setSuccessMessage(`Successfully exported ${filtered.length} transactions as CSV.`);
      } else {
        printOrSavePDF(filtered, settings.currency, rangeLabels[dateRange]);
        setSuccessMessage('Opened formatted report for printing / PDF saving.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6">
        <p className="text-slate-500 text-sm leading-relaxed">
          Take your transactions with you. Choose a date range and file format.
        </p>

        {/* Date range picker */}
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">
            Date range
          </label>
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as DateRangeOption)}
              className="w-full appearance-none px-4 py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-[15px] font-medium shadow-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 pr-10 cursor-pointer"
            >
              <option value="this_month">This month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
              <option value="all_time">All time</option>
            </select>
            <div className="absolute right-4 top-4 pointer-events-none text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* FILE FORMAT */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">
            File format
          </label>

          <div className="grid grid-cols-2 gap-3">
            {/* CSV Option Card */}
            <button
              type="button"
              onClick={() => setFileFormat('csv')}
              className={`p-4 rounded-2xl flex items-center justify-between transition border-2 ${
                fileFormat === 'csv'
                  ? 'border-[#2357A4] bg-blue-50/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="font-semibold text-sm text-slate-900">CSV</span>
              {fileFormat === 'csv' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2357A4] fill-blue-50" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
              )}
            </button>

            {/* PDF Option Card */}
            <button
              type="button"
              onClick={() => setFileFormat('pdf')}
              className={`p-4 rounded-2xl flex items-center justify-between transition border-2 ${
                fileFormat === 'pdf'
                  ? 'border-[#2357A4] bg-blue-50/20 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <span className="font-semibold text-sm text-slate-900">PDF</span>
              {fileFormat === 'pdf' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2357A4] fill-blue-50" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-slate-300" />
              )}
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-2">
            {fileFormat === 'csv'
              ? 'CSV works with Excel and Google Sheets.'
              : 'PDF is formatted for sharing, archiving, and printing.'}
          </p>
        </div>

        {/* Summary Card matching Figma screen 7 */}
        <div className="bg-[#EDF2F7]/70 rounded-2xl p-5 border border-slate-200/50">
          <div className="text-[15px] font-bold text-slate-900">
            {filtered.length} {filtered.length === 1 ? 'transaction' : 'transactions'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {getDateSpanLabel()}
          </div>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          Only your transaction details are included. Choose where to save or share your file next.
        </p>

        {successMessage && (
          <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-xl border border-emerald-200 animate-in fade-in">
            {successMessage}
          </div>
        )}
      </div>

      {/* Export Action Button */}
      <div className="pt-6 mt-6">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="w-full py-4 rounded-xl text-white font-semibold text-base bg-[#2357A4] hover:bg-[#1D4A8C] active:scale-[0.99] transition shadow-sm disabled:opacity-50"
        >
          {fileFormat === 'csv' ? 'Export CSV' : 'Export PDF'}
        </button>
      </div>
    </div>
  );
};
