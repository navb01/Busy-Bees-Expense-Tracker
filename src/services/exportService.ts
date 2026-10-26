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

export function downloadCSV(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printOrSavePDF(transactions: Transaction[], currency: CurrencyCode, rangeLabel: string): void {
  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);
  const net = totalIncome - totalExpense;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Busy Bees Expense Report - ${rangeLabel}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 40px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2357a4; padding-bottom: 16px; margin-bottom: 24px; }
          .title { font-size: 24px; font-weight: bold; color: #2357a4; }
          .badge { font-size: 14px; color: #64748b; }
          .summary { display: flex; gap: 24px; margin-bottom: 24px; }
          .card { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; background: #f8fafc; }
          .card-title { font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
          .card-value { font-size: 20px; font-weight: 700; }
          .income { color: #16a34a; }
          .expense { color: #dc2626; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { text-align: left; padding: 8px 12px; background: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-size: 13px; }
          td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">Busy Bees Expense Tracker</div>
            <div class="badge">Exported: ${new Date().toLocaleDateString()} · ${rangeLabel}</div>
          </div>
          <div style="font-weight: 800; font-size: 20px; color: #2357a4; border: 2px solid #2357a4; border-radius: 50%; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
            BB
          </div>
        </div>

        <div class="summary">
          <div class="card">
            <div class="card-title">Total Income</div>
            <div class="card-value income">+${currency} ${totalIncome.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Expense</div>
            <div class="card-value expense">-${currency} ${totalExpense.toFixed(2)}</div>
          </div>
          <div class="card">
            <div class="card-title">Net Balance</div>
            <div class="card-value" style="color: ${net >= 0 ? '#16a34a' : '#dc2626'};">${currency} ${net.toFixed(2)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Category</th>
              <th>Note</th>
              <th style="text-align: right;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${transactions
              .map(
                (t) => `
              <tr>
                <td>${t.date}</td>
                <td><span style="font-weight: 600; color: ${t.type === 'income' ? '#16a34a' : '#dc2626'};">${t.type.toUpperCase()}</span></td>
                <td>${t.category}</td>
                <td>${t.note || '-'}</td>
                <td style="text-align: right; font-weight: 600;">${t.type === 'income' ? '+' : '-'}${currency} ${t.amount.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <p style="margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center;">
          Busy Bees Expense Tracker · 100% Offline and Private on your device
        </p>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
