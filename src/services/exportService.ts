import { CurrencyCode, Transaction } from '../types';

export type DateRangeOption = 'this_month' | 'quarter' | 'year' | 'all_time';

export function filterTransactionsByRange(transactions: Transaction[], range: DateRangeOption): Transaction[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  return transactions.filter((tx) => {
    const txDate = new Date(tx.date + 'T00:00:00');
    if (isNaN(txDate.getTime())) return true;

    if (range === 'this_month') {
      return txDate.getFullYear() === currentYear && txDate.getMonth() === currentMonth;
    }
    if (range === 'quarter') {
      const currentQuarter = Math.floor(currentMonth / 3);
      const txQuarter = Math.floor(txDate.getMonth() / 3);
      return txDate.getFullYear() === currentYear && txQuarter === currentQuarter;
    }
    if (range === 'year') {
      return txDate.getFullYear() === currentYear;
    }
    // all_time
    return true;
  });
}

export function generateCSV(transactions: Transaction[], currency: CurrencyCode): string {
  const headers = ['ID', 'Date', 'Type', 'Category', 'Amount', 'Currency', 'Note'];
  const rows = transactions.map((t) => [
    t.id,
    t.date,
    t.type.toUpperCase(),
    `"${t.category.replace(/"/g, '""')}"`,
    t.amount.toFixed(2),
    currency,
    `"${(t.note || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

interface BusyBeesNativeExportBridge {
  exportPdfDocument?: (reportJson: string, fileName: string) => void;
  exportCsvDocument?: (csvContent: string, fileName: string) => void;
  openLastExportedFile?: () => void;
}

function getNativeExportBridge(): BusyBeesNativeExportBridge | null {
  const win = window as unknown as { BusyBeesNative?: BusyBeesNativeExportBridge };
  return win.BusyBeesNative || null;
}

export function isNativeExportAvailable(): boolean {
  const bridge = getNativeExportBridge();
  return Boolean(bridge && typeof bridge.exportPdfDocument === 'function');
}

export function openLastExportedNativeFile(): void {
  const bridge = getNativeExportBridge();
  bridge?.openLastExportedFile?.();
}

function waitForNativeExportResult(timeoutMs = 120000): Promise<{
  success: boolean;
  fileName: string;
  cancelled?: boolean;
  error?: string;
}> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      window.removeEventListener('bb-export-result', handler);
      resolve({ success: false, fileName: '', cancelled: true });
    }, timeoutMs);

    const handler = (evt: Event) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener('bb-export-result', handler);
      const detail = (
        evt as CustomEvent<{
          success?: boolean;
          format?: string;
          fileName?: string;
          error?: string;
        }>
      ).detail;
      if (detail?.success) {
        resolve({ success: true, fileName: detail.fileName || '' });
      } else if (detail?.error === 'cancelled') {
        resolve({ success: false, fileName: detail.fileName || '', cancelled: true });
      } else {
        resolve({
          success: false,
          fileName: detail?.fileName || '',
          error: detail?.error || 'Export could not be completed.',
        });
      }
    };

    window.addEventListener('bb-export-result', handler);
  });
}

export async function downloadCSV(
  filename: string,
  csvContent: string
): Promise<{ saved: boolean; cancelled?: boolean; error?: string; isNative?: boolean }> {
  const bridge = getNativeExportBridge();
  if (bridge && typeof bridge.exportCsvDocument === 'function') {
    const resultPromise = waitForNativeExportResult();
    bridge.exportCsvDocument(csvContent, filename);
    const res = await resultPromise;
    return {
      saved: res.success,
      cancelled: res.cancelled,
      error: res.error,
      isNative: true,
    };
  }

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { saved: true, isNative: false };
}

function escapePdfText(str: string): string {
  return str
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function truncateText(str: string, maxChars: number): string {
  if (!str) return '';
  if (str.length <= maxChars) return str;
  return str.slice(0, Math.max(1, maxChars - 3)) + '...';
}

//Approx text width in points for Helvetica at given fontSize
function measureHelveticaWidth(str: string, fontSize: number): number {
  return str.length * fontSize * 0.52;
}

function buildWebPdfBlob(
  transactions: Transaction[],
  currency: CurrencyCode,
  rangeLabel: string,
  exportedDate: string
): Blob {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpense;
  const isNetPositive = net >= 0;

  // RGB colors (0..1)
  const BLUE = '0.137 0.341 0.643'; // #2357A4
  const SLATE_DARK = '0.118 0.161 0.231'; // #1E293B
  const SLATE_MUTED = '0.392 0.455 0.545'; // #64748B
  const SLATE_LIGHT = '0.580 0.639 0.722'; // #94A3B8
  const CARD_BG = '0.973 0.980 0.988'; // #F8FAFC
  const CARD_BORDER = '0.886 0.910 0.941'; // #E2E8F0
  const THEAD_BG = '0.945 0.961 0.976'; // #F1F5F9
  const THEAD_BORDER = '0.796 0.835 0.882'; // #CBD5E1
  const GREEN = '0.086 0.639 0.290'; // #16A34A
  const RED = '0.863 0.149 0.149'; // #DC2626

  const pageOneCapacity = 24;
  const nextPagesCapacity = 30;

  const pages: Transaction[][] = [];
  if (transactions.length <= pageOneCapacity) {
    pages.push(transactions);
  } else {
    pages.push(transactions.slice(0, pageOneCapacity));
    let offset = pageOneCapacity;
    while (offset < transactions.length) {
      pages.push(transactions.slice(offset, offset + nextPagesCapacity));
      offset += nextPagesCapacity;
    }
  }

  const totalPages = pages.length;
  const pageStreams: string[] = [];

  for (let p = 0; p < totalPages; p++) {
    const slice = pages[p];
    const cmds: string[] = [];

    let tableTopY = 785;

    if (p === 0) {
      // Title: Busy Bees Expense Tracker (#2357A4)
      cmds.push(`${BLUE} rg`);
      cmds.push('BT /F2 18 Tf 36 792 Td (Busy Bees Expense Tracker) Tj ET');

      // Subtitle: Exported date & range (#64748B)
      cmds.push(`${SLATE_MUTED} rg`);
      cmds.push(
        `BT /F1 10 Tf 36 774 Td (${escapePdfText(
          `Exported: ${exportedDate}  |  ${rangeLabel}`
        )}) Tj ET`
      );

      // Circular Rupee-Bee (₹ + Golden Bee) Logo Emblem at top right (center cx=539, cy=788, r=18)
      const cx = 539;
      const cy = 788;
      const r = 18;
      const k = r * 0.55228475;
      // Royal Blue Medallion Fill (#2357A4) + Honey Gold Rim (#F59E0B -> 0.961 0.620 0.043)
      cmds.push(`${BLUE} rg 0.961 0.620 0.043 RG 1.8 w`);
      cmds.push(
        `${cx} ${cy + r} m ` +
          `${(cx + k).toFixed(2)} ${cy + r} ${cx + r} ${(cy + k).toFixed(2)} ${cx + r} ${cy} c ` +
          `${cx + r} ${(cy - k).toFixed(2)} ${(cx + k).toFixed(2)} ${cy - r} ${cx} ${cy - r} c ` +
          `${(cx - k).toFixed(2)} ${cy - r} ${cx - r} ${(cy - k).toFixed(2)} ${cx - r} ${cy} c ` +
          `${cx - r} ${(cy + k).toFixed(2)} ${(cx - k).toFixed(2)} ${cy + r} ${cx} ${cy + r} c B`
      );
      // Crisp White Indian Rupee (₹) Symbol inside Medallion
      cmds.push(`1 1 1 RG 2.2 w 1 J 1 j`);
      // Top bar & middle bar of ₹
      cmds.push(`${cx - 9} ${cy + 8} m ${cx + 4} ${cy + 8} l S`);
      cmds.push(`${cx - 9} ${cy + 3} m ${cx + 3} ${cy + 3} l S`);
      // Curved right loop & diagonal leg of ₹ (open on the left)
      cmds.push(
        `${cx - 3} ${cy + 8} m ${cx - 1} ${cy + 8} l ` +
          `${cx + 2.5} ${cy + 8} ${cx + 4} ${cy + 5.5} ${cx + 4} ${cy + 3} c ` +
          `${cx + 4} ${cy + 0.5} ${cx + 2.5} ${cy - 2} ${cx - 1.5} ${cy - 2} c ` +
          `${cx - 5.5} ${cy - 2} l ${cx + 4} ${cy - 11} l S`
      );
      // Golden Swooping Trail through the ₹ loop (#FDE047 -> 0.992 0.878 0.278)
      cmds.push(`0.992 0.878 0.278 RG 1.5 w`);
      cmds.push(
        `${cx - 11} ${cy - 6} m ${cx - 5} ${cy - 8} ${cx} ${cy - 1} ${cx + 6} ${cy + 5} c S`
      );
      // Golden Honeybee Body at top-right of loop (#FBBF24 -> 0.984 0.749 0.141)
      cmds.push(`0.984 0.749 0.141 rg 0.059 0.090 0.165 RG 0.8 w`);
      cmds.push(`${cx + 5.5} ${cy + 4.5} 6.5 4.2 re B`);
      // Bee Dark Stripe
      cmds.push(`0.059 0.090 0.165 RG 1.2 w`);
      cmds.push(`${cx + 8.5} ${cy + 4.5} m ${cx + 8.5} ${cy + 8.7} l S`);
      // White Wing above Bee
      cmds.push(`1 1 1 rg 0.749 0.859 0.996 RG 0.6 w`);
      cmds.push(`${cx + 6.5} ${cy + 8.7} 3.2 2.8 re B`);

      // Royal Blue Header Divider Line
      cmds.push(`${BLUE} rg 36 758 523 2 re f`);

      // 3 Summary Cards (y = 692..744, height = 52)
      const cardY = 692;
      const cardH = 52;
      const cardW = 166;
      const cardGap = 12.5;

      const cards = [
        {
          title: 'TOTAL INCOME',
          val: `+${currency} ${totalIncome.toFixed(2)}`,
          color: GREEN,
        },
        {
          title: 'TOTAL EXPENSE',
          val: `-${currency} ${totalExpense.toFixed(2)}`,
          color: RED,
        },
        {
          title: 'NET BALANCE',
          val: `${isNetPositive ? '' : '-'}${currency} ${Math.abs(net).toFixed(2)}`,
          color: isNetPositive ? GREEN : RED,
        },
      ];

      cards.forEach((c, idx) => {
        const cxLeft = +(36 + idx * (cardW + cardGap)).toFixed(2);
        cmds.push(`${CARD_BG} rg ${CARD_BORDER} RG 1 w`);
        cmds.push(`${cxLeft} ${cardY} ${cardW} ${cardH} re B`);

        cmds.push(`${SLATE_MUTED} rg`);
        cmds.push(`BT /F2 8 Tf ${cxLeft + 10} ${cardY + 35} Td (${c.title}) Tj ET`);

        cmds.push(`${c.color} rg`);
        cmds.push(
          `BT /F2 13 Tf ${cxLeft + 10} ${cardY + 14} Td (${escapePdfText(
            truncateText(c.val, 20)
          )}) Tj ET`
        );
      });

      tableTopY = 672;
    }

    // Table Header Bar
    const thHeight = 22;
    const thBottom = tableTopY - thHeight;
    cmds.push(`${THEAD_BG} rg ${thBottom >= 0 ? `36 ${thBottom} 523 ${thHeight} re f` : ''}`);
    cmds.push(`${THEAD_BORDER} rg 36 ${thBottom} 523 1.2 re f`);

    cmds.push(`${SLATE_DARK} rg`);
    const thTextY = thBottom + 7;
    cmds.push(`BT /F2 9.5 Tf 44 ${thTextY} Td (Date) Tj ET`);
    cmds.push(`BT /F2 9.5 Tf 120 ${thTextY} Td (Type) Tj ET`);
    cmds.push(`BT /F2 9.5 Tf 185 ${thTextY} Td (Category) Tj ET`);
    cmds.push(`BT /F2 9.5 Tf 320 ${thTextY} Td (Note) Tj ET`);
    cmds.push(`BT /F2 9.5 Tf 514 ${thTextY} Td (Amount) Tj ET`);

    let rowTop = thBottom;
    const rowHeight = 22;

    if (slice.length === 0) {
      cmds.push(`${SLATE_MUTED} rg`);
      cmds.push(
        `BT /F1 10 Tf 44 ${rowTop - 18} Td (No transactions recorded in this period.) Tj ET`
      );
    } else {
      for (const t of slice) {
        const rowBottom = rowTop - rowHeight;
        const textY = rowBottom + 7;
        const isInc = t.type === 'income';
        const rowColor = isInc ? GREEN : RED;

        // Date
        cmds.push(`${SLATE_DARK} rg`);
        cmds.push(`BT /F1 9.5 Tf 44 ${textY} Td (${escapePdfText(t.date)}) Tj ET`);

        // Type (Colored & Bold)
        cmds.push(`${rowColor} rg`);
        cmds.push(`BT /F2 9 Tf 120 ${textY} Td (${escapePdfText(t.type.toUpperCase())}) Tj ET`);

        // Category
        cmds.push(`${SLATE_DARK} rg`);
        cmds.push(
          `BT /F1 9.5 Tf 185 ${textY} Td (${escapePdfText(truncateText(t.category, 22))}) Tj ET`
        );

        // Note
        cmds.push(`${SLATE_MUTED} rg`);
        cmds.push(
          `BT /F1 9.5 Tf 320 ${textY} Td (${escapePdfText(
            truncateText(t.note || '-', 26)
          )}) Tj ET`
        );

        // Amount (Right-aligned & Colored)
        const amtStr = `${isInc ? '+' : '-'}${currency} ${t.amount.toFixed(2)}`;
        const amtW = measureHelveticaWidth(amtStr, 9.5);
        const amtX = Math.max(440, +(551 - amtW).toFixed(1));
        cmds.push(`${rowColor} rg`);
        cmds.push(`BT /F2 9.5 Tf ${amtX} ${textY} Td (${escapePdfText(amtStr)}) Tj ET`);

        // Row bottom border
        cmds.push(`${CARD_BORDER} rg 36 ${rowBottom} 523 0.7 re f`);

        rowTop = rowBottom;
      }
    }

    // Page Footer
    cmds.push(`${SLATE_LIGHT} rg`);
    cmds.push(
      `BT /F1 8.5 Tf 155 26 Td (${escapePdfText(
        `Busy Bees Expense Tracker  |  100% Offline & Private  |  Page ${p + 1} of ${totalPages}`
      )}) Tj ET`
    );

    pageStreams.push(cmds.join('\n'));
  }

  // Construct valid PDF 1.4 objects with Helvetica & Helvetica-Bold
  const objects: string[] = [];
  const pageObjNumbers: number[] = [];
  let nextObjNum = 5;

  for (let p = 0; p < totalPages; p++) {
    const pageObjNum = nextObjNum++;
    const contentObjNum = nextObjNum++;
    pageObjNumbers.push(pageObjNum);

    const streamContent = pageStreams[p];
    objects[pageObjNum] =
      `${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjNum} 0 R >>\nendobj\n`;
    objects[contentObjNum] =
      `${contentObjNum} 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  }

  objects[1] = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  objects[2] = `2 0 obj\n<< /Type /Pages /Kids [${pageObjNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${totalPages} >>\nendobj\n`;
  objects[3] = `3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`;
  objects[4] = `4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`;

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (let i = 1; i < nextObjNum; i++) {
    offsets[i] = pdf.length;
    pdf += objects[i];
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${nextObjNum}\n0000000000 65535 f \n`;
  for (let i = 1; i < nextObjNum; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${nextObjNum} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
}

export async function printOrSavePDF(
  transactions: Transaction[],
  currency: CurrencyCode,
  rangeLabel: string,
  filename = 'busy_bees_report.pdf'
): Promise<{ saved: boolean; cancelled?: boolean; error?: string; isNative?: boolean }> {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpense;
  const exportedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const bridge = getNativeExportBridge();
  if (bridge && typeof bridge.exportPdfDocument === 'function') {
    const payload = {
      rangeLabel,
      exportedDate,
      currency,
      totalIncome: totalIncome.toFixed(2),
      totalExpense: totalExpense.toFixed(2),
      netBalance: Math.abs(net).toFixed(2),
      isNetPositive: net >= 0,
      rows: transactions.map((t) => ({
        date: t.date,
        type: t.type.toUpperCase(),
        isIncome: t.type === 'income',
        category: t.category,
        note: t.note || '-',
        amount: `${t.type === 'income' ? '+' : '-'}${currency} ${t.amount.toFixed(2)}`,
      })),
    };

    const resultPromise = waitForNativeExportResult();
    bridge.exportPdfDocument(JSON.stringify(payload), filename);
    const res = await resultPromise;
    return {
      saved: res.success,
      cancelled: res.cancelled,
      error: res.error,
      isNative: true,
    };
  }

  // Web browser fallback: generate a real downloadable PDF file without window.open
  const blob = buildWebPdfBlob(transactions, currency, rangeLabel, exportedDate);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return { saved: true, isNative: false };
}

