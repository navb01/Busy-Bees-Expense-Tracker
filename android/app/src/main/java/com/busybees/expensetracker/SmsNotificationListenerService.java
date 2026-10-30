package com.busybees.expensetracker;

import android.app.Notification;
import android.os.Bundle;
import android.os.Parcelable;
import android.provider.Telephony;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import java.util.Locale;

/**
 * Play Store compliant NotificationListenerService that detects transaction amounts and
 * Debit/Credit status from incoming SMS / RCS / Messaging notifications.
 *
 * Strictly filters out outgoing ("sent by You") messages in MessagingStyle threads and
 * extracts the newest incoming message from multi-message notification bundles.
 */
public class SmsNotificationListenerService extends NotificationListenerService {

    public static final String PREFS_NAME = SmsTransactionProcessor.PREFS_NAME;
    public static final String KEY_PENDING_QUEUE = SmsTransactionProcessor.KEY_PENDING_QUEUE;
    public static final String KEY_AUTO_DETECT_ENABLED = SmsTransactionProcessor.KEY_AUTO_DETECT_ENABLED;
    public static final String ACTION_SMS_DETECTED = SmsTransactionProcessor.ACTION_SMS_DETECTED;

    private static long lastProcessedMessageTimestamp = 0L;

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null) return;

        try {
            String packageName = sbn.getPackageName();
            if (packageName == null || packageName.equals(getPackageName())) {
                return;
            }

            Notification notification = sbn.getNotification();
            if (notification == null) return;

            // Ignore ongoing notifications (e.g., "Sending message...")
            if ((notification.flags & Notification.FLAG_ONGOING_EVENT) != 0) {
                return;
            }

            if (!isSmsOrMessagingNotification(packageName, notification)) {
                return;
            }

            Bundle extras = notification.extras;
            if (extras == null) return;

            String incomingMessageBody = extractLatestIncomingMessage(extras);
            if (incomingMessageBody == null || incomingMessageBody.trim().length() < 6) {
                return;
            }

            SmsTransactionProcessor.processIncomingSmsText(getApplicationContext(), incomingMessageBody);
        } catch (Exception ignored) {
            // Never crash NotificationListenerService
        }
    }

    /**
     * Extracts ONLY the latest incoming message from Notification extras, filtering out
     * outgoing/sent messages by the device user in MessagingStyle notifications.
     */
    private String extractLatestIncomingMessage(Bundle extras) {
        CharSequence selfDisplayName = extras.getCharSequence(Notification.EXTRA_SELF_DISPLAY_NAME);
        String selfName = selfDisplayName != null ? selfDisplayName.toString().trim() : "You";

        // 1. Check Notification.EXTRA_MESSAGES (MessagingStyle used by Google Messages, Samsung Messages, RCS)
        Parcelable[] messages = extras.getParcelableArray(Notification.EXTRA_MESSAGES);
        if (messages != null && messages.length > 0) {
            // Iterate backwards from the newest message in the conversation bundle
            for (int i = messages.length - 1; i >= 0; i--) {
                Parcelable p = messages[i];
                if (p instanceof Bundle) {
                    Bundle msgBundle = (Bundle) p;
                    CharSequence textCs = msgBundle.getCharSequence("text");
                    if (textCs == null) continue;

                    CharSequence senderCs = msgBundle.getCharSequence("sender");
                    Parcelable senderPerson = msgBundle.getParcelable("sender_person");
                    long msgTime = msgBundle.getLong("time", 0L);

                    // In Android MessagingStyle, a message sent by the user has sender == null & sender_person == null,
                    // or sender matching EXTRA_SELF_DISPLAY_NAME ("You"). Ignore outgoing/sent messages!
                    if (senderCs == null && senderPerson == null) {
                        return null;
                    }
                    if (senderCs != null) {
                        String senderStr = senderCs.toString().trim();
                        if (senderStr.isEmpty() ||
                            senderStr.equalsIgnoreCase("You") ||
                            senderStr.equalsIgnoreCase(selfName)) {
                            return null;
                        }
                    }

                    if (msgTime > 0 && msgTime <= lastProcessedMessageTimestamp) {
                        return null;
                    }
                    if (msgTime > 0) {
                        lastProcessedMessageTimestamp = msgTime;
                    }

                    return textCs.toString();
                }
            }
        }

        // 2. Check Notification.EXTRA_TEXT_LINES (InboxStyle multi-line notifications: newest line is last)
        CharSequence[] textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        if (textLines != null && textLines.length > 0) {
            CharSequence newestLine = textLines[textLines.length - 1];
            if (newestLine != null) {
                String lineStr = newestLine.toString().trim();
                if (!lineStr.isEmpty() && !lineStr.startsWith("You:")) {
                    return lineStr;
                }
            }
        }

        // 3. Check title for outgoing "You" indicator
        CharSequence titleCs = extras.getCharSequence(Notification.EXTRA_TITLE);
        if (titleCs != null) {
            String titleStr = titleCs.toString().trim();
            if (titleStr.equalsIgnoreCase("You") ||
                titleStr.equalsIgnoreCase(selfName) ||
                titleStr.toLowerCase(Locale.US).startsWith("sending")) {
                return null;
            }
        }

        // 4. Fallback to EXTRA_BIG_TEXT or EXTRA_TEXT
        CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence stdText = extras.getCharSequence(Notification.EXTRA_TEXT);
        String body = bigText != null
            ? bigText.toString()
            : (stdText != null ? stdText.toString() : "");

        // If body has multiple lines from a thread, prefer the last non-empty line if it contains a transaction
        if (body.contains("\n")) {
            String[] lines = body.split("\\r?\\n");
            for (int i = lines.length - 1; i >= 0; i--) {
                String candidate = lines[i].trim();
                if (candidate.length() >= 6 && SmsTransactionProcessor.parseSmsStrictly(candidate) != null) {
                    return candidate;
                }
            }
        }

        return body;
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
            lowerPkg.contains("truecaller") ||
            lowerPkg.equals("com.google.android.apps.messaging") ||
            lowerPkg.equals("com.samsung.android.messaging") ||
            lowerPkg.equals("com.android.mms") ||
            lowerPkg.equals("com.miui.mms") ||
            lowerPkg.equals("com.oneplus.mms") ||
            lowerPkg.equals("com.coloros.mms") ||
            lowerPkg.equals("com.vivo.message") ||
            lowerPkg.equals("com.microsoft.android.smsorganizer")) {
            return true;
        }

        return Notification.CATEGORY_MESSAGE.equals(notification.category);
    }
}
