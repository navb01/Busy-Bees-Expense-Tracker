package com.busybees.expensetracker;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Handles background actions (such as "Ignore") from the Truecaller-style large drawer notification.
 */
public class SmsNotificationActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        try {
            String actionType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE);
            String itemId = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
            int notifId = intent.getIntExtra("notif_id", -1);

            if (notifId != -1) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(notifId);
                }
            }

            if ("ignore".equals(actionType) && itemId != null) {
                SmsTransactionProcessor.removeDetectedItemFromQueue(context.getApplicationContext(), itemId);

                Intent broadcast = new Intent(SmsTransactionProcessor.ACTION_SMS_DETECTED);
                broadcast.setPackage(context.getPackageName());
                broadcast.putExtra("dismissedId", itemId);
                context.sendBroadcast(broadcast);
            }
        } catch (Exception ignored) {
        }
    }
}
