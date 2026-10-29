import { DetectedSmsTransaction, TransactionType } from '../types';

interface NativeSmsBridge {
  isSmsNotificationAccessGranted?: () => boolean;
  openSmsNotificationAccessSettings?: () => void;
  consumePendingSmsTransactions?: () => string;
  setSmsAutoDetectEnabled?: (enabled: boolean) => void;
}

const getNativeBridge = (): NativeSmsBridge | null => {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as { BusyBeesNative?: NativeSmsBridge };
  return win.BusyBeesNative || null;
};

/**
 * Strictly privacy-first, 100% offline on-device SMS parser.
 * Extracts ONLY Debit/Credit status ('expense' | 'income') and numeric Amount.
 * Never returns or stores bank names, account numbers, card digits, balances, or raw text.
 */
export function parseTransactionSms(
  rawSmsText: string
): { type: TransactionType; amount: number } | null {
  if (!rawSmsText || typeof rawSmsText !== 'string') return null;

  const trimmed = rawSmsText.trim();
  if (trimmed.length < 6 || trimmed.length > 1000) return null;

  const lower = trimmed.toLowerCase();

  // 1. Reject OTPs, login codes, promotional offers, and future bill/mandate reminders
  const ignorePatterns = [
    /\botp\b/i,
    /\bone[\s-]?time[\s-]?password\b/i,
    /\bverification\s+code\b/i,
    /\bsecurity\s+code\b/i,
    /\bauth(?:entication)?\s+code\b/i,
    /\bpre[\s-]?approved\b/i,
    /\beligible\s+for\b/i,
    /\bapply\s+now\b/i,
    /\bwin\s+up\s+to\b/i,
    /\bcashback\s+up\s+to\b/i,
    /\bwill\s+be\s+debited\b/i,
    /\bis\s+due\s+on\b/i,
    /\bminimum\s+amount\s+due\b/i,
    /\btotal\s+amount\s+due\b/i,
    /\bstatement\s+for\b/i,
    /\bmandate\s+for\b/i,
  ];

  for (const pattern of ignorePatterns) {
    if (pattern.test(lower)) {
      return null;
    }
  }

  // 2. Strip balance / credit-limit clauses first so remaining balance is never mistaken for transaction amount
  const sanitizedForAmount = trimmed
    .replace(
      /\b(?:avl\.?|avail(?:able)?|updated|clear|clr|tot(?:al)?|closing|net|eff(?:ective)?|ac(?:count)?)\s*(?:bal(?:ance)?|limit)\s*(?:is)?\s*[:=-]?\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:cr|dr)\.?)?/gi,
      ' '
    )
    .replace(
      /\bbal(?:ance)?\s*[:=-]\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\s*[\d,]+(?:\.\d{1,2})?/gi,
      ' '
    );

  // 3. Determine Transaction Type (Debit -> 'expense', Credit -> 'income')
  // Check explicit debit and credit keywords and their earliest match position
  const debitRegex =
    /\b(?:debited|withdrawn|withdrawal|spent|paid|sent|purchased|purchase|charged|deducted|dr\.?\b|debit\b|auto[\s-]?debited)/i;
  const creditRegex =
    /\b(?:credited|deposited|deposit|received|refunded|refund|added|cr\.?\b|credit\b|cashback\s+of)/i;

  const debitMatch = debitRegex.exec(sanitizedForAmount);
  const creditMatch = creditRegex.exec(sanitizedForAmount);

  if (!debitMatch && !creditMatch) {
    return null;
  }

  let detectedType: TransactionType;
  if (debitMatch && creditMatch) {
    // Handle phrases like "debited from A/c ... and credited to ..." -> primary user action is the first keyword
    detectedType = debitMatch.index <= creditMatch.index ? 'expense' : 'income';
  } else if (debitMatch) {
    detectedType = 'expense';
  } else {
    detectedType = 'income';
  }

  // 4. Extract numeric transaction amount
  // Priority A: Currency marker followed by number (e.g., Rs. 450.00, INR 1,200, ₹500, $29.99)
  const currencyBeforeAmountRegex =
    /(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\s*([\d,]+(?:\.\d{1,2})?)/i;

  // Priority B: Number followed by currency marker (e.g., 450.00 INR, 1200 Rs)
  const amountBeforeCurrencyRegex =
    /\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\b/i;

  // Priority C: Keyword adjacent to amount without currency symbol (e.g., "debited by 500.00", "credited with 1,500")
  const keywordAdjacentAmountRegex =
    /\b(?:debited|credited|withdrawn|deposited|spent|paid|received|sent|for|by|with|of)\s+(?:by\s+|with\s+|of\s+)?(?:rs\.?|inr|₹|\$)?\s*([\d,]+(?:\.\d{1,2})?)/i;

  let rawNumberStr: string | null = null;

  const matchA = currencyBeforeAmountRegex.exec(sanitizedForAmount);
  if (matchA && matchA[1]) {
    rawNumberStr = matchA[1];
  } else {
    const matchB = amountBeforeCurrencyRegex.exec(sanitizedForAmount);
    if (matchB && matchB[1]) {
      rawNumberStr = matchB[1];
    } else {
      const matchC = keywordAdjacentAmountRegex.exec(sanitizedForAmount);
      if (matchC && matchC[1]) {
        rawNumberStr = matchC[1];
      }
    }
  }

  if (!rawNumberStr) return null;

  const normalizedNumber = parseFloat(rawNumberStr.replace(/,/g, ''));
  if (!Number.isFinite(normalizedNumber) || normalizedNumber <= 0 || normalizedNumber > 1000000000) {
    return null;
  }

  // Return strictly the transaction type and numeric amount — all raw text is discarded
  return {
    type: detectedType,
    amount: Math.round(normalizedNumber * 100) / 100,
  };
}

/**
 * Checks if the app is running inside the native Android wrapper with SMS Notification Listener support.
 */
export function isNativeSmsDetectionSupported(): boolean {
  const bridge = getNativeBridge();
  return Boolean(
    bridge &&
      typeof bridge.isSmsNotificationAccessGranted === 'function' &&
      typeof bridge.openSmsNotificationAccessSettings === 'function'
  );
}

/**
 * Checks whether Android Notification Listener permission is enabled for Busy Bees.
 */
export function isSmsNotificationAccessGranted(): boolean {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.isSmsNotificationAccessGranted === 'function') {
      return Boolean(bridge.isSmsNotificationAccessGranted());
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Opens Android System Settings -> Notification Access so the user can toggle Busy Bees ON.
 */
export function openSmsNotificationAccessSettings(): void {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.openSmsNotificationAccessSettings === 'function') {
      bridge.openSmsNotificationAccessSettings();
    }
  } catch {
    // ignore
  }
}

/**
 * Syncs the user's SMS Auto-Detect toggle state with the native Android NotificationListenerService.
 */
export function syncNativeSmsAutoDetectEnabled(enabled: boolean): void {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.setSmsAutoDetectEnabled === 'function') {
      bridge.setSmsAutoDetectEnabled(enabled);
    }
  } catch {
    // ignore
  }
}

/**
 * Drains any sanitized transactions queued by the native Android NotificationListenerService
 * while the app was in the background or closed.
 */
export function consumeNativePendingSmsTransactions(): DetectedSmsTransaction[] {
  try {
    const bridge = getNativeBridge();
    if (!bridge || typeof bridge.consumePendingSmsTransactions !== 'function') {
      return [];
    }
    const jsonStr = bridge.consumePendingSmsTransactions();
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          (item.type === 'income' || item.type === 'expense') &&
          typeof item.amount === 'number' &&
          item.amount > 0
      )
      .map((item) => ({
        id: String(item.id || `sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
        type: item.type as TransactionType,
        amount: Math.round(Number(item.amount) * 100) / 100,
        detectedAt: Number(item.detectedAt || Date.now()),
      }));
  } catch {
    return [];
  }
}

/**
 * Inspects URL query parameters for iOS Shortcuts / Deep-Link automation triggers
 * (e.g. ?sms=... or ?detectedType=expense&detectedAmount=450)
 * and immediately strips the parameters from browser history so raw text is never retained.
 */
export function consumeUrlSmsTrigger(): { type: TransactionType; amount: number } | null {
  if (typeof window === 'undefined') return null;
  try {
    const url = new URL(window.location.href);
    const smsParam = url.searchParams.get('sms') || url.searchParams.get('smsText');
    const explicitType = url.searchParams.get('detectedType');
    const explicitAmount = url.searchParams.get('detectedAmount');

    let result: { type: TransactionType; amount: number } | null = null;

    if (smsParam) {
      result = parseTransactionSms(smsParam);
    } else if (
      (explicitType === 'income' || explicitType === 'expense') &&
      explicitAmount
    ) {
      const amt = parseFloat(explicitAmount);
      if (Number.isFinite(amt) && amt > 0) {
        result = {
          type: explicitType,
          amount: Math.round(amt * 100) / 100,
        };
      }
    }

    if (smsParam || explicitType || explicitAmount) {
      url.searchParams.delete('sms');
      url.searchParams.delete('smsText');
      url.searchParams.delete('detectedType');
      url.searchParams.delete('detectedAmount');
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    }

    return result;
  } catch {
    return null;
  }
}
