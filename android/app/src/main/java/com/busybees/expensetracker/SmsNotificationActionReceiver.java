package com.busybees.expensetracker;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

/**
 * Handles background actions ("Save", "Ignore", and interactive Category Dropdown selection)
 * from the Truecaller-style pull-down notification without opening the app.
 * Only "Edit" opens MainActivity.
 */
public class SmsNotificationActionReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        try {
            String actionType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE);
            if ("noop".equals(actionType)) {
                return;
            }

            String itemId = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
            String txType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_TYPE);
            double txAmount = intent.getDoubleExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, 0.0);
            String txCategory = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_CATEGORY);
            int notifId = intent.getIntExtra("notif_id", -1);

            Context appCtx = context.getApplicationContext();
            String safeType = "income".equals(txType) ? "income" : "expense";
            String safeCategory = (txCategory != null && !txCategory.trim().isEmpty())
                ? txCategory.trim()
                : ("income".equals(safeType) ? "Salary" : "Shopping");

            // Interactive Category Dropdown toggle inside the pull-down notification
            if ("toggle_category_dropdown".equals(actionType) && itemId != null && txAmount > 0) {
                boolean expanded = intent.getBooleanExtra(
                    SmsTransactionProcessor.EXTRA_DROPDOWN_EXPANDED,
                    false
                );
                SmsTransactionProcessor.showTruecallerStyleDrawerNotification(
                    appCtx,
                    itemId,
                    safeType,
                    txAmount,
                    safeCategory,
                    expanded,
                    true
                );
                return;
            }

            // Selecting a Category option inside the pull-down notification
            if ("select_category".equals(actionType) && itemId != null && txAmount > 0) {
                SmsTransactionProcessor.showTruecallerStyleDrawerNotification(
                    appCtx,
                    itemId,
                    safeType,
                    txAmount,
                    safeCategory,
                    false,
                    true
                );
                return;
            }

            if (notifId != -1) {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(notifId);
                }
            }

            if ("save".equals(actionType) && itemId != null && txAmount > 0) {
                // Ensure this itemId has not already been saved or ignored via the floating bubble
                boolean firstTime = SmsTransactionProcessor.markItemProcessedOnce(appCtx, itemId);
                SmsTransactionProcessor.removeDetectedItemFromQueue(appCtx, itemId);
                SmsFloatingBubbleService.dismissIfMatching(appCtx, itemId);

                if (firstTime) {
                    SmsTransactionProcessor.enqueueAutoSavedItem(
                        appCtx,
                        itemId,
                        safeType,
                        txAmount,
                        safeCategory
                    );

                    Intent broadcast = new Intent(SmsTransactionProcessor.ACTION_SMS_DETECTED);
                    broadcast.setPackage(context.getPackageName());
                    broadcast.putExtra("autoSavedId", itemId);
                    broadcast.putExtra("type", safeType);
                    broadcast.putExtra("amount", txAmount);
                    broadcast.putExtra("category", safeCategory);
                    broadcast.putExtra("dismissedId", itemId);
                    context.sendBroadcast(broadcast);

                    String label = "income".equals(safeType) ? "Income" : "Expense";
                    Toast.makeText(
                        appCtx,
                        label + " saved (" + safeCategory + ")",
                        Toast.LENGTH_SHORT
                    ).show();
                } else {
                    Intent broadcast = new Intent(SmsTransactionProcessor.ACTION_SMS_DETECTED);
                    broadcast.setPackage(context.getPackageName());
                    broadcast.putExtra("dismissedId", itemId);
                    context.sendBroadcast(broadcast);
                }
            } else if ("ignore".equals(actionType) && itemId != null) {
                SmsTransactionProcessor.markItemProcessedOnce(appCtx, itemId);
                SmsTransactionProcessor.removeDetectedItemFromQueue(appCtx, itemId);
                SmsFloatingBubbleService.dismissIfMatching(appCtx, itemId);

                Intent broadcast = new Intent(SmsTransactionProcessor.ACTION_SMS_DETECTED);
                broadcast.setPackage(context.getPackageName());
                broadcast.putExtra("dismissedId", itemId);
                context.sendBroadcast(broadcast);
            }
        } catch (Exception ignored) {
        }
    }
}
