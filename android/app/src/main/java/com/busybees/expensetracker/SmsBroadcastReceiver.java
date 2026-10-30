package com.busybees.expensetracker;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/**
 * Direct Incoming SMS BroadcastReceiver (works like Truecaller with standard in-app runtime
 * permission, without requiring Restricted Notification Listener settings, and ONLY fires
 * on genuinely received incoming SMS messages — never on sent messages).
 */
public class SmsBroadcastReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) {
            return;
        }

        try {
            SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
            if (messages == null || messages.length == 0) return;

            StringBuilder fullBody = new StringBuilder();
            for (SmsMessage sms : messages) {
                if (sms != null && sms.getMessageBody() != null) {
                    fullBody.append(sms.getMessageBody());
                }
            }

            String messageText = fullBody.toString().trim();
            // Clear builder immediately
            fullBody.setLength(0);

            if (messageText.length() < 6) return;

            SmsTransactionProcessor.processIncomingSmsText(context.getApplicationContext(), messageText);
        } catch (Exception ignored) {
            // Never crash BroadcastReceiver
        }
    }
}
