import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  const current = queue[0];
  const currencyConfig = CURRENCY_CONFIGS[settings.currency] || CURRENCY_CONFIGS.INR;

  // Maximised by default when a transaction is detected
  const [isExpanded, setIsExpanded] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Shopping');

  // Drag position offset & bottom close zone state
  const [offsetY, setOffsetY] = useState<number>(88);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [inDismissZone, setInDismissZone] = useState(false);

  const dragStateRef = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    startOffsetX: number;
    startOffsetY: number;
    moved: boolean;
  }>({
    pointerId: null,
    startClientX: 0,
    startClientY: 0,
    startOffsetX: 0,
    startOffsetY: 88,
    moved: false,
  });

  // Available categories including any custom ones saved previously
  const availableCategories = useMemo(() => {
    if (!current) return EXPENSE_CATEGORIES;
    const base = current.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const set = new Set<string>(base);
    for (const tx of transactions) {
      if (tx.type === current.type && tx.category && tx.category.trim()) {
        set.add(tx.category.trim());
      }
    }
    return Array.from(set);
  }, [current?.id, current?.type, transactions]);

  // Reset to maximised & default category whenever a new SMS item arrives
  useEffect(() => {
    if (!current) return;
    setSelectedCategory(current.type === 'income' ? 'Salary' : 'Shopping');
    setIsExpanded(true);
    setOffsetX(0);
    setOffsetY(88);
  }, [current?.id, current?.type]);

  if (!current) return null;

  const isIncome = current.type === 'income';
  const remainingCount = queue.length;

  const checkInDismissZone = (clientY: number) => {
    if (typeof window === 'undefined') return false;
    return clientY >= window.innerHeight * 0.78;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // Do not start dragging if user is interacting with the category <select> or action buttons
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'SELECT' ||
      target.tagName === 'OPTION' ||
      target.closest('select') ||
      target.closest('[data-no-drag="true"]')
    ) {
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
      moved: false,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    const dx = e.clientX - dragStateRef.current.startClientX;
    const dy = e.clientY - dragStateRef.current.startClientY;

    if (!dragStateRef.current.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dragStateRef.current.moved = true;
      setIsDragging(true);
    }

    if (dragStateRef.current.moved) {
      const nextX = dragStateRef.current.startOffsetX + dx;
      const nextY = Math.max(24, dragStateRef.current.startOffsetY + dy);
      setOffsetX(nextX);
      setOffsetY(nextY);
      setInDismissZone(checkInDismissZone(e.clientY));
    }
  };

  const handlePointerUp = (
    e: React.PointerEvent<HTMLElement>,
    onTapWithoutDrag?: () => void
  ) => {
    if (dragStateRef.current.pointerId !== e.pointerId) return;
    const wasMoved = dragStateRef.current.moved;
    const shouldDismiss = wasMoved && checkInDismissZone(e.clientY);

    dragStateRef.current.pointerId = null;
    dragStateRef.current.moved = false;
    setIsDragging(false);
    setInDismissZone(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (shouldDismiss) {
      onDismissItem(current.id);
      return;
    }

    if (!wasMoved && onTapWithoutDrag) {
      onTapWithoutDrag();
    }
  };

  const handleSave = () => {
    onSaveAsIs(current.id, {
      type: current.type,
      amount: current.amount,
      category: selectedCategory,
      date: getTodayISO(),
      note: '',
    });
  };

  const handleEdit = () => {
    onEditItem(current.id, {
      type: current.type,
      amount: current.amount,
      category: selectedCategory,
    });
  };

  const handleIgnore = () => {
    onDismissItem(current.id);
  };

  return (
    <>
      {/* Bottom Drag-to-Close Target Zone (visible while dragging) */}
      {isDragging && (
        <div className="fixed inset-x-0 bottom-8 z-50 flex justify-center pointer-events-none animate-in fade-in duration-150">
          <div
            className={`px-6 py-3 rounded-full font-bold text-xs tracking-wide text-white shadow-2xl border-2 transition-all duration-150 flex items-center gap-2 ${
              inDismissZone
                ? 'bg-red-600 border-white scale-110'
                : 'bg-slate-900/85 border-white/40 scale-100'
            }`}
          >
            <span className="text-sm leading-none">✕</span>
            <span>{inDismissZone ? 'Release to close' : 'Drag here to close'}</span>
          </div>
        </div>
      )}

      {/* Minimised State: Floating Circular Bubble Icon at Top Right */}
      {!isExpanded && (
        <div
          style={{
            top: `${offsetY}px`,
            right: `${Math.max(12, 16 - offsetX)}px`,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => handlePointerUp(e, () => setIsExpanded(true))}
          title="Tap to maximise transaction bubble • Drag to bottom to close"
          className={`fixed z-50 w-14 h-14 rounded-full shadow-2xl border-2 border-white flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-transform ${
            isIncome
              ? 'bg-[#16A34A] text-white shadow-emerald-950/50'
              : 'bg-[#DC2626] text-white shadow-red-950/50'
          }`}
        >
          <span className="text-[16px] font-extrabold leading-none tracking-tight">
            {isIncome ? `+${currencyConfig.symbol}` : `-${currencyConfig.symbol}`}
          </span>

          {remainingCount > 1 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center justify-center border border-white shadow-xs">
              {remainingCount}
            </span>
          )}
        </div>
      )}

      {/* Maximised State: Expanded Transaction Card (Green for Credit, Red for Debit) */}
      {isExpanded && (
        <div
          style={{
            top: `${offsetY}px`,
            transform: `translateX(${offsetX}px)`,
            touchAction: 'none',
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={(e) => handlePointerUp(e)}
          className="fixed inset-x-0 z-50 px-3 flex justify-center pointer-events-none"
        >
          <div className="w-full max-w-sm rounded-[22px] overflow-hidden shadow-2xl border border-white/20 bg-[#111827] text-white pointer-events-auto select-none">
            {/* Top Colored Section: Green (#16A34A) for Credit, Red (#DC2626) for Debit */}
            <div
              className={`px-4 pt-3.5 pb-3.5 cursor-grab active:cursor-grabbing ${
                isIncome ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
              }`}
            >
              {/* Header Row: TRANSACTION DETECTED + Top-Right Circular Bubble Icon (toggles minimise/maximise) */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-white/95">
                    TRANSACTION DETECTED
                  </span>
                  {remainingCount > 1 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-black/25 text-[10px] font-bold text-white">
                      1 of {remainingCount}
                    </span>
                  )}
                </div>

                {/* Circular Bubble Icon at Top Right (no "Minimize" link) */}
                <button
                  type="button"
                  data-no-drag="true"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  title="Toggle Minimise / Maximise"
                  className={`w-9 h-9 rounded-full border-2 border-white flex items-center justify-center shadow-md active:scale-95 transition shrink-0 ${
                    isIncome
                      ? 'bg-[#15803D] hover:bg-[#166534]'
                      : 'bg-[#B91C1C] hover:bg-[#991B1B]'
                  }`}
                >
                  <span className="text-xs font-extrabold text-white leading-none">
                    {isIncome ? `+${currencyConfig.symbol}` : `-${currencyConfig.symbol}`}
                  </span>
                </button>
              </div>

              {/* Subtitle & Large Amount */}
              <div className="mt-0.5">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-white/90">
                  {isIncome ? 'CREDIT (INCOME)' : 'DEBIT (EXPENSE)'}
                </span>
                <p className="text-2xl font-extrabold tracking-tight text-white mt-0.5 leading-tight">
                  {currencyConfig.symbol}
                  {current.amount.toLocaleString(
                    settings.currency === 'INR' ? 'en-IN' : 'en-US',
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </p>
              </div>

              {/* Category Dropdown Selector inside Colored Card */}
              <div className="mt-2.5 mb-2" data-no-drag="true">
                <div
                  className={`relative flex items-center rounded-xl border border-white/35 px-3 py-1.5 ${
                    isIncome ? 'bg-[#15803D]' : 'bg-[#B91C1C]'
                  }`}
                >
                  <span className="text-xs text-white/85 font-medium mr-2 shrink-0">
                    Category:
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    aria-label="Select Transaction Category"
                    className="w-full bg-transparent text-white font-bold text-xs focus:outline-none appearance-none pr-5 cursor-pointer"
                  >
                    {availableCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900 text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-white pointer-events-none absolute right-3" />
                </div>
              </div>

              <p className="text-[10.5px] text-white/90 leading-snug">
                Only Debit/Credit & Amount captured • Zero bank info stored
              </p>
            </div>

            {/* Bottom Action Buttons (L -> R: Save, Edit, Ignore) */}
            <div className="p-3.5 bg-[#111827] grid grid-cols-3 gap-2.5" data-no-drag="true">
              <button
                type="button"
                onClick={handleSave}
                className={`py-2.5 px-3 rounded-xl font-bold text-xs text-white shadow-sm active:scale-[0.98] transition flex items-center justify-center ${
                  isIncome
                    ? 'bg-[#16A34A] hover:bg-[#15803D]'
                    : 'bg-[#DC2626] hover:bg-[#B91C1C]'
                }`}
              >
                Save
              </button>

              <button
                type="button"
                onClick={handleEdit}
                className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-700 hover:bg-slate-600 text-white active:scale-[0.98] transition flex items-center justify-center"
              >
                Edit
              </button>

              <button
                type="button"
                onClick={handleIgnore}
                className="py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-950/90 hover:bg-slate-950 text-slate-300 border border-slate-800 active:scale-[0.98] transition flex items-center justify-center"
              >
                Ignore
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
