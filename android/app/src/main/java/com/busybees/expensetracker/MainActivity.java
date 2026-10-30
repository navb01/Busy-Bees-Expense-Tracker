package com.busybees.expensetracker;

import android.Manifest;
import android.accounts.AccountManager;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {

    private static final int REQ_CODE_SMS_PERMISSIONS = 4101;
    private static final int REQ_CODE_PICK_GOOGLE_ACCOUNT = 4102;
    private static final int REQ_CODE_DRIVE_CREATE_DOC = 4103;
    private static final int REQ_CODE_DRIVE_OPEN_DOC = 4104;

    private static final String DRIVE_PREFS_NAME = "bb_native_drive_prefs";
    private static final String KEY_DRIVE_EMAIL = "connected_google_email";
    private static final String KEY_DRIVE_LAST_JSON = "cached_backup_json";
    private static final String KEY_DRIVE_LAST_MODIFIED = "cached_backup_modified_ms";
    private static final String KEY_PENDING_NOTIF_ACTION = "pending_notif_action_json";

    private String pendingBackupJsonToWrite = null;

    private final BroadcastReceiver smsDetectedReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || bridge == null || bridge.getWebView() == null) return;

            String dismissedId = intent.getStringExtra("dismissedId");
            if (dismissedId != null) {
                String safeDismissed = dismissedId.replace("'", "");
                String js = String.format(
                    Locale.US,
                    "window.dispatchEvent(new CustomEvent('bb-sms-detected', { detail: { dismissedId: '%s' } }));",
                    safeDismissed
                );
                bridge.getWebView().evaluateJavascript(js, null);
                return;
            }

            String id = intent.getStringExtra("id");
            String type = intent.getStringExtra("type");
            double amount = intent.getDoubleExtra("amount", 0.0);
            long detectedAt = intent.getLongExtra("detectedAt", System.currentTimeMillis());
            if (type == null || amount <= 0) return;

            String safeId = id == null ? "" : id.replace("'", "");
            String safeType = "income".equals(type) ? "income" : "expense";
            String js = String.format(
                Locale.US,
                "window.dispatchEvent(new CustomEvent('bb-sms-detected', { detail: { id: '%s', type: '%s', amount: %.2f, detectedAt: %d } }));",
                safeId,
                safeType,
                amount,
                detectedAt
            );
            bridge.getWebView().evaluateJavascript(js, null);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        updateSystemBarAppearance(true);
        captureNotificationActionIntent(getIntent());

        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void exitApp() {
                    runOnUiThread(() -> {
                        finishAffinity();
                        System.exit(0);
                    });
                }

                @JavascriptInterface
                public void setDarkMode(boolean isDark) {
                    runOnUiThread(() -> updateSystemBarAppearance(isDark));
                }

                @JavascriptInterface
                public String isBiometricAvailable() {
                    BiometricManager biometricManager = BiometricManager.from(MainActivity.this);
                    int result = biometricManager.canAuthenticate(
                        BiometricManager.Authenticators.BIOMETRIC_STRONG |
                        BiometricManager.Authenticators.BIOMETRIC_WEAK
                    );
                    if (result == BiometricManager.BIOMETRIC_SUCCESS) {
                        return "AVAILABLE";
                    } else if (result == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
                        return "NONE_ENROLLED";
                    } else {
                        return "UNAVAILABLE";
                    }
                }

                @JavascriptInterface
                public void authenticateBiometric() {
                    runOnUiThread(() -> launchBiometricPrompt());
                }

                @JavascriptInterface
                public boolean isSmsNotificationAccessGranted() {
                    return isDirectSmsPermissionGranted() || isNotificationListenerEnabled();
                }

                @JavascriptInterface
                public boolean isDirectSmsPermissionGranted() {
                    return ContextCompat.checkSelfPermission(
                        MainActivity.this,
                        Manifest.permission.RECEIVE_SMS
                    ) == PackageManager.PERMISSION_GRANTED;
                }

                @JavascriptInterface
                public boolean isNotificationListenerAccessGranted() {
                    return isNotificationListenerEnabled();
                }

                @JavascriptInterface
                public boolean isOverlayBubblePermissionGranted() {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        return Settings.canDrawOverlays(MainActivity.this);
                    }
                    return true;
                }

                @JavascriptInterface
                public void requestOverlayBubblePermission() {
                    runOnUiThread(() -> {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                            try {
                                Intent intent = new Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:" + getPackageName())
                                );
                                startActivity(intent);
                            } catch (Exception ignored) {
                            }
                        }
                    });
                }

                @JavascriptInterface
                public void requestSmsRuntimePermission() {
                    runOnUiThread(() -> promptForSmsAndNotificationPermissions());
                }

                @JavascriptInterface
                public void openSmsNotificationAccessSettings() {
                    runOnUiThread(() -> {
                        // First request standard runtime permission if not yet granted (Truecaller-style 1-tap dialog)
                        if (!isDirectSmsPermissionGranted()) {
                            promptForSmsAndNotificationPermissions();
                            return;
                        }
                        try {
                            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                            startActivity(intent);
                        } catch (Exception ignored) {
                        }
                    });
                }

                @JavascriptInterface
                public void openNotificationListenerSettingsDirect() {
                    runOnUiThread(() -> {
                        try {
                            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS);
                            startActivity(intent);
                        } catch (Exception ignored) {
                        }
                    });
                }

                @JavascriptInterface
                public String consumePendingSmsTransactions() {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsTransactionProcessor.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    String pending = prefs.getString(
                        SmsTransactionProcessor.KEY_PENDING_QUEUE,
                        "[]"
                    );
                    prefs.edit().putString(SmsTransactionProcessor.KEY_PENDING_QUEUE, "[]").apply();
                    return pending != null ? pending : "[]";
                }

                @JavascriptInterface
                public String consumePendingNotificationAction() {
                    SharedPreferences prefs = getSharedPreferences(
                        DRIVE_PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    String actionJson = prefs.getString(KEY_PENDING_NOTIF_ACTION, "");
                    if (actionJson != null && !actionJson.isEmpty()) {
                        prefs.edit().remove(KEY_PENDING_NOTIF_ACTION).apply();
                    }
                    return actionJson != null ? actionJson : "";
                }

                @JavascriptInterface
                public void setSmsAutoDetectEnabled(boolean enabled) {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsTransactionProcessor.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    prefs.edit().putBoolean(
                        SmsTransactionProcessor.KEY_AUTO_DETECT_ENABLED,
                        enabled
                    ).apply();
                    if (enabled && !isDirectSmsPermissionGranted()) {
                        runOnUiThread(() -> promptForSmsAndNotificationPermissions());
                    }
                }

                // =========================================================================
                // NATIVE ANDROID GOOGLE DRIVE BACKUP & RESTORE BRIDGE
                // =========================================================================

                @JavascriptInterface
                public boolean isNativeDriveSupported() {
                    return true;
                }

                @JavascriptInterface
                public String getConnectedGoogleEmail() {
                    SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                    return prefs.getString(KEY_DRIVE_EMAIL, "");
                }

                @JavascriptInterface
                public void disconnectGoogleAccount() {
                    SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit().remove(KEY_DRIVE_EMAIL).apply();
                }

                @JavascriptInterface
                public void connectGoogleAccount() {
                    runOnUiThread(() -> launchNativeGoogleAccountPicker());
                }

                @JavascriptInterface
                public void saveBackupToGoogleDrive(String jsonContent, String fileName, boolean interactiveSaveToDrive) {
                    if (jsonContent == null || jsonContent.isEmpty()) return;
                    long now = System.currentTimeMillis();

                    // 1. Always persist to internal Auto-Backup file + preferences cache
                    saveInternalBackupCopy(jsonContent, now);

                    if (!interactiveSaveToDrive) {
                        dispatchDriveEvent("bb-native-drive-backup-result", true, "", now, jsonContent.getBytes(StandardCharsets.UTF_8).length);
                        return;
                    }

                    // 2. Launch Google Drive document saver sheet so user can also store the file visibly in Google Drive
                    runOnUiThread(() -> launchGoogleDriveCreateDocument(jsonContent, fileName != null ? fileName : "busy_bees_expense_tracker_backup.json"));
                }

                @JavascriptInterface
                public String getCachedBackupMetadataJson() {
                    try {
                        String json = readInternalBackupCopy();
                        if (json == null || json.isEmpty()) {
                            return "";
                        }
                        SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                        long modTime = prefs.getLong(KEY_DRIVE_LAST_MODIFIED, System.currentTimeMillis());
                        int sizeBytes = json.getBytes(StandardCharsets.UTF_8).length;
                        return String.format(
                            Locale.US,
                            "{\"modifiedTime\":%d,\"sizeBytes\":%d}",
                            modTime,
                            sizeBytes
                        );
                    } catch (Exception e) {
                        return "";
                    }
                }

                @JavascriptInterface
                public String getCachedBackupContent() {
                    String json = readInternalBackupCopy();
                    return json != null ? json : "";
                }

                @JavascriptInterface
                public void openGoogleDriveRestorePicker() {
                    runOnUiThread(() -> launchGoogleDriveOpenDocument());
                }

                @JavascriptInterface
                public void deleteCachedBackup() {
                    try {
                        SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                        prefs.edit()
                            .remove(KEY_DRIVE_LAST_JSON)
                            .remove(KEY_DRIVE_LAST_MODIFIED)
                            .apply();
                        File f = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
                        if (f.exists()) {
                            //noinspection ResultOfMethodCallIgnored
                            f.delete();
                        }
                    } catch (Exception ignored) {
                    }
                }
            }, "BusyBeesNative");
        }

        // Prompt for runtime SMS + Notification permission if auto-detect is enabled
        SharedPreferences smsPrefs = getSharedPreferences(SmsTransactionProcessor.PREFS_NAME, Context.MODE_PRIVATE);
        if (smsPrefs.getBoolean(SmsTransactionProcessor.KEY_AUTO_DETECT_ENABLED, true)) {
            if (!isDirectSmsPermissionGranted()) {
                promptForSmsAndNotificationPermissions();
            }
        }

        // Intercept Android hardware / gesture Back button and forward to WebView
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (bridge != null && bridge.getWebView() != null) {
                    bridge.getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('bb-back-button'));",
                        null
                    );
                }
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureNotificationActionIntent(intent);
    }

    private void captureNotificationActionIntent(Intent intent) {
        if (intent == null) return;
        try {
            int notifId = intent.getIntExtra("notif_id", -1);
            if (notifId != -1) {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(notifId);
                }
            }

            String actionType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE);
            String itemId = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
            String txType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_TYPE);
            double txAmount = intent.getDoubleExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, 0.0);

            if ((actionType != null && !actionType.isEmpty()) && itemId != null) {
                intent.removeExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE);
                String safeAction = actionType.replace("\"", "");
                String safeId = itemId.replace("\"", "");
                String safeTxType = "income".equals(txType) ? "income" : "expense";

                String actionJson = String.format(
                    Locale.US,
                    "{\"action\":\"%s\",\"id\":\"%s\",\"type\":\"%s\",\"amount\":%.2f}",
                    safeAction,
                    safeId,
                    safeTxType,
                    txAmount
                );

                SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_PENDING_NOTIF_ACTION, actionJson).apply();

                if (bridge != null && bridge.getWebView() != null) {
                    String js = "window.dispatchEvent(new CustomEvent('bb-sms-notif-action', { detail: " + actionJson + " }));";
                    bridge.getWebView().evaluateJavascript(js, null);
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void promptForSmsAndNotificationPermissions() {
        try {
            List<String> needed = new ArrayList<>();
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS)
                != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.RECEIVE_SMS);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.POST_NOTIFICATIONS);
                }
            }
            if (!needed.isEmpty()) {
                ActivityCompat.requestPermissions(
                    this,
                    needed.toArray(new String[0]),
                    REQ_CODE_SMS_PERMISSIONS
                );
            } else {
                dispatchSmsPermissionEvent(true);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onRequestPermissionsResult(
        int requestCode,
        @NonNull String[] permissions,
        @NonNull int[] grantResults
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQ_CODE_SMS_PERMISSIONS) {
            boolean smsGranted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.RECEIVE_SMS
            ) == PackageManager.PERMISSION_GRANTED;
            dispatchSmsPermissionEvent(smsGranted || isNotificationListenerEnabled());
        }
    }

    private void dispatchSmsPermissionEvent(boolean granted) {
        if (bridge == null || bridge.getWebView() == null) return;
        String js = "window.dispatchEvent(new CustomEvent('bb-sms-permission-changed', { detail: { granted: "
            + (granted ? "true" : "false") + " } }));";
        bridge.getWebView().evaluateJavascript(js, null);
    }

    private void launchNativeGoogleAccountPicker() {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                intent = AccountManager.newChooseAccountIntent(
                    null,
                    null,
                    new String[]{"com.google"},
                    null,
                    null,
                    null,
                    null
                );
            } else {
                //noinspection deprecation
                intent = AccountManager.newChooseAccountIntent(
                    null,
                    null,
                    new String[]{"com.google"},
                    false,
                    null,
                    null,
                    null,
                    null
                );
            }
            startActivityForResult(intent, REQ_CODE_PICK_GOOGLE_ACCOUNT);
        } catch (Exception e) {
            dispatchDriveAuthResult(false, "", "Unable to open Google account selector on this device.");
        }
    }

    private void launchGoogleDriveCreateDocument(String jsonContent, String fileName) {
        this.pendingBackupJsonToWrite = jsonContent;
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            // Prefer Google Drive package if installed on device
            if (isPackageInstalled("com.google.android.apps.docs")) {
                intent.setPackage("com.google.android.apps.docs");
            }
            startActivityForResult(intent, REQ_CODE_DRIVE_CREATE_DOC);
        } catch (Exception e) {
            // Fallback without package restriction
            try {
                Intent fallback = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                fallback.addCategory(Intent.CATEGORY_OPENABLE);
                fallback.setType("application/json");
                fallback.putExtra(Intent.EXTRA_TITLE, fileName);
                startActivityForResult(fallback, REQ_CODE_DRIVE_CREATE_DOC);
            } catch (Exception ex) {
                // Internal Auto-Backup copy was already saved above, so report success
                long now = System.currentTimeMillis();
                dispatchDriveEvent(
                    "bb-native-drive-backup-result",
                    true,
                    "",
                    now,
                    jsonContent.getBytes(StandardCharsets.UTF_8).length
                );
            }
        }
    }

    private void launchGoogleDriveOpenDocument() {
        try {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            String[] mimeTypes = new String[]{"application/json", "text/plain", "application/octet-stream"};
            intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

            if (isPackageInstalled("com.google.android.apps.docs")) {
                intent.setPackage("com.google.android.apps.docs");
            }
            startActivityForResult(intent, REQ_CODE_DRIVE_OPEN_DOC);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                fallback.addCategory(Intent.CATEGORY_OPENABLE);
                fallback.setType("*/*");
                startActivityForResult(fallback, REQ_CODE_DRIVE_OPEN_DOC);
            } catch (Exception ex) {
                dispatchDriveRestoreResult(false, "", "Could not open Google Drive file picker.");
            }
        }
    }

    private boolean isPackageInstalled(String packageName) {
        try {
            getPackageManager().getPackageInfo(packageName, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == REQ_CODE_PICK_GOOGLE_ACCOUNT) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                String accountName = data.getStringExtra(AccountManager.KEY_ACCOUNT_NAME);
                if (accountName != null && !accountName.isEmpty()) {
                    SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit().putString(KEY_DRIVE_EMAIL, accountName).apply();
                    dispatchDriveAuthResult(true, accountName, "");
                    return;
                }
            }
            dispatchDriveAuthResult(false, "", "popup-closed-by-user");
            return;
        }

        if (requestCode == REQ_CODE_DRIVE_CREATE_DOC) {
            String content = pendingBackupJsonToWrite;
            pendingBackupJsonToWrite = null;
            long now = System.currentTimeMillis();

            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null && content != null) {
                Uri uri = data.getData();
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os != null) {
                        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                        os.write(bytes);
                        os.flush();
                        saveInternalBackupCopy(content, now);
                        dispatchDriveEvent("bb-native-drive-backup-result", true, "", now, bytes.length);
                        return;
                    }
                } catch (Exception e) {
                    dispatchDriveEvent("bb-native-drive-backup-result", false, "Failed to write backup file to Google Drive.", now, 0);
                    return;
                }
            }
            // Even if user closed the optional external file sheet, internal backup copy is saved
            if (content != null) {
                byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
                dispatchDriveEvent("bb-native-drive-backup-result", true, "", now, bytes.length);
            } else {
                dispatchDriveEvent("bb-native-drive-backup-result", false, "popup-closed-by-user", now, 0);
            }
            return;
        }

        if (requestCode == REQ_CODE_DRIVE_OPEN_DOC) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                try (InputStream is = getContentResolver().openInputStream(uri)) {
                    if (is != null) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line).append("\n");
                        }
                        String json = sb.toString().trim();
                        saveInternalBackupCopy(json, System.currentTimeMillis());
                        dispatchDriveRestoreResult(true, json, "");
                        return;
                    }
                } catch (Exception e) {
                    dispatchDriveRestoreResult(false, "", "Failed to read backup file from Google Drive.");
                    return;
                }
            }
            dispatchDriveRestoreResult(false, "", "popup-closed-by-user");
        }
    }

    private void saveInternalBackupCopy(String jsonContent, long timestampMs) {
        try {
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putString(KEY_DRIVE_LAST_JSON, jsonContent)
                .putLong(KEY_DRIVE_LAST_MODIFIED, timestampMs)
                .apply();

            File file = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(jsonContent.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }
        } catch (Exception ignored) {
        }
    }

    private String readInternalBackupCopy() {
        try {
            File file = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
            if (file.exists() && file.length() > 0) {
                try (FileInputStream fis = new FileInputStream(file)) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    String res = sb.toString().trim();
                    if (!res.isEmpty()) return res;
                }
            }
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            return prefs.getString(KEY_DRIVE_LAST_JSON, "");
        } catch (Exception e) {
            return "";
        }
    }

    private void dispatchDriveAuthResult(boolean success, String email, String error) {
        if (bridge == null || bridge.getWebView() == null) return;
        String safeEmail = email == null ? "" : email.replace("'", "\\'");
        String safeErr = error == null ? "" : error.replace("'", "\\'").replace("\n", " ");
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('bb-native-drive-auth', { detail: { success: %s, email: '%s', error: '%s' } }));",
            success ? "true" : "false",
            safeEmail,
            safeErr
        );
        bridge.getWebView().evaluateJavascript(js, null);
    }

    private void dispatchDriveEvent(String eventName, boolean success, String error, long modifiedTime, int sizeBytes) {
        if (bridge == null || bridge.getWebView() == null) return;
        String safeErr = error == null ? "" : error.replace("'", "\\'").replace("\n", " ");
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('%s', { detail: { success: %s, error: '%s', modifiedTime: %d, sizeBytes: %d } }));",
            eventName,
            success ? "true" : "false",
            safeErr,
            modifiedTime,
            sizeBytes
        );
        bridge.getWebView().evaluateJavascript(js, null);
    }

    private void dispatchDriveRestoreResult(boolean success, String jsonContent, String error) {
        if (bridge == null || bridge.getWebView() == null) return;
        String safeErr = error == null ? "" : error.replace("'", "\\'").replace("\n", " ");
        // Since jsonContent is already saved in internal backup copy, JS can read it via BusyBeesNative.getCachedBackupContent()
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('bb-native-drive-restore', { detail: { success: %s, error: '%s' } }));",
            success ? "true" : "false",
            safeErr
        );
        bridge.getWebView().evaluateJavascript(js, null);
    }

    @Override
    public void onStart() {
        super.onStart();
        SmsFloatingBubbleService.hideBubble(this);
        IntentFilter filter = new IntentFilter(SmsTransactionProcessor.ACTION_SMS_DETECTED);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsDetectedReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(smsDetectedReceiver, filter);
        }
    }

    @Override
    public void onStop() {
        try {
            unregisterReceiver(smsDetectedReceiver);
        } catch (Exception ignored) {
        }
        super.onStop();
    }

    private boolean isNotificationListenerEnabled() {
        String pkgName = getPackageName();
        final String flat = Settings.Secure.getString(
            getContentResolver(),
            "enabled_notification_listeners"
        );
        if (!TextUtils.isEmpty(flat)) {
            final String[] names = flat.split(":");
            for (String name : names) {
                final ComponentName cn = ComponentName.unflattenFromString(name);
                if (cn != null && TextUtils.equals(pkgName, cn.getPackageName())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void launchBiometricPrompt() {
        BiometricManager biometricManager = BiometricManager.from(this);
        int canAuth = biometricManager.canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK
        );
        if (canAuth != BiometricManager.BIOMETRIC_SUCCESS) {
            String msg = (canAuth == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED)
                ? "No fingerprint or face unlock enrolled on this phone."
                : "Biometric sensor is not available on this device.";
            dispatchBiometricResult(false, "UNAVAILABLE", msg);
            return;
        }

        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt biometricPrompt = new BiometricPrompt(
            this,
            executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                    super.onAuthenticationError(errorCode, errString);
                    boolean cancelled =
                        errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON ||
                        errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                        errorCode == BiometricPrompt.ERROR_CANCELED;
                    dispatchBiometricResult(
                        false,
                        cancelled ? "CANCELLED" : "ERROR",
                        errString != null ? errString.toString() : "Biometric authentication cancelled."
                    );
                }

                @Override
                public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    dispatchBiometricResult(true, "SUCCESS", "");
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                }
            }
        );

        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
            .setTitle("Unlock Busy Bees")
            .setSubtitle("Verify your fingerprint or face to unlock")
            .setNegativeButtonText("Use PIN")
            .setAllowedAuthenticators(
                BiometricManager.Authenticators.BIOMETRIC_STRONG |
                BiometricManager.Authenticators.BIOMETRIC_WEAK
            )
            .build();

        biometricPrompt.authenticate(promptInfo);
    }

    private void dispatchBiometricResult(boolean success, String code, String message) {
        if (bridge == null || bridge.getWebView() == null) return;
        String safeMsg = message == null ? "" : message.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ");
        String js = "window.dispatchEvent(new CustomEvent('bb-biometric-result', { detail: { success: "
            + (success ? "true" : "false")
            + ", code: '" + code + "'"
            + ", error: '" + safeMsg + "' } }));";
        bridge.getWebView().evaluateJavascript(js, null);
    }

    private void updateSystemBarAppearance(boolean isDark) {
        Window window = getWindow();
        if (window == null) return;
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }
}
