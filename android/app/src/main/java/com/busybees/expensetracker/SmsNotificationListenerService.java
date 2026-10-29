package com.busybees.expensetracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import androidx.core.app.NotificationCompat;
import java.text.DecimalFormat;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Play Store compliant NotificationListenerService that detects transaction amounts and
 * Debit/Credit status from incoming SMS notifications.
 *
 * STRICT PRIVACY GUARANTEE:
 * Only "expense" (Debit) or "income" (Credit) and the numeric amount are extracted.
 * Bank names, account numbers, balances, and raw SMS text are discarded immediately in memory.
 */
public class SmsNotificationListenerService extends NotificationListenerService {

    public static final String PREFS_NAME = "bb_sms_queue_prefs";
    public static final String KEY_PENDING_QUEUE = "pending_sms_json";
    public static final String KEY_AUTO_DETECT_ENABLED = "sms_auto_detect_enabled";
    public static final String ACTION_SMS_DETECTED = "com.busybees.expensetracker.SMS_TRANSACTION_DETECTED";

    private static final String CHANNEL_ID = "bb_sms_detected_channel";
    private static final int NOTIFICATION_ID_BASE = 7400;

    private static String lastSignature = "";
    private static long lastDetectedTimeMs = 0L;

    private static final Pattern IGNORE_PATTERN = Pattern.compile(
        "\\b(?:otp|one[\\s-]?time[\\s-]?password|verification\\s+code|security\\s+code|auth(?:entication)?\\s+code|pre[\\s-]?approved|eligible\\s+for|apply\\s+now|win\\s+up\\s+to|cashback\\s+up\\s+to|will\\s+be\\s+debited|is\\s+due\\s+on|minimum\\s+amount\\s+due|total\\s+amount\\s+due|statement\\s+for|mandate\\s+for)\\b",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern STRIP_BALANCE_PATTERN_1 = Pattern.compile(
        "\\b(?:avl\\.?|avail(?:able)?|updated|clear|clr|tot(?:al)?|closing|net|eff(?:ective)?|ac(?:count)?)\\s*(?:bal(?:ance)?|limit)\\s*(?:is)?\\s*[:=-]?\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\\s*[\\d,]+(?:\\.\\d{1,2})?(?:\\s*(?:cr|dr)\\.?)?",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern STRIP_BALANCE_PATTERN_2 = Pattern.compile(
        "\\bbal(?:ance)?\\s*[:=-]\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)?\\s*[\\d,]+(?:\\.\\d{1,2})?",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern DEBIT_PATTERN = Pattern.compile(
        "\\b(?:debited|withdrawn|withdrawal|spent|paid|sent|purchased|purchase|charged|deducted|dr\\.?\\b|debit\\b|auto[\\s-]?debited)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern CREDIT_PATTERN = Pattern.compile(
        "\\b(?:credited|deposited|deposit|received|refunded|refund|added|cr\\.?\\b|credit\\b|cashback\\s+of)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern CURRENCY_BEFORE_AMOUNT = Pattern.compile(
        "(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\\s*([\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern AMOUNT_BEFORE_CURRENCY = Pattern.compile(
        "\\b([\\d,]+(?:\\.\\d{1,2})?)\\s*(?:rs\\.?|inr|₹|usd|\\$|eur|€|gbp|£|aed|cad|aud|jpy|¥)\\b",
        Pattern.CASE_INSENSITIVE
    );

    private static final Pattern KEYWORD_ADJACENT_AMOUNT = Pattern.compile(
        "\\b(?:debited|credited|withdrawn|deposited|spent|paid|received|sent|for|by|with|of)\\s+(?:by\\s+|with\\s+|of\\s+)?(?:rs\\.?|inr|₹|\\$)?\\s*([\\d,]+(?:\\.\\d{1,2})?)",
        Pattern.CASE_INSENSITIVE
    );

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        try {
            String packageName = sbn.getPackageName();
            if (packageName == null || packageName.equals(getPackageName())) {
                return;
            }

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean autoDetectEnabled = prefs.getBoolean(KEY_AUTO_DETECT_ENABLED, true);
            if (!autoDetectEnabled) {
                return;
            }

            Notification notification = sbn.getNotification();
            if (notification == null) return;

            if (!isSmsOrMessagingNotification(packageName, notification)) {
                return;
            }

            Bundle extras = notification.extras;
            if (extras == null) return;

            CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence stdText = extras.getCharSequence(Notification.EXTRA_TEXT);
            String messageBody = bigText != null
                ? bigText.toString()
                : (stdText != null ? stdText.toString() : "");

            if (messageBody.trim().length() < 6) return;

            ParsedResult parsed = parseSmsStrictly(messageBody);
            // Immediately clear reference to raw message string
            messageBody = null;

            if (parsed == null) return;

            long now = System.currentTimeMillis();
            String signature = parsed.type + ":" + String.format(Locale.US, "%.2f", parsed.amount);
            if (signature.equals(lastSignature) && (now - lastDetectedTimeMs) < 12000L) {
                return;
            }
            lastSignature = signature;
            lastDetectedTimeMs = now;

            String itemId = "sms_" + now + "_" + (int) (Math.random() * 9000 + 1000);
            enqueueDetectedItem(prefs, itemId, parsed.type, parsed.amount, now);

            // Broadcast to MainActivity if app is currently in foreground
            Intent broadcast = new Intent(ACTION_SMS_DETECTED);
            broadcast.setPackage(getPackageName());
            broadcast.putExtra("id", itemId);
            broadcast.putExtra("type", parsed.type);
            broadcast.putExtra("amount", parsed.amount);
            broadcast.putExtra("detectedAt", now);
            sendBroadcast(broadcast);

            // Post a heads-up notification so user can tap to Save or Edit in Busy Bees
            showDetectedHeadsUpNotification(parsed.type, parsed.amount);
        } catch (Exception ignored) {
            // Never crash NotificationListenerService
        }
    }

    private boolean isSmsOrMessagingNotification(String pkg, Notification notification) {
        try {
            String defaultSmsPkg = Telephony.Sms.getDefaultSmsPackage(this);
            if (defaultSmsPkg != null && defaultSmsPkg.equals(pkg)) {
                return true;
            }
        } catch (Exception ignored) {
        }

        String lowerPkg = pkg.toLowerCase(Locale.US);
        if (lowerPkg.contains("mms") ||
            lowerPkg.contains("sms") ||
            lowerPkg.contains("messaging") ||
            lowerPkg.equals("com.google.android.apps.messaging") ||
            lowerPkg.equals("com.samsung.android.messaging") ||
            lowerPkg.equals("com.android.mms") ||
            lowerPkg.equals("com.oneplus.mms") ||
            lowerPkg.equals("com.coloros.mms")) {
            return true;
        }

        return Notification.CATEGORY_MESSAGE.equals(notification.category);
    }

    private static class ParsedResult {
        final String type; // "expense" or "income"
        final double amount;

        ParsedResult(String type, double amount) {
            this.type = type;
            this.amount = amount;
        }
    }

    private ParsedResult parseSmsStrictly(String rawText) {
        if (rawText == null) return null;
        String trimmed = rawText.trim();
        if (trimmed.length() < 6 || trimmed.length() > 1000) return null;

        if (IGNORE_PATTERN.matcher(trimmed).find()) {
            return null;
        }

        String sanitized = STRIP_BALANCE_PATTERN_1.matcher(trimmed).replaceAll(" ");
        sanitized = STRIP_BALANCE_PATTERN_2.matcher(sanitized).replaceAll(" ");

        Matcher debitMatcher = DEBIT_PATTERN.matcher(sanitized);
        Matcher creditMatcher = CREDIT_PATTERN.matcher(sanitized);

        boolean hasDebit = debitMatcher.find();
        boolean hasCredit = creditMatcher.find();

        if (!hasDebit && !hasCredit) {
            return null;
        }

        String detectedType;
        if (hasDebit && hasCredit) {
            detectedType = debitMatcher.start() <= creditMatcher.start() ? "expense" : "income";
        } else if (hasDebit) {
            detectedType = "expense";
        } else {
            detectedType = "income";
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
            double val = Double.parseDouble(rawAmount.replace(",", ""));
            if (Double.isNaN(val) || Double.isInfinite(val) || val <= 0 || val > 1000000000) {
                return null;
            }
            double rounded = Math.round(val * 100.0) / 100.0;
            return new ParsedResult(detectedType, rounded);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void enqueueDetectedItem(
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

    private void showDetectedHeadsUpNotification(String type, double amount) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Detected SMS Transactions",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Prompts you to save or edit transactions detected from SMS");
                nm.createNotificationChannel(channel);
            }

            Intent launchIntent = new Intent(this, MainActivity.class);
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, flags);

            DecimalFormat df = new DecimalFormat("#,##0.00");
            String label = "expense".equals(type) ? "Debit (Expense)" : "Credit (Income)";
            String title = "Transaction Detected";
            String body = label + " of " + df.format(amount) + " detected. Tap to Save or Edit.";

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent);

            nm.notify(NOTIFICATION_ID_BASE + (int) (System.currentTimeMillis() % 500), builder.build());
        } catch (Exception ignored) {
        }
    }
}
