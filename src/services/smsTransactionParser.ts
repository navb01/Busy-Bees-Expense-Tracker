import { DetectedSmsTransaction, TransactionType } from '../types';

interface NativeSmsBridge {
  isSmsNotificationAccessGranted?: () => boolean;
  isDirectSmsPermissionGranted?: () => boolean;
  isNotificationListenerAccessGranted?: () => boolean;
  isOverlayBubblePermissionGranted?: () => boolean;
  requestOverlayBubblePermission?: () => void;
  requestSmsRuntimePermission?: () => void;
  openSmsNotificationAccessSettings?: () => void;
  openNotificationListenerSettingsDirect?: () => void;
  consumePendingSmsTransactions?: () => string;
  consumeAutoSavedSmsTransactions?: () => string;
  resolveSmsTransactionInNative?: (itemId: string) => void;
  consumePendingNotificationAction?: () => string;
  setSmsAutoDetectEnabled?: (enabled: boolean) => void;
  isSmsPullDownNotificationEnabled?: () => boolean;
  setSmsPullDownNotificationEnabled?: (enabled: boolean) => void;
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
  if (trimmed.length < 6 || trimmed.length > 1500) return null;

  // Ignore outgoing messages prefixed with "You:"
  if (/^you\s*:/i.test(trimmed)) {
    return null;
  }

  const lower = trimmed.toLowerCase();

  // 1. Reject OTPs, login codes, promotional offers, and future bill/mandate reminders
  const ignorePatterns = [
    /\botp\b/i,
    /\bone[\s-]?time[\s-]?password\b/i,
    /\bverification\s+code\b/i,
    /\bsecurity\s+code\b/i,
    /\bauth(?:entication)?\s+code\b/i,
    /\blogin\s+code\b/i,
    /\bsecret\s+code\b/i,
    /\bdo\s+not\s+share\s+(?:this\s+)?(?:otp|code)\b/i,
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
    /\bemi\s+of\s+.*\s+is\s+due\b/i,
  ];

  for (const pattern of ignorePatterns) {
    if (pattern.test(lower)) {
      return null;
    }
  }

  // 2. Strip balance clauses, UPI/IMPS reference strings, masked account numbers, and dates
  // so reference numbers (e.g. UPI/DR/43021234/Name) or A/c numbers never confuse Credit/Debit or Amount
  const sanitized = trimmed
    .replace(
      /\b(?:avl\.?|avail(?:able)?|updated|clear|clr|tot(?:al)?|closing|current|curr|net|eff(?:ective)?|ac(?:count)?|combined)\s*(?:bal(?:ance)?|limit|val(?:ue)?)\s*(?:is)?\s*[:=-]?\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:cr|dr)\.?)?/gi,
      ' '
    )
    .replace(
      /\b(?:bal(?:ance)?|limit)\s*(?:is)?\s*[:=-]\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\s*[\d,]+(?:\.\d{1,2})?(?:\s*(?:cr|dr)\.?)?/gi,
      ' '
    )
    .replace(
      /\b(?:upi|imps|neft|rtgs|mmt|ach|ecs|utr|rrn|ref(?:\.?\s*no\.?|\s*id)?)\s*[:/#-]?\s*[a-z0-9/@._-]{5,}/gi,
      ' '
    )
    .replace(
      /\b(?:a\/?c|acct|account|card)\s*(?:no\.?|number|ending(?:\s+with)?|#)?\s*[x*#.-]*\d{2,8}\b/gi,
      ' '
    )
    .replace(
      /\b\d{1,2}[-/\s](?:\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/\s]\d{2,4}\b/gi,
      ' '
    );

  // 3. Determine Transaction Type (Debit -> 'expense', Credit -> 'income')
  // Explicit user-account Credit indicators (high confidence income)
  const explicitCreditRegex =
    /\b(?:credited|deposited|refunded|reimbursed|cashback\s+(?:of|received|credited)|money\s+received|payment\s+received|amount\s+received|received\s+(?:in|into|from|via|by)|added\s+(?:to|in|into)\s+(?:your\s+)?(?:a\/?c|acct|account|wallet|bank)|(?:sent|transferred|paid)\s+to\s+your\s+(?:a\/?c|acct|account|wallet|bank)|(?:a\/?c|acct|account|wallet)\s+(?:is\s+|has\s+been\s+)?cr\.?\b|cr\.?\s+(?:to|in|by|with)\s+(?:your\s+)?(?:a\/?c|acct|account)|credit\s+(?:of|by|with|for|in|to|alert)\b)/i;

  // Explicit user-account Debit indicators (high confidence expense)
  const explicitDebitRegex =
    /\b(?:debited|withdrawn|withdrawal|deducted|spent|purchased|charged|auto[\s-]?debited|(?:a\/?c|acct|account|wallet|card)\s+(?:is\s+|has\s+been\s+)?dr\.?\b|dr\.?\s+from\s+(?:your\s+)?(?:a\/?c|acct|account)|debit\s+(?:of|by|with|for|from|alert)\b)/i;

  // Secondary Credit / Debit keywords (used only if explicit indicators are absent)
  const secondaryCreditRegex = /\b(?:received|deposit|refund|added|credit|cr\b)\b/i;
  const secondaryDebitRegex = /\b(?:paid|sent|transferred|purchase|payment\s+of|payment\s+to)\b/i;

  const userAccountCreditedRegex =
    /(?:credited\s+(?:to|in|into|by|with)\s+(?:your\s+)?(?:a\/?c|acct|account)?|your\s+(?:a\/?c|acct|account).*?\b(?:credited|deposited|cr)\b)/i;
  const userAccountDebitedRegex =
    /(?:debited\s+from\s+(?:your\s+)?(?:a\/?c|acct|account)|your\s+(?:a\/?c|acct|account).*?\bdebited\b)/i;

  const expCreditMatch = explicitCreditRegex.exec(sanitized);
  const expDebitMatch = explicitDebitRegex.exec(sanitized);

  let detectedType: TransactionType | null = null;

  if (expCreditMatch && expDebitMatch) {
    const userCredited = userAccountCreditedRegex.test(sanitized);
    const userDebited = userAccountDebitedRegex.test(sanitized);
    if (userCredited && !userDebited) {
      detectedType = 'income';
    } else if (userDebited && !userCredited) {
      detectedType = 'expense';
    } else {
      detectedType = expCreditMatch.index < expDebitMatch.index ? 'income' : 'expense';
    }
  } else if (expCreditMatch) {
    // Even if "sent" or "paid" appears (e.g., "Rs 500 sent by Rahul is credited to your A/c"),
    // explicit credit ("credited", "deposited", "received in", etc.) ALWAYS wins as income!
    detectedType = 'income';
  } else if (expDebitMatch) {
    detectedType = 'expense';
  } else {
    const secCreditMatch = secondaryCreditRegex.exec(sanitized);
    const secDebitMatch = secondaryDebitRegex.exec(sanitized);
    if (secCreditMatch && !secDebitMatch) {
      detectedType = 'income';
    } else if (secDebitMatch && !secCreditMatch) {
      detectedType = 'expense';
    } else if (secCreditMatch && secDebitMatch) {
      detectedType = secCreditMatch.index <= secDebitMatch.index ? 'income' : 'expense';
    }
  }

  if (!detectedType) {
    return null;
  }

  // 4. Extract numeric transaction amount
  // Priority A: Currency marker followed by number (e.g., Rs. 450.00, Rs.450, INR 1,200, ₹500, $29.99)
  const currencyBeforeAmountRegex =
    /(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\s*[:=.-]?\s*([\d,]+(?:\.\d{1,2})?)/i;

  // Priority B: Number followed by currency marker (e.g., 450.00 INR, 1200 Rs)
  const amountBeforeCurrencyRegex =
    /\b([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr|₹|usd|\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\b/i;

  // Priority C: Keyword adjacent to amount without currency symbol (e.g., "credited by 500.00", "received 1,500")
  const keywordAdjacentAmountRegex =
    /\b(?:debited|credited|withdrawn|deposited|spent|paid|received|sent|refunded|added|amount|sum|for|by|with|of)\s+(?:by\s+|with\s+|of\s+|for\s+|to\s+|in\s+|from\s+)*(?:rs\.?|inr|₹|\$)?\s*[:=.-]?\s*([\d,]+(?:\.\d{1,2})?)/i;

  let rawNumberStr: string | null = null;

  const matchA = currencyBeforeAmountRegex.exec(sanitized);
  if (matchA && matchA[1]) {
    rawNumberStr = matchA[1];
  } else {
    const matchB = amountBeforeCurrencyRegex.exec(sanitized);
    if (matchB && matchB[1]) {
      rawNumberStr = matchB[1];
    } else {
      const matchC = keywordAdjacentAmountRegex.exec(sanitized);
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
 * Checks if the app is running inside the native Android wrapper with Smart SMS support.
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
 * Checks whether Android SMS permission (either 1-tap Runtime SMS permission or Notification Listener) is granted.
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

export function isOverlayBubblePermissionGranted(): boolean {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.isOverlayBubblePermissionGranted === 'function') {
      return Boolean(bridge.isOverlayBubblePermissionGranted());
    }
  } catch {
    // ignore
  }
  return false;
}

export function requestOverlayBubblePermission(): void {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.requestOverlayBubblePermission === 'function') {
      bridge.requestOverlayBubblePermission();
    }
  } catch {
    // ignore
  }
}

/**
 * Requests standard 1-tap in-app Android runtime SMS & Notification permissions (Truecaller-style,
 * no Restricted Settings required), falling back to Notification Listener settings if already granted.
 */
export function openSmsNotificationAccessSettings(): void {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.requestSmsRuntimePermission === 'function') {
      const alreadyDirect =
        typeof bridge.isDirectSmsPermissionGranted === 'function' &&
        bridge.isDirectSmsPermissionGranted();
      if (!alreadyDirect) {
        bridge.requestSmsRuntimePermission();
        return;
      }
    }
    if (bridge && typeof bridge.openSmsNotificationAccessSettings === 'function') {
      bridge.openSmsNotificationAccessSettings();
    }
  } catch {
    // ignore
  }
}

/**
 * Syncs the user's SMS Auto-Detect toggle state with the native Android service.
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

export function syncNativeSmsPullDownNotifEnabled(enabled: boolean): void {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.setSmsPullDownNotificationEnabled === 'function') {
      bridge.setSmsPullDownNotificationEnabled(enabled);
    }
  } catch {
    // ignore
  }
}

export function isNativeSmsPullDownNotifEnabled(): boolean {
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.isSmsPullDownNotificationEnabled === 'function') {
      return Boolean(bridge.isSmsPullDownNotificationEnabled());
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Drains any sanitized transactions queued by the native Android SMS receiver/service
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
 * Drains any SMS transactions that the user saved in the background via the pull-down
 * notification's "Save" button (without opening the app).
 */
export function consumeNativeAutoSavedSmsTransactions(): {
  id: string;
  type: TransactionType;
  amount: number;
  category?: string;
}[] {
  try {
    const bridge = getNativeBridge();
    if (!bridge || typeof bridge.consumeAutoSavedSmsTransactions !== 'function') {
      return [];
    }
    const jsonStr = bridge.consumeAutoSavedSmsTransactions();
    if (!jsonStr) return [];
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          item.id &&
          (item.type === 'income' || item.type === 'expense') &&
          typeof item.amount === 'number' &&
          item.amount > 0
      )
      .map((item) => ({
        id: String(item.id),
        type: item.type as TransactionType,
        amount: Math.round(Number(item.amount) * 100) / 100,
        category: typeof item.category === 'string' && item.category.trim() ? item.category.trim() : undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * Marks an SMS itemId as processed in the native Android layer and cancels its
 * status-bar pull-down notification so it cannot be saved a second time.
 */
export function resolveNativeSmsTransaction(itemId: string): void {
  if (!itemId) return;
  try {
    const bridge = getNativeBridge();
    if (bridge && typeof bridge.resolveSmsTransactionInNative === 'function') {
      bridge.resolveSmsTransactionInNative(itemId);
    }
  } catch {
    // ignore
  }
}

/**
 * Drains any direct notification button action ("save" or "edit") tapped on the Android
 * Truecaller-style large drawer notification or floating bubble.
 */
export function consumeNativeNotificationAction(): {
  action: 'save' | 'edit';
  id: string;
  type: TransactionType;
  amount: number;
  category?: string;
} | null {
  try {
    const bridge = getNativeBridge();
    if (!bridge || typeof bridge.consumePendingNotificationAction !== 'function') {
      return null;
    }
    const raw = bridge.consumePendingNotificationAction();
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      (parsed.action === 'save' || parsed.action === 'edit') &&
      (parsed.type === 'income' || parsed.type === 'expense') &&
      typeof parsed.amount === 'number' &&
      parsed.amount > 0
    ) {
      return {
        action: parsed.action,
        id: String(parsed.id || ''),
        type: parsed.type,
        amount: Math.round(Number(parsed.amount) * 100) / 100,
        category: typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : undefined,
      };
    }
  } catch {
    // ignore
  }
  return null;
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
