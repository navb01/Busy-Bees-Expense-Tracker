package com.busybees.expensetracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Build;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import java.text.DecimalFormat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Shared on-device SMS Transaction Processor used by both SmsBroadcastReceiver
 * (direct incoming SMS_RECEIVED intent) and SmsNotificationListenerService.
 *
 * STRICT PRIVACY GUARANTEE:
 * Extracts ONLY Debit ("expense") or Credit ("income") and numeric Amount.
 * Bank names, account numbers, balances, and raw SMS text are discarded immediately in memory.
 */
public final class SmsTransactionProcessor {

    public static final String PREFS_NAME = "bb_sms_queue_prefs";
    public static final String KEY_PENDING_QUEUE = "pending_sms_json";
    public static final String KEY_AUTO_DETECT_ENABLED = "sms_auto_detect_enabled";
    public static final String KEY_LAST_SIGNATURE = "last_sms_signature";
    public static final String KEY_LAST_DETECTED_MS = "last_sms_detected_ms";

    public static final String ACTION_SMS_DETECTED = "com.busybees.expensetracker.SMS_TRANSACTION_DETECTED";
    public static final String ACTION_NOTIFICATION_BUTTON = "com.busybees.expensetracker.SMS_NOTIFICATION_ACTION";

    public static final String EXTRA_ACTION_TYPE = "extra_action_type"; // "save", "edit", "ignore"
    public static final String EXTRA_ITEM_ID = "extra_item_id";
    public static final String EXTRA_TX_TYPE = "extra_tx_type";
    public static final String EXTRA_TX_AMOUNT = "extra_tx_amount";

    private static final String CHANNEL_ID = "bb_truecaller_sms_drawer_v3";

    private SmsTransactionProcessor() {}

    public static final class ParsedResult {
        public final String type; // "expense" or "income"
        public final double amount;

        public ParsedResult(String type, double amount) {
            this.type = type;
            this.amount = amount;
        }
    }

    // 1. Reject OTPs, login codes, promotional offers, and future bill/mandate reminders
    private static final Pattern IGNORE_PATTERN = Pattern.compile(
        "\\b(?:otp|one[\\s-]?time[\\s-]?password|verification\\s+code|security\\s+code|auth(?:entication)?\\s+code|login\\s+code|secret\\s+code|do\\s+not\\s+share\\s+(?:this\\s+)?(?:otp|code)|pre[\\s-]?approved|eligible\\s+for|apply\\s+now|win\\s+up\\s+to|cashback\\s+up\\s+to|will\\s+be\\s+debited|is\\s+due\\s+on|minimum\\s+amount\\s+due|total\\s+amount\\s+due|statement\\s+for|mandate\\s+for|emi\\s+of\\s+.*\\s+is\\s+due)\\b",
        Pattern.CASE_INSENSITIVE
    );

    // 2. Strip balance / credit-limit clauses first so remaining balance is never mistaken for transaction amount
    private static final Pattern STRIP_BALANCE_PATTERN_1 = Pattern.compile(
        "\\b(?:avl\\.?|avail(?:able)?|updated|clear|clr|tot(?:al)?|closing|current|curr|net|eff(?:ective)?|ac(?:count)?|combined)\\s*(?:bal(?:ance)?|limit|val(?:ue)?)\\s*(?:is)?\\s*[:=-]?\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\\s*[\\d,]+(?:\\.\\d{1,2})?(?:\\s*(?:cr|dr)\\.?)?",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern STRIP_BALANCE_PATTERN_2 = Pattern.compile(
        "\\b(?:bal(?:ance)?|limit)\\s*(?:is)?\\s*[:=-]\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\\s*[\\d,]+(?:\\.\\d{1,2})?(?:\\s*(?:cr|dr)\\.?)?",
        Pattern.CASE_INSENSITIVE
    );

    // Strip UPI/IMPS/NEFT reference strings (e.g., UPI/DR/430212345/Name or Ref No 123456789) so "DR"/"CR" or digits inside ref IDs don't confuse parser
    private static final Pattern STRIP_REF_IDS = Pattern.compile(
        "\\b(?:upi|imps|neft|rtgs|mmt|ach|ecs|utr|rrn|ref(?:\\.?\\s*no\\.?|\\s*id)?)\\s*[:/#-]?\\s*[a-z0-9/@._-]{5,}",
        Pattern.CASE_INSENSITIVE
    );

    // Strip masked account / card numbers (e.g. A/c XX1234, Acct *5678, Card ending 4321)
    private static final Pattern STRIP_ACCOUNT_NUMBERS = Pattern.compile(
        "\\b(?:a/?c|acct|account|card)\\s*(?:no\\.?|number|ending(?:\\s+with)?|#)?\\s*[x*#.-]*\\d{2,8}\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Strip dates like 29-10-2026 or 29/10/26 or 29-Oct-26
    private static final Pattern STRIP_DATES = Pattern.compile(
        "\\b\\d{1,2}[-/\\s](?:\\d{1,2}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-/\\s]\\d{2,4}\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Explicit user-account Credit indicators (high confidence income)
    private static final Pattern EXPLICIT_USER_CREDIT = Pattern.compile(
        "\\b(?:credited|deposited|refunded|reimbursed|cashback\\s+(?:of|received|credited)|money\\s+received|payment\\s+received|amount\\s+received|received\\s+(?:in|into|from|via|by)|added\\s+(?:to|in|into)\\s+(?:your\\s+)?(?:a/?c|acct|account|wallet|bank)|(?:sent|transferred|paid)\\s+to\\s+your\\s+(?:a/?c|acct|account|wallet|bank)|(?:a/?c|acct|account|wallet)\\s+(?:is\\s+|has\\s+been\\s+)?cr\\.?\\b|cr\\.?\\s+(?:to|in|by|with)\\s+(?:your\\s+)?(?:a/?c|acct|account)|credit\\s+(?:of|by|with|for|in|to|alert)\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // Explicit user-account Debit indicators (high confidence expense)
    private static final Pattern EXPLICIT_USER_DEBIT = Pattern.compile(
        "\\b(?:debited|withdrawn|withdrawal|deducted|spent|purchased|charged|auto[\\s-]?debited|(?:a/?c|acct|account|wallet|card)\\s+(?:is\\s+|has\\s+been\\s+)?dr\\.?\\b|dr\\.?\\s+from\\s+(?:your\\s+)?(?:a/?c|acct|account)|debit\\s+(?:of|by|with|for|from|alert)\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // Secondary Debit keywords (only used if no explicit Credit indicator is present, because "sent by X ... credited to your A/c" is Credit!)
    private static final Pattern SECONDARY_DEBIT = Pattern.compile(
        "\\b(?:paid|sent|transferred|purchase|payment\\s+of|payment\\s+to)\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Secondary Credit keywords
    private static final Pattern SECONDARY_CREDIT = Pattern.compile(
        "\\b(?:received|deposit|refund|added|credit|cr\\b)\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Explicit phrase showing user's own account was debited (e.g. "debited from your A/c ... and credited to ...")
    private static final Pattern USER_ACCOUNT_DEBITED_FIRST = Pattern.compile(
        "(?:debited\\s+from\\s+(?:your\\s+)?(?:a/?c|acct|account)|your\\s+(?:a/?c|acct|account).*?\\bdebited\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // Explicit phrase showing user's own account was credited (e.g. "sent from ... and credited to your A/c")
    private static final Pattern USER_ACCOUNT_CREDITED = Pattern.compile(
        "(?:credited\\s+(?:to|in|into|by|with)\\s+(?:your\\s+)?(?:a/?c|acct|account)?|your\\s+(?:a/?c|acct|account).*?\\b(?:credited|deposited|cr)\\b)",
        Pattern.CASE_INSENSITIVE
    );

    // Priority A: Currency marker before number (e.g., Rs. 450.00, Rs.450, INR 1,200, ₹500, $29.99)
    private static final Pattern CURRENCY_BEFORE_AMOUNT = Pattern.compile(
        "(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\\s*[:=.-]?\\s*([\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    // Priority B: Number before currency marker (e.g., 450.00 INR, 1200 Rs)
    private static final Pattern AMOUNT_BEFORE_CURRENCY = Pattern.compile(
        "\\b([\\d,]+(?:\\.\\d{1,2})?)\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\\b",
        Pattern.CASE_INSENSITIVE
    );

    // Priority C: Keyword adjacent to amount (e.g., "credited by 500.00", "received 1,500", "debited with 250")
    private static final Pattern KEYWORD_ADJACENT_AMOUNT = Pattern.compile(
        "\\b(?:debited|credited|withdrawn|deposited|spent|paid|received|sent|refunded|added|amount|sum|for|by|with|of)\\s+(?:by\\s+|with\\s+|of\\s+|for\\s+|to\\s+|in\\s+|from\\s+)*(?:rs\\.?|inr|₹|\\$)?\\s*[:=.-]?\\s*([\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    public static ParsedResult parseSmsStrictly(String rawText) {
        if (rawText == null) return null;
        String trimmed = rawText.trim();
        if (trimmed.length() < 6 || trimmed.length() > 1500) return null;

        // Ignore outgoing self-messages if prefixed with "You:"
        if (trimmed.startsWith("You:") || trimmed.startsWith("you:")) {
            return null;
        }

        if (IGNORE_PATTERN.matcher(trimmed).find()) {
            return null;
        }

        // Sanitize balance clauses, reference IDs, masked account numbers, and dates
        String sanitized = STRIP_BALANCE_PATTERN_1.matcher(trimmed).replaceAll(" ");
        sanitized = STRIP_BALANCE_PATTERN_2.matcher(sanitized).replaceAll(" ");
        sanitized = STRIP_REF_IDS.matcher(sanitized).replaceAll(" ");
        sanitized = STRIP_ACCOUNT_NUMBERS.matcher(sanitized).replaceAll(" ");
        sanitized = STRIP_DATES.matcher(sanitized).replaceAll(" ");

        Matcher explicitCreditMatcher = EXPLICIT_USER_CREDIT.matcher(sanitized);
        Matcher explicitDebitMatcher = EXPLICIT_USER_DEBIT.matcher(sanitized);

        boolean hasExplicitCredit = explicitCreditMatcher.find();
        boolean hasExplicitDebit = explicitDebitMatcher.find();

        String detectedType = null;

        if (hasExplicitCredit && hasExplicitDebit) {
            // Both explicit credit and debit words exist (e.g., "debited from X and credited to Y")
            boolean userCredited = USER_ACCOUNT_CREDITED.matcher(sanitized).find();
            boolean userDebited = USER_ACCOUNT_DEBITED_FIRST.matcher(sanitized).find();
            if (userCredited && !userDebited) {
                detectedType = "income";
            } else if (userDebited && !userCredited) {
                detectedType = "expense";
            } else {
                detectedType = explicitCreditMatcher.start() < explicitDebitMatcher.start() ? "income" : "expense";
            }
        } else if (hasExplicitCredit) {
            // Note: even if "sent" or "paid" is in the message (e.g. "Rs 500 sent by Rahul is credited to your A/c"),
            // explicit credit ("credited", "deposited", "received in", etc.) ALWAYS wins as income!
            detectedType = "income";
        } else if (hasExplicitDebit) {
            detectedType = "expense";
        } else {
            // Check secondary credit/debit patterns
            Matcher secCredit = SECONDARY_CREDIT.matcher(sanitized);
            Matcher secDebit = SECONDARY_DEBIT.matcher(sanitized);
            boolean hasSecCredit = secCredit.find();
            boolean hasSecDebit = secDebit.find();

            if (hasSecCredit && !hasSecDebit) {
                detectedType = "income";
            } else if (hasSecDebit && !hasSecCredit) {
                detectedType = "expense";
            } else if (hasSecCredit && hasSecDebit) {
                detectedType = secCredit.start() <= secDebit.start() ? "income" : "expense";
            }
        }

        if (detectedType == null) {
            return null;
        }

        String rawAmount = null;
        Matcher m1 = CURRENCY_BEFORE_AMOUNT.matcher(sanitized);
        if (m1.find()) {
            rawAmount = m1.group(1);
        } else {
            Matcher m2 = AMOUNT_BEFORE_CURRENCY.matcher(sanitized);
            if (m2.find()) {
                rawAmount = m2.group(1);
            } else {
                Matcher m3 = KEYWORD_ADJACENT_AMOUNT.matcher(sanitized);
                if (m3.find()) {
                    rawAmount = m3.group(1);
                }
            }
        }

        if (rawAmount == null) return null;

        try {
            String cleanNum = rawAmount.replace(",", "").trim();
            double val = Double.parseDouble(cleanNum);
            if (Double.isNaN(val) || Double.isInfinite(val) || val <= 0 || val > 1000000000) {
                return null;
            }
            double rounded = Math.round(val * 100.0) / 100.0;
            return new ParsedResult(detectedType, rounded);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    public static synchronized void processIncomingSmsText(Context context, String rawSmsBody) {
        if (context == null || rawSmsBody == null) return;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean autoDetectEnabled = prefs.getBoolean(KEY_AUTO_DETECT_ENABLED, true);
            if (!autoDetectEnabled) {
                return;
            }

            ParsedResult parsed = parseSmsStrictly(rawSmsBody);
            // Immediately clear reference to raw message string
            rawSmsBody = null;

            if (parsed == null) return;

            long now = System.currentTimeMillis();
            String signature = parsed.type + ":" + String.format(Locale.US, "%.2f", parsed.amount);

            String lastSig = prefs.getString(KEY_LAST_SIGNATURE, "");
            long lastTime = prefs.getLong(KEY_LAST_DETECTED_MS, 0L);

            // Deduplicate within 15 seconds across SmsBroadcastReceiver and SmsNotificationListenerService
            if (signature.equals(lastSig) && Math.abs(now - lastTime) < 15000L) {
                return;
            }

            String itemId = "sms_" + now + "_" + (int) (Math.random() * 9000 + 1000);

            prefs.edit()
                .putString(KEY_LAST_SIGNATURE, signature)
                .putLong(KEY_LAST_DETECTED_MS, now)
                .apply();

            enqueueDetectedItem(prefs, itemId, parsed.type, parsed.amount, now);

            // Broadcast to MainActivity if app is currently in foreground
            Intent broadcast = new Intent(ACTION_SMS_DETECTED);
            broadcast.setPackage(context.getPackageName());
            broadcast.putExtra("id", itemId);
            broadcast.putExtra("type", parsed.type);
            broadcast.putExtra("amount", parsed.amount);
            broadcast.putExtra("detectedAt", now);
            context.sendBroadcast(broadcast);

            // Launch FB Messenger-Style Floating Bubble Overlay (if overlay permission is granted)
            SmsFloatingBubbleService.showBubble(context.getApplicationContext(), itemId, parsed.type, parsed.amount);

            // Show Truecaller-Style Large Drawer Notification
            showTruecallerStyleDrawerNotification(context, itemId, parsed.type, parsed.amount);
        } catch (Exception ignored) {
        }
    }

    private static void enqueueDetectedItem(
        SharedPreferences prefs,
        String id,
        String type,
        double amount,
        long detectedAt
    ) {
        try {
            String existingJson = prefs.getString(KEY_PENDING_QUEUE, "[]");
            JSONArray arr = new JSONArray(existingJson);

            JSONObject obj = new JSONObject();
            obj.put("id", id);
            obj.put("type", type);
            obj.put("amount", amount);
            obj.put("detectedAt", detectedAt);

            arr.put(obj);
            prefs.edit().putString(KEY_PENDING_QUEUE, arr.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    public static void removeDetectedItemFromQueue(Context context, String itemId) {
        if (context == null || itemId == null) return;
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String existingJson = prefs.getString(KEY_PENDING_QUEUE, "[]");
            JSONArray arr = new JSONArray(existingJson);
            JSONArray filtered = new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.optJSONObject(i);
                if (obj != null && !itemId.equals(obj.optString("id"))) {
                    filtered.put(obj);
                }
            }
            prefs.edit().putString(KEY_PENDING_QUEUE, filtered.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private static void showTruecallerStyleDrawerNotification(
        Context context,
        String itemId,
        String type,
        double amount
    ) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Smart SMS Transaction Drawer",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Truecaller-style large drawer popup for detected SMS transactions");
                channel.enableVibration(true);
                channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
                nm.createNotificationChannel(channel);
            }

            int notifId = Math.abs(itemId.hashCode());
            boolean isIncome = "income".equals(type);
            int headerColor = isIncome ? Color.parseColor("#059669") : Color.parseColor("#2357A4");

            DecimalFormat df = new DecimalFormat("#,##0.00");
            String formattedAmount = "₹" + df.format(amount);
            String typeLabel = isIncome ? "CREDIT (INCOME)" : "DEBIT (EXPENSE)";
            String shortLabel = isIncome ? "Credit (Income)" : "Debit (Expense)";

            int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                piFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            // Main tap intent -> opens Busy Bees drawer
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra(EXTRA_ITEM_ID, itemId);
            PendingIntent contentPendingIntent = PendingIntent.getActivity(context, notifId, openIntent, piFlags);

            // 1. SAVE Button Intent (L -> R #1)
            Intent saveIntent = new Intent(context, MainActivity.class);
            saveIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            saveIntent.putExtra(EXTRA_ACTION_TYPE, "save");
            saveIntent.putExtra(EXTRA_ITEM_ID, itemId);
            saveIntent.putExtra(EXTRA_TX_TYPE, type);
            saveIntent.putExtra(EXTRA_TX_AMOUNT, amount);
            saveIntent.putExtra("notif_id", notifId);
            PendingIntent savePendingIntent = PendingIntent.getActivity(context, notifId + 1, saveIntent, piFlags);

            // 2. EDIT Button Intent (L -> R #2)
            Intent editIntent = new Intent(context, MainActivity.class);
            editIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            editIntent.putExtra(EXTRA_ACTION_TYPE, "edit");
            editIntent.putExtra(EXTRA_ITEM_ID, itemId);
            editIntent.putExtra(EXTRA_TX_TYPE, type);
            editIntent.putExtra(EXTRA_TX_AMOUNT, amount);
            editIntent.putExtra("notif_id", notifId);
            PendingIntent editPendingIntent = PendingIntent.getActivity(context, notifId + 2, editIntent, piFlags);

            // 3. IGNORE Button Intent (L -> R #3 - handled in background without opening app!)
            Intent ignoreIntent = new Intent(context, SmsNotificationActionReceiver.class);
            ignoreIntent.setAction(ACTION_NOTIFICATION_BUTTON);
            ignoreIntent.putExtra(EXTRA_ACTION_TYPE, "ignore");
            ignoreIntent.putExtra(EXTRA_ITEM_ID, itemId);
            ignoreIntent.putExtra("notif_id", notifId);
            PendingIntent ignorePendingIntent = PendingIntent.getBroadcast(context, notifId + 3, ignoreIntent, piFlags);

            // Build Truecaller-Style Collapsed & Large Expanded Drawer RemoteViews
            RemoteViews collapsedView = new RemoteViews(context.getPackageName(), R.layout.notification_sms_collapsed);
            collapsedView.setInt(R.id.notif_collapsed_root, "setBackgroundColor", headerColor);
            collapsedView.setTextViewText(R.id.notif_collapsed_badge, "TRANSACTION DETECTED");
            collapsedView.setTextViewText(R.id.notif_collapsed_title, shortLabel + " • " + formattedAmount);

            RemoteViews drawerView = new RemoteViews(context.getPackageName(), R.layout.notification_sms_drawer);
            drawerView.setInt(R.id.notif_drawer_header, "setBackgroundColor", headerColor);
            drawerView.setTextViewText(R.id.notif_drawer_title, "TRANSACTION DETECTED");
            drawerView.setTextViewText(R.id.notif_drawer_type_pill, typeLabel);
            drawerView.setTextViewText(R.id.notif_drawer_amount, formattedAmount);
            drawerView.setInt(R.id.notif_btn_save, "setBackgroundColor", headerColor);

            drawerView.setOnClickPendingIntent(R.id.notif_btn_save, savePendingIntent);
            drawerView.setOnClickPendingIntent(R.id.notif_btn_edit, editPendingIntent);
            drawerView.setOnClickPendingIntent(R.id.notif_btn_ignore, ignorePendingIntent);

            String fallbackTitle = "TRANSACTION DETECTED • " + formattedAmount;
            String fallbackBody = shortLabel + " of " + formattedAmount + " detected. Tap Save, Edit, or Ignore.";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.stat_notify_chat)
                .setColor(headerColor)
                .setColorized(true)
                .setContentTitle(fallbackTitle)
                .setContentText(fallbackBody)
                .setStyle(new NotificationCompat.BigTextStyle()
                    .setBigContentTitle("TRANSACTION DETECTED")
                    .bigText(shortLabel + " • " + formattedAmount + "\nOnly Debit/Credit & Amount captured. Zero bank info stored.")
                    .setSummaryText(typeLabel))
                .setCustomContentView(collapsedView)
                .setCustomBigContentView(drawerView)
                .setCustomHeadsUpContentView(drawerView)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(contentPendingIntent)
                .addAction(0, "Save", savePendingIntent)
                .addAction(0, "Edit", editPendingIntent)
                .addAction(0, "Ignore", ignorePendingIntent);

            nm.notify(notifId, builder.build());
        } catch (Exception ignored) {
        }
    }
}
