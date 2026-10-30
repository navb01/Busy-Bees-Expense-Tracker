import React, { useEffect, useRef, useState } from 'react';
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
  Minimize2,
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

const BUBBLE_SIZE = 68;
const EDGE_MARGIN = 12;

export const SmsDetectionPopup: React.FC<SmsDetectionPopupProps> = ({
  queue,
  transactions,
  settings,
  onSaveAsIs,
  onEditItem,
  onDismissItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<string>('Shopping');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [debitWarningOpen, setDebitWarningOpen] = useState(false);

  // Draggable FB Messenger-style Bubble position state
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>(() => {
    const w = typeof window !== 'undefined' ? window.innerWidth : 390;
    return {
      x: Math.max(EDGE_MARGIN, w - BUBBLE_SIZE - EDGE_MARGIN),
      y: 150,
    };
  });
  const [isDragging, setIsDragging] = useState(false);

  const dragStartRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const safeIndex = queue.length > 0 ? Math.min(activeIndex, queue.length - 1) : 0;
  const currentItem = queue[safeIndex] || null;

  useEffect(() => {
    if (!currentItem) return;
    setSelectedType(currentItem.type);
    setSelectedCategory(currentItem.type === 'income' ? 'Salary' : 'Shopping');
    setCategoryDropdownOpen(false);
    setDebitWarningOpen(false);
  }, [currentItem?.id]);

  // Keep bubble within viewport bounds on window resize / orientation change
  useEffect(() => {
    const handleResize = () => {
      setBubblePos((prev) => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const snappedX =
          prev.x + BUBBLE_SIZE / 2 < w / 2
            ? EDGE_MARGIN
            : Math.max(EDGE_MARGIN, w - BUBBLE_SIZE - EDGE_MARGIN);
        const clampedY = Math.max(64, Math.min(h - BUBBLE_SIZE - 48, prev.y));
        return { x: snappedX, y: clampedY };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const formatCompactAmount = (val: number) => {
    const sign = selectedType === 'income' ? '+' : '-';
    const abs = Math.abs(val);
    if (abs >= 100000) {
      return `${sign}${currencyConfig.symbol}${(abs / 100000).toFixed(1)}L`;
    }
    return `${sign}${currencyConfig.symbol}${abs.toLocaleString('en-IN', {
      maximumFractionDigits: abs % 1 === 0 ? 0 : 2,
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

  // Pointer handlers for FB Messenger-style draggable floating circle bubble
  const handleBubblePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStartRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: bubblePos.x,
      origY: bubblePos.y,
      moved: false,
    };
    setIsDragging(true);
  };

  const handleBubblePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 6) {
      drag.moved = true;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const nextX = Math.max(EDGE_MARGIN, Math.min(w - BUBBLE_SIZE - EDGE_MARGIN, drag.origX + dx));
    const nextY = Math.max(48, Math.min(h - BUBBLE_SIZE - 48, drag.origY + dy));

    setBubblePos({ x: nextX, y: nextY });
  };

  const handleBubblePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    dragStartRef.current = null;
    setIsDragging(false);

    if (!drag.moved) {
      // Clicked without dragging -> expand into full Transaction Detected drawer!
      setIsExpanded(true);
      return;
    }

    // Magnetically snap to nearest left or right screen edge (FB Messenger Chat Head behavior)
    const w = window.innerWidth;
    const h = window.innerHeight;
    const center = bubblePos.x + BUBBLE_SIZE / 2;
    const snappedX =
      center < w / 2 ? EDGE_MARGIN : Math.max(EDGE_MARGIN, w - BUBBLE_SIZE - EDGE_MARGIN);
    const clampedY = Math.max(56, Math.min(h - BUBBLE_SIZE - 48, bubblePos.y));
    setBubblePos({ x: snappedX, y: clampedY });
  };

  // ============================================================================
  // 1. COLLAPSED FB MESSENGER-STYLE DRAGGABLE FLOATING CIRCLE BUBBLE
  // ============================================================================
  if (!isExpanded) {
    const isIncome = selectedType === 'income';
    return (
      <div
        onPointerDown={handleBubblePointerDown}
        onPointerMove={handleBubblePointerMove}
        onPointerUp={handleBubblePointerUp}
        onPointerCancel={handleBubblePointerUp}
        style={{
          left: `${bubblePos.x}px`,
          top: `${bubblePos.y}px`,
          transition: isDragging
            ? 'none'
            : 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 200ms ease-out',
        }}
        className="fixed z-50 flex flex-col items-center touch-none select-none cursor-grab active:cursor-grabbing group"
        role="button"
        aria-label="Transaction Detected Floating Bubble — Drag to move or tap to expand"
      >
        <div className="relative flex items-center justify-center">
          {/* Outer Pulsing Attention Halo */}
          <span
            className={`absolute inset-0 rounded-full opacity-55 animate-ping ${
              isIncome ? 'bg-emerald-400' : 'bg-blue-400'
            }`}
          />

          {/* Floating Circle Chat-Head Sphere */}
          <div
            className={`relative w-16 h-16 rounded-full flex flex-col items-center justify-center text-white border-2 border-white shadow-[0_10px_28px_rgba(0,0,0,0.45)] transition-transform duration-150 group-hover:scale-105 group-active:scale-95 ${
              isIncome
                ? 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700'
                : 'bg-gradient-to-br from-[#2E69C2] via-[#2357A4] to-[#153B75]'
            }`}
          >
            <MessageSquare className="w-5 h-5 text-white mb-0.5 stroke-[2.3]" />
            <span className="text-[9px] font-extrabold uppercase tracking-wider leading-none text-white/95">
              {isIncome ? 'CREDIT' : 'DEBIT'}
            </span>
          </div>

          {/* Unread Transaction Count Badge (Top-Right) */}
          <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-rose-600 border-2 border-white text-white text-[11px] font-extrabold flex items-center justify-center shadow-md">
            {queue.length}
          </div>
        </div>

        {/* Floating Amount Pill Underneath Circle */}
        <div className="mt-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/95 border border-slate-700 text-white text-[11px] font-extrabold shadow-lg whitespace-nowrap">
          {formatCompactAmount(currentItem.amount)}
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. EXPANDED TRANSACTION DETECTED DRAWER (WHEN BUBBLE IS CLICKED)
  // ============================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-t-[32px] sm:rounded-3xl shadow-[0_-14px_45px_rgba(0,0,0,0.38)] border-t sm:border border-slate-200/90 dark:border-slate-700 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-6 duration-200">
        {/* Colored Top Drawer Header */}
        <div
          className={`px-6 pt-3.5 pb-5 transition-colors duration-200 ${
            selectedType === 'expense'
              ? 'bg-gradient-to-br from-[#1B4B91] via-[#2357A4] to-[#153B75] text-white'
              : 'bg-gradient-to-br from-emerald-600 via-emerald-600 to-teal-700 text-white'
          }`}
        >
          {/* Drawer Drag Handle Bar (clicking collapses back to floating bubble) */}
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="w-full flex justify-center pb-3 focus:outline-none"
            title="Minimize to floating bubble"
          >
            <span className="w-11 h-1.5 rounded-full bg-white/35" />
          </button>

          {/* Top Bar: Badge + Timestamp + Queue Pager + Minimize to Bubble + Close */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 shadow-xs">
                <MessageSquare className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Transaction Detected
                  </span>
                </div>
                <p className="text-[11px] text-white/80 font-medium">
                  Smart SMS • {formatDetectedTime(currentItem.detectedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {queue.length > 1 && (
                <div className="flex items-center bg-black/25 rounded-full px-2.5 py-1 text-[11px] font-bold mr-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveIndex(Math.max(0, safeIndex - 1))}
                    disabled={safeIndex === 0}
                    className="p-0.5 disabled:opacity-40 hover:text-white/90"
                    title="Previous detected transaction"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="px-1.5">
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

              {/* Minimize back to Floating Bubble button */}
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 transition"
                title="Minimize to floating bubble"
              >
                <Minimize2 className="w-4 h-4 text-white" />
              </button>

              <button
                type="button"
                onClick={() => onDismissItem(currentItem.id)}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
                title="Dismiss"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Hero Section: Type Switcher + Prominent Amount */}
          <div className="mt-4 pt-3 border-t border-white/15 flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-black/20 backdrop-blur-xs mb-2.5">
              <button
                type="button"
                onClick={() => handleToggleType('expense')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                  selectedType === 'expense'
                    ? 'bg-white text-[#1D4A8C] shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Debit (Expense)</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleType('income')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                  selectedType === 'income'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-white/85 hover:text-white'
                }`}
              >
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Credit (Income)</span>
              </button>
            </div>

            <div className="text-4xl font-extrabold text-white tracking-tight mt-0.5">
              {formatAmount(currentItem.amount)}
            </div>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {!debitWarningOpen ? (
            <>
              {/* Quick Category Selector (1-Tap Chips + Full Dropdown) */}
              <div className="space-y-2 relative">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-400">
                    Category
                  </label>
                  <span className="text-[11px] font-medium text-[#2357A4] dark:text-blue-400">
                    Selected: {selectedCategory}
                  </span>
                </div>

                {/* Quick-Tap Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {categories.slice(0, 5).map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryDropdownOpen(false);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition ${
                          isSelected
                            ? selectedType === 'income'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-[#2357A4] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-700/70 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>

                {/* Full Category Dropdown Button */}
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
                  <div className="absolute left-0 right-0 bottom-full mb-1.5 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl max-h-48 overflow-y-auto py-1.5 divide-y divide-slate-50 dark:divide-slate-700/40">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(cat);
                          setCategoryDropdownOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs font-medium text-slate-800 dark:text-slate-200 hover:bg-blue-50/70 dark:hover:bg-slate-700 transition"
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

              {/* Privacy Reassurance Strip */}
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  Only <strong>Debit/Credit</strong> &amp; <strong>Amount</strong> captured. Zero bank info stored.
                </span>
              </div>

              {/* Equal-Sized Action Buttons (L -> R: Save, Edit, Ignore) */}
              <div className="pt-1 pb-2 grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={handleSaveAsIsClick}
                  className={`w-full flex items-center justify-center gap-1.5 py-3.5 rounded-2xl text-white text-xs font-bold shadow-sm active:scale-[0.98] transition ${
                    selectedType === 'income'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-[#2357A4] hover:bg-[#1D4A8C]'
                  }`}
                >
                  <Check className="w-4 h-4 shrink-0" />
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
                  className="w-full flex items-center justify-center gap-1.5 py-3.5 rounded-2xl border border-[#2357A4]/30 dark:border-blue-400/30 bg-blue-50/70 dark:bg-blue-950/40 text-[#2357A4] dark:text-blue-300 text-xs font-bold hover:bg-blue-100/70 dark:hover:bg-blue-900/50 active:scale-[0.98] transition"
                >
                  <Edit3 className="w-3.5 h-3.5 shrink-0" />
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDismissItem(currentItem.id)}
                  className="w-full flex items-center justify-center py-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-[0.98] transition"
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
                  className="flex-1 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitQuickSave}
                  className="flex-1 py-3 rounded-2xl bg-[#2357A4] hover:bg-[#1D4A8C] text-white text-xs font-bold transition"
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
