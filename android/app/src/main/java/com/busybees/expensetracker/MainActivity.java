package com.busybees.expensetracker;

import android.Manifest;
import android.accounts.Account;
import android.accounts.AccountManager;
import android.accounts.AccountManagerFuture;
import android.app.Activity;
import android.app.NotificationManager;
import android.app.backup.BackupManager;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.UriPermission;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
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
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executor;
import java.util.concurrent.TimeUnit;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {

    private static final int REQ_CODE_SMS_PERMISSIONS = 4101;
    private static final int REQ_CODE_PICK_GOOGLE_ACCOUNT = 4102;
    private static final int REQ_CODE_DRIVE_CREATE_DOC = 4103;
    private static final int REQ_CODE_DRIVE_OPEN_DOC = 4104;
    private static final int REQ_CODE_EXPORT_CREATE_DOC = 4105;

    private static final String DRIVE_PREFS_NAME = "bb_native_drive_prefs";
    private static final String KEY_DRIVE_EMAIL = "connected_google_email";
    private static final String KEY_DRIVE_LAST_JSON = "cached_backup_json";
    private static final String KEY_DRIVE_LAST_MODIFIED = "cached_backup_modified_ms";
    private static final String KEY_DRIVE_PERSISTED_URI = "persisted_drive_file_uri";
    private static final String KEY_PENDING_NOTIF_ACTION = "pending_notif_action_json";

    private String pendingBackupJsonToWrite = null;
    private byte[] pendingExportBytesToWrite = null;
    private String pendingExportFormat = null;
    private String pendingExportFileName = null;
    private String pendingExportMimeType = null;
    private Uri lastExportedFileUri = null;
    private String lastExportedFileMime = null;
    private long permissionRequestStartMs = 0L;
    private boolean userInitiatedPermissionRequest = false;

    private final BroadcastReceiver smsDetectedReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || bridge == null || bridge.getWebView() == null) return;

            String autoSavedId = intent.getStringExtra("autoSavedId");
            if (autoSavedId != null) {
                String safeAutoId = autoSavedId.replace("'", "");
                String txType = intent.getStringExtra("type");
                String safeType = "income".equals(txType) ? "income" : "expense";
                double amount = intent.getDoubleExtra("amount", 0.0);
                String cat = intent.getStringExtra("category");
                String safeCat = (cat != null && !cat.isEmpty())
                    ? cat.replace("'", "")
                    : ("income".equals(safeType) ? "Salary" : "Shopping");
                String js = String.format(
                    Locale.US,
                    "window.dispatchEvent(new CustomEvent('bb-sms-detected', { detail: { autoSavedId: '%s', dismissedId: '%s', type: '%s', amount: %.2f, category: '%s' } }));",
                    safeAutoId,
                    safeAutoId,
                    safeType,
                    amount,
                    safeCat
                );
                bridge.getWebView().evaluateJavascript(js, null);
                return;
            }

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
                    return hasDirectSmsPermission();
                }

                @JavascriptInterface
                public boolean isDirectSmsPermissionGranted() {
                    return hasDirectSmsPermission();
                }

                @JavascriptInterface
                public boolean isNotificationListenerAccessGranted() {
                    return hasDirectSmsPermission();
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
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Exception ignored) {
                            }
                        }
                    });
                }

                @JavascriptInterface
                public void requestSmsRuntimePermission() {
                    runOnUiThread(() -> {
                        userInitiatedPermissionRequest = false;
                        promptForSmsAndNotificationPermissions();
                    });
                }

                @JavascriptInterface
                public void openSmsNotificationAccessSettings() {
                    runOnUiThread(() -> {
                        if (!hasDirectSmsPermission()) {
                            userInitiatedPermissionRequest = true;
                            promptForSmsAndNotificationPermissions();
                            return;
                        }
                        // If SMS is already granted, ensure POST_NOTIFICATIONS is also granted on Android 13+
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                            ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED) {
                            userInitiatedPermissionRequest = true;
                            promptForSmsAndNotificationPermissions();
                        }
                    });
                }

                @JavascriptInterface
                public void openNotificationListenerSettingsDirect() {
                    runOnUiThread(() -> openAppDetailsSettings());
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
                public String consumeAutoSavedSmsTransactions() {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsTransactionProcessor.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    String autoSaved = prefs.getString(
                        SmsTransactionProcessor.KEY_AUTO_SAVED_QUEUE,
                        "[]"
                    );
                    prefs.edit().putString(SmsTransactionProcessor.KEY_AUTO_SAVED_QUEUE, "[]").apply();
                    return autoSaved != null ? autoSaved : "[]";
                }

                @JavascriptInterface
                public void resolveSmsTransactionInNative(String itemId) {
                    if (itemId == null || itemId.isEmpty()) return;
                    SmsTransactionProcessor.resolveAndCancelNotification(
                        MainActivity.this.getApplicationContext(),
                        itemId
                    );
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

                @JavascriptInterface
                public boolean isSmsPullDownNotificationEnabled() {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsTransactionProcessor.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    return prefs.getBoolean(SmsTransactionProcessor.KEY_PULLDOWN_NOTIF_ENABLED, false);
                }

                @JavascriptInterface
                public void setSmsPullDownNotificationEnabled(boolean enabled) {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsTransactionProcessor.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    prefs.edit().putBoolean(
                        SmsTransactionProcessor.KEY_PULLDOWN_NOTIF_ENABLED,
                        enabled
                    ).apply();
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
                    final long now = System.currentTimeMillis();
                    final int sizeBytes = jsonContent.getBytes(StandardCharsets.UTF_8).length;

                    // Always execute silently in the background: overwrite previous backup and trigger Android Cloud Auto-Backup
                    new Thread(() -> {
                        saveInternalBackupCopy(jsonContent, now);
                        runOnUiThread(() ->
                            dispatchDriveEvent("bb-native-drive-backup-result", true, "", now, sizeBytes)
                        );
                    }).start();
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
                public void scanCloudBackupInBackground() {
                    new Thread(() -> {
                        String json = readInternalBackupCopyWithCloudFallback();
                        if (json != null && !json.trim().isEmpty()) {
                            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                            long modTime = prefs.getLong(KEY_DRIVE_LAST_MODIFIED, System.currentTimeMillis());
                            int sizeBytes = json.getBytes(StandardCharsets.UTF_8).length;
                            runOnUiThread(() ->
                                dispatchDriveEvent("bb-native-drive-scan-result", true, "", modTime, sizeBytes)
                            );
                        } else {
                            runOnUiThread(() ->
                                dispatchDriveEvent("bb-native-drive-scan-result", false, "NOT_FOUND", 0L, 0)
                            );
                        }
                    }).start();
                }

                @JavascriptInterface
                public void openGoogleDriveRestorePicker() {
                    // Always scan and restore silently in the background without opening any Google Drive window
                    new Thread(() -> {
                        String json = readInternalBackupCopyWithCloudFallback();
                        if (json != null && !json.trim().isEmpty()) {
                            runOnUiThread(() -> dispatchDriveRestoreResult(true, json, ""));
                        } else {
                            runOnUiThread(() -> dispatchDriveRestoreResult(false, "", "No backup file found for this account."));
                        }
                    }).start();
                }

                @JavascriptInterface
                public void deleteCachedBackup() {
                    new Thread(() -> {
                        try {
                            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
                            String email = prefs.getString(KEY_DRIVE_EMAIL, "");
                            prefs.edit()
                                .remove(KEY_DRIVE_LAST_JSON)
                                .remove(KEY_DRIVE_LAST_MODIFIED)
                                .remove(KEY_DRIVE_PERSISTED_URI)
                                .apply();
                            File f = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
                            if (f.exists()) {
                                //noinspection ResultOfMethodCallIgnored
                                f.delete();
                            }
                            File extDir = getExternalFilesDir(null);
                            if (extDir != null) {
                                File extFile = new File(extDir, "busy_bees_expense_tracker_backup.json");
                                if (extFile.exists()) {
                                    //noinspection ResultOfMethodCallIgnored
                                    extFile.delete();
                                }
                            }
                            deleteSharedSurvivalBackupCopies();
                            deleteMediaStoreBackupCopy();
                            if (email != null && !email.isEmpty()) {
                                deleteFromGoogleDriveRestApi(email);
                            }
                        } catch (Exception ignored) {
                        }
                    }).start();
                }

                // =========================================================================
                // NATIVE ANDROID PDF & CSV EXPORT BRIDGE
                // =========================================================================

                @JavascriptInterface
                public void exportPdfDocument(String reportJson, String fileName) {
                    runOnUiThread(() -> {
                        try {
                            byte[] pdfBytes = generatePdfBytesFromReportJson(reportJson);
                            String safeName = (fileName != null && !fileName.isEmpty())
                                ? fileName
                                : "busy_bees_report.pdf";
                            launchExportCreateDocument(pdfBytes, safeName, "application/pdf", "pdf");
                        } catch (Exception e) {
                            dispatchExportResult(false, "pdf", "", "Failed to generate PDF report.");
                        }
                    });
                }

                @JavascriptInterface
                public void exportCsvDocument(String csvContent, String fileName) {
                    runOnUiThread(() -> {
                        try {
                            String withBom = "\uFEFF" + (csvContent != null ? csvContent : "");
                            byte[] csvBytes = withBom.getBytes(StandardCharsets.UTF_8);
                            String safeName = (fileName != null && !fileName.isEmpty())
                                ? fileName
                                : "busy_bees_report.csv";
                            launchExportCreateDocument(csvBytes, safeName, "text/csv", "csv");
                        } catch (Exception e) {
                            dispatchExportResult(false, "csv", "", "Failed to generate CSV file.");
                        }
                    });
                }

                @JavascriptInterface
                public void openLastExportedFile() {
                    runOnUiThread(() -> {
                        if (lastExportedFileUri == null) return;
                        try {
                            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                            viewIntent.setDataAndType(
                                lastExportedFileUri,
                                lastExportedFileMime != null ? lastExportedFileMime : "application/pdf"
                            );
                            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(Intent.createChooser(viewIntent, "Open exported file"));
                        } catch (Exception e) {
                            Toast.makeText(
                                MainActivity.this,
                                "No app found to open this file type. File is saved in your selected folder.",
                                Toast.LENGTH_LONG
                            ).show();
                        }
                    });
                }
            }, "BusyBeesNative");
        }

        // Prompt for runtime SMS + Notification permission if auto-detect is enabled
        SharedPreferences smsPrefs = getSharedPreferences(SmsTransactionProcessor.PREFS_NAME, Context.MODE_PRIVATE);
        if (smsPrefs.getBoolean(SmsTransactionProcessor.KEY_AUTO_DETECT_ENABLED, true)) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
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
            String txCategory = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_CATEGORY);

            if ((actionType != null && !actionType.isEmpty()) && itemId != null) {
                intent.removeExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE);
                SmsTransactionProcessor.resolveAndCancelNotification(getApplicationContext(), itemId);
                String safeAction = actionType.replace("\"", "");
                String safeId = itemId.replace("\"", "");
                String safeTxType = "income".equals(txType) ? "income" : "expense";
                String safeCategory = (txCategory != null && !txCategory.trim().isEmpty())
                    ? txCategory.trim().replace("\"", "")
                    : ("income".equals(safeTxType) ? "Salary" : "Shopping");

                String actionJson = String.format(
                    Locale.US,
                    "{\"action\":\"%s\",\"id\":\"%s\",\"type\":\"%s\",\"amount\":%.2f,\"category\":\"%s\"}",
                    safeAction,
                    safeId,
                    safeTxType,
                    txAmount,
                    safeCategory
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

    private boolean hasDirectSmsPermission() {
        return ContextCompat.checkSelfPermission(
            this,
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private void openAppDetailsSettings() {
        try {
            Intent intent = new Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", getPackageName(), null)
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception ignored) {
        }
    }

    private void promptForSmsAndNotificationPermissions() {
        try {
            List<String> needed = new ArrayList<>();
            if (!hasDirectSmsPermission()) {
                needed.add(Manifest.permission.RECEIVE_SMS);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                    needed.add(Manifest.permission.POST_NOTIFICATIONS);
                }
            }
            if (!needed.isEmpty()) {
                permissionRequestStartMs = System.currentTimeMillis();
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
            boolean smsGranted = hasDirectSmsPermission();
            long elapsed = System.currentTimeMillis() - permissionRequestStartMs;
            if (!smsGranted && userInitiatedPermissionRequest && elapsed < 350L) {
                // System suppressed the runtime popup (e.g. Don't ask again); open App Permissions page directly
                userInitiatedPermissionRequest = false;
                openAppDetailsSettings();
            }
            userInitiatedPermissionRequest = false;
            dispatchSmsPermissionEvent(smsGranted);
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
            intent.addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION |
                Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
            );

            if (isPackageInstalled("com.google.android.apps.docs")) {
                intent.setPackage("com.google.android.apps.docs");
            }
            startActivityForResult(intent, REQ_CODE_DRIVE_OPEN_DOC);
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                fallback.addCategory(Intent.CATEGORY_OPENABLE);
                fallback.setType("*/*");
                fallback.addFlags(
                    Intent.FLAG_GRANT_READ_URI_PERMISSION |
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION |
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
                );
                startActivityForResult(fallback, REQ_CODE_DRIVE_OPEN_DOC);
            } catch (Exception ex) {
                dispatchDriveRestoreResult(false, "", "No backup file found for this account.");
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
                persistDriveUriPermission(uri);
                try (OutputStream os = getContentResolver().openOutputStream(uri, "wt")) {
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
                persistDriveUriPermission(uri);
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
            return;
        }

        if (requestCode == REQ_CODE_EXPORT_CREATE_DOC) {
            byte[] bytes = pendingExportBytesToWrite;
            String fmt = pendingExportFormat != null ? pendingExportFormat : "pdf";
            String fName = pendingExportFileName != null ? pendingExportFileName : "";
            String mime = pendingExportMimeType != null ? pendingExportMimeType : "application/pdf";

            pendingExportBytesToWrite = null;
            pendingExportFormat = null;
            pendingExportFileName = null;
            pendingExportMimeType = null;

            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null && bytes != null) {
                Uri uri = data.getData();
                try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                        lastExportedFileUri = uri;
                        lastExportedFileMime = mime;
                        Toast.makeText(
                            this,
                            ("pdf".equals(fmt) ? "PDF saved: " : "CSV saved: ") + fName,
                            Toast.LENGTH_SHORT
                        ).show();
                        dispatchExportResult(true, fmt, fName, "");
                        return;
                    }
                } catch (Exception e) {
                    dispatchExportResult(false, fmt, fName, "Could not write file to selected location.");
                    return;
                }
            }
            dispatchExportResult(false, fmt, fName, "cancelled");
        }
    }

    private void launchExportCreateDocument(byte[] bytes, String fileName, String mimeType, String format) {
        this.pendingExportBytesToWrite = bytes;
        this.pendingExportFileName = fileName;
        this.pendingExportMimeType = mimeType;
        this.pendingExportFormat = format;
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_TITLE, fileName);
            startActivityForResult(intent, REQ_CODE_EXPORT_CREATE_DOC);
        } catch (Exception e) {
            dispatchExportResult(false, format, fileName, "Could not open file saver dialog on this device.");
        }
    }

    private void dispatchExportResult(boolean success, String format, String fileName, String error) {
        if (bridge == null || bridge.getWebView() == null) return;
        String safeFmt = format == null ? "" : format.replace("'", "\\'");
        String safeName = fileName == null ? "" : fileName.replace("'", "\\'");
        String safeErr = error == null ? "" : error.replace("'", "\\'").replace("\n", " ");
        String js = String.format(
            Locale.US,
            "window.dispatchEvent(new CustomEvent('bb-export-result', { detail: { success: %s, format: '%s', fileName: '%s', error: '%s' } }));",
            success ? "true" : "false",
            safeFmt,
            safeName,
            safeErr
        );
        bridge.getWebView().evaluateJavascript(js, null);
    }

    private byte[] generatePdfBytesFromReportJson(String reportJson) throws Exception {
        JSONObject obj = new JSONObject(reportJson != null ? reportJson : "{}");
        String rangeLabel = obj.optString("rangeLabel", "Report");
        String exportedDate = obj.optString("exportedDate", "");
        String currency = obj.optString("currency", "INR");
        String totalIncome = obj.optString("totalIncome", "0.00");
        String totalExpense = obj.optString("totalExpense", "0.00");
        String netBalance = obj.optString("netBalance", "0.00");
        boolean isNetPositive = obj.optBoolean("isNetPositive", true);
        JSONArray rows = obj.optJSONArray("rows");
        if (rows == null) rows = new JSONArray();

        final int pageWidth = 595;
        final int pageHeight = 842;
        final float marginLeft = 36f;
        final float marginRight = 559f;
        final float contentWidth = marginRight - marginLeft;

        PdfDocument doc = new PdfDocument();
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        Paint textPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

        int pageNumber = 1;
        PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create();
        PdfDocument.Page page = doc.startPage(pageInfo);
        Canvas canvas = page.getCanvas();

        // Background
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.WHITE);
        canvas.drawRect(0, 0, pageWidth, pageHeight, paint);

        // Header Title & Subtitle
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(18f);
        textPaint.setColor(Color.parseColor("#2357A4"));
        canvas.drawText("Busy Bees Expense Tracker", marginLeft, 50f, textPaint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        textPaint.setTextSize(10f);
        textPaint.setColor(Color.parseColor("#64748B"));
        canvas.drawText("Exported: " + exportedDate + "  |  Period: " + rangeLabel, marginLeft, 67f, textPaint);

        // Rupee-Bee (₹ + Golden Bee) Circular Medallion on top right
        float logoCx = marginRight - 19f;
        float logoCy = 52f;
        float logoR = 18f;

        // Royal Blue Medallion Fill
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#2357A4"));
        canvas.drawCircle(logoCx, logoCy, logoR, paint);

        // Honey Gold Metallic Rim
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(2f);
        paint.setColor(Color.parseColor("#F59E0B"));
        canvas.drawCircle(logoCx, logoCy, logoR, paint);

        // Crisp White Indian Rupee (₹) Symbol inside Medallion
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setStrokeWidth(2.3f);
        paint.setColor(Color.WHITE);
        // Top & Middle horizontal bars of ₹
        canvas.drawLine(logoCx - 9f, logoCy - 8f, logoCx + 4f, logoCy - 8f, paint);
        canvas.drawLine(logoCx - 9f, logoCy - 3f, logoCx + 3f, logoCy - 3f, paint);
        // Curved right loop of ₹ (open on the left) & diagonal leg
        RectF rupeeLoop = new RectF(logoCx - 5.5f, logoCy - 8f, logoCx + 3.5f, logoCy + 2f);
        canvas.drawArc(rupeeLoop, -90f, 180f, false, paint);
        canvas.drawLine(logoCx - 5.5f, logoCy + 2f, logoCx - 1f, logoCy + 2f, paint);
        // Diagonal leg of ₹
        canvas.drawLine(logoCx - 5.5f, logoCy + 2f, logoCx + 4f, logoCy + 10.5f, paint);

        // Golden Swooping Flight Trail through the ₹ loop
        paint.setStrokeWidth(1.6f);
        paint.setColor(Color.parseColor("#FDE047"));
        RectF swoopArc = new RectF(logoCx - 11f, logoCy - 6f, logoCx + 7f, logoCy + 8f);
        canvas.drawArc(swoopArc, 15f, 115f, false, paint);

        // Golden Honeybee at top-right of the ₹ loop
        RectF beeBody = new RectF(logoCx + 2.5f, logoCy - 8.5f, logoCx + 11.5f, logoCy - 2.5f);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#FBBF24"));
        canvas.drawOval(beeBody, paint);

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(1f);
        paint.setColor(Color.parseColor("#0F172A"));
        canvas.drawOval(beeBody, paint);
        // Bee Stripes
        canvas.drawLine(logoCx + 6f, logoCy - 8.2f, logoCx + 6f, logoCy - 2.8f, paint);
        canvas.drawLine(logoCx + 8.5f, logoCy - 8.0f, logoCx + 8.5f, logoCy - 3.0f, paint);

        // Translucent White Bee Wing
        RectF beeWing = new RectF(logoCx + 4f, logoCy - 12.2f, logoCx + 8.8f, logoCy - 7.5f);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.WHITE);
        canvas.drawOval(beeWing, paint);

        // Header Bottom Border Line
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#2357A4"));
        canvas.drawRect(marginLeft, 80f, marginRight, 82f, paint);

        // 3 Summary Cards
        float cardGap = 11f;
        float cardWidth = (contentWidth - (cardGap * 2f)) / 3f;
        float cardTop = 94f;
        float cardBottom = 148f;

        String[] cardTitles = new String[]{"TOTAL INCOME", "TOTAL EXPENSE", "NET BALANCE"};
        String[] cardValues = new String[]{
            "+" + currency + " " + totalIncome,
            "-" + currency + " " + totalExpense,
            (isNetPositive ? "" : "-") + currency + " " + netBalance
        };
        int[] cardColors = new int[]{
            Color.parseColor("#16A34A"),
            Color.parseColor("#DC2626"),
            isNetPositive ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626")
        };

        for (int i = 0; i < 3; i++) {
            float cLeft = marginLeft + i * (cardWidth + cardGap);
            float cRight = cLeft + cardWidth;
            RectF rect = new RectF(cLeft, cardTop, cRight, cardBottom);

            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.parseColor("#F8FAFC"));
            canvas.drawRoundRect(rect, 6f, 6f, paint);

            paint.setStyle(Paint.Style.STROKE);
            paint.setStrokeWidth(1f);
            paint.setColor(Color.parseColor("#E2E8F0"));
            canvas.drawRoundRect(rect, 6f, 6f, paint);

            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            textPaint.setTextSize(8f);
            textPaint.setColor(Color.parseColor("#64748B"));
            canvas.drawText(cardTitles[i], cLeft + 10f, cardTop + 18f, textPaint);

            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            textPaint.setTextSize(12f);
            textPaint.setColor(cardColors[i]);
            canvas.drawText(ellipsizeText(cardValues[i], textPaint, cardWidth - 20f), cLeft + 10f, cardTop + 39f, textPaint);
        }

        // Draw Table Header on Page 1
        float currentY = drawPdfTableHeader(canvas, paint, textPaint, marginLeft, marginRight, 166f);

        if (rows.length() == 0) {
            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            textPaint.setTextSize(10f);
            textPaint.setColor(Color.parseColor("#64748B"));
            canvas.drawText("No transactions recorded in this period.", marginLeft + 8f, currentY + 22f, textPaint);
        } else {
            for (int i = 0; i < rows.length(); i++) {
                JSONObject row = rows.optJSONObject(i);
                if (row == null) continue;

                if (currentY + 24f > 784f) {
                    drawPdfPageFooter(canvas, textPaint, pageWidth, pageNumber);
                    doc.finishPage(page);
                    pageNumber++;
                    pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create();
                    page = doc.startPage(pageInfo);
                    canvas = page.getCanvas();

                    paint.setStyle(Paint.Style.FILL);
                    paint.setColor(Color.WHITE);
                    canvas.drawRect(0, 0, pageWidth, pageHeight, paint);

                    currentY = drawPdfTableHeader(canvas, paint, textPaint, marginLeft, marginRight, 40f);
                }

                String dateStr = row.optString("date", "");
                String typeStr = row.optString("type", "");
                boolean isIncome = row.optBoolean("isIncome", false);
                String categoryStr = row.optString("category", "");
                String noteStr = row.optString("note", "-");
                if (noteStr.isEmpty()) noteStr = "-";
                String amountStr = row.optString("amount", "");

                float textBaseline = currentY + 15f;

                // Date
                textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
                textPaint.setTextSize(9f);
                textPaint.setColor(Color.parseColor("#1E293B"));
                canvas.drawText(ellipsizeText(dateStr, textPaint, 68f), marginLeft + 6f, textBaseline, textPaint);

                // Type
                textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                textPaint.setColor(isIncome ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626"));
                canvas.drawText(ellipsizeText(typeStr, textPaint, 52f), marginLeft + 78f, textBaseline, textPaint);

                // Category
                textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
                textPaint.setColor(Color.parseColor("#1E293B"));
                canvas.drawText(ellipsizeText(categoryStr, textPaint, 128f), marginLeft + 136f, textBaseline, textPaint);

                // Note
                textPaint.setColor(Color.parseColor("#64748B"));
                canvas.drawText(ellipsizeText(noteStr, textPaint, 145f), marginLeft + 270f, textBaseline, textPaint);

                // Amount (Right-aligned)
                textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
                textPaint.setColor(isIncome ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626"));
                textPaint.setTextAlign(Paint.Align.RIGHT);
                canvas.drawText(ellipsizeText(amountStr, textPaint, 95f), marginRight - 6f, textBaseline, textPaint);
                textPaint.setTextAlign(Paint.Align.LEFT);

                // Row bottom divider
                paint.setStyle(Paint.Style.FILL);
                paint.setColor(Color.parseColor("#E2E8F0"));
                canvas.drawRect(marginLeft, currentY + 22f, marginRight, currentY + 22.8f, paint);

                currentY += 23f;
            }
        }

        drawPdfPageFooter(canvas, textPaint, pageWidth, pageNumber);
        doc.finishPage(page);

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        doc.writeTo(baos);
        doc.close();
        return baos.toByteArray();
    }

    private float drawPdfTableHeader(Canvas canvas, Paint paint, Paint textPaint, float left, float right, float topY) {
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(Color.parseColor("#F1F5F9"));
        canvas.drawRect(left, topY, right, topY + 22f, paint);

        paint.setColor(Color.parseColor("#CBD5E1"));
        canvas.drawRect(left, topY + 21f, right, topY + 22.2f, paint);

        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        textPaint.setTextSize(9f);
        textPaint.setColor(Color.parseColor("#334155"));
        float baseline = topY + 14.5f;

        canvas.drawText("Date", left + 6f, baseline, textPaint);
        canvas.drawText("Type", left + 78f, baseline, textPaint);
        canvas.drawText("Category", left + 136f, baseline, textPaint);
        canvas.drawText("Note", left + 270f, baseline, textPaint);

        textPaint.setTextAlign(Paint.Align.RIGHT);
        canvas.drawText("Amount", right - 6f, baseline, textPaint);
        textPaint.setTextAlign(Paint.Align.LEFT);

        return topY + 23f;
    }

    private void drawPdfPageFooter(Canvas canvas, Paint textPaint, int pageWidth, int pageNumber) {
        textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
        textPaint.setTextSize(8.5f);
        textPaint.setColor(Color.parseColor("#94A3B8"));
        textPaint.setTextAlign(Paint.Align.CENTER);
        canvas.drawText(
            "Busy Bees Expense Tracker  ·  100% Offline & Private on your device  ·  Page " + pageNumber,
            pageWidth / 2f,
            816f,
            textPaint
        );
        textPaint.setTextAlign(Paint.Align.LEFT);
    }

    private String ellipsizeText(String text, Paint paint, float maxWidth) {
        if (text == null) return "";
        if (paint.measureText(text) <= maxWidth) return text;
        String ellipsis = "...";
        int len = text.length();
        while (len > 1 && paint.measureText(text, 0, len) + paint.measureText(ellipsis) > maxWidth) {
            len--;
        }
        return text.substring(0, len) + ellipsis;
    }

    private void persistDriveUriPermission(Uri uri) {
        if (uri == null) return;
        try {
            int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
            getContentResolver().takePersistableUriPermission(uri, takeFlags);
        } catch (Exception ignored) {
            try {
                getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception ignored2) {
            }
        }
        try {
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString(KEY_DRIVE_PERSISTED_URI, uri.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private void saveSharedSurvivalBackupCopy(byte[] bytes) {
        String[] dirs = new String[]{
            Environment.DIRECTORY_DOWNLOADS,
            Environment.DIRECTORY_DOCUMENTS
        };
        for (String dirType : dirs) {
            try {
                File pubRoot = Environment.getExternalStoragePublicDirectory(dirType);
                if (pubRoot != null) {
                    File bbDir = new File(pubRoot, "BusyBeesBackup");
                    if (!bbDir.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        bbDir.mkdirs();
                    }
                    File target = new File(bbDir, "busy_bees_expense_tracker_backup.json");
                    try (FileOutputStream fos = new FileOutputStream(target, false)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        // Also write to Android/media/com.busybees.expensetracker
        try {
            File[] mediaDirs = getExternalMediaDirs();
            if (mediaDirs != null) {
                for (File mDir : mediaDirs) {
                    if (mDir != null) {
                        if (!mDir.exists()) {
                            //noinspection ResultOfMethodCallIgnored
                            mDir.mkdirs();
                        }
                        File target = new File(mDir, "busy_bees_expense_tracker_backup.json");
                        try (FileOutputStream fos = new FileOutputStream(target, false)) {
                            fos.write(bytes);
                            fos.flush();
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void deleteSharedSurvivalBackupCopies() {
        String[] dirs = new String[]{
            Environment.DIRECTORY_DOWNLOADS,
            Environment.DIRECTORY_DOCUMENTS
        };
        for (String dirType : dirs) {
            try {
                File pubRoot = Environment.getExternalStoragePublicDirectory(dirType);
                if (pubRoot != null) {
                    File target = new File(new File(pubRoot, "BusyBeesBackup"), "busy_bees_expense_tracker_backup.json");
                    if (target.exists()) {
                        //noinspection ResultOfMethodCallIgnored
                        target.delete();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        try {
            File[] mediaDirs = getExternalMediaDirs();
            if (mediaDirs != null) {
                for (File mDir : mediaDirs) {
                    if (mDir != null) {
                        File target = new File(mDir, "busy_bees_expense_tracker_backup.json");
                        if (target.exists()) {
                            //noinspection ResultOfMethodCallIgnored
                            target.delete();
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private String readFileToString(File file) {
        if (file == null || !file.exists() || file.length() <= 0) return "";
        try (FileInputStream fis = new FileInputStream(file)) {
            BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString().trim();
        } catch (Exception e) {
            return "";
        }
    }

    private String readSharedSurvivalBackupCopy() {
        // Check Android/media/com.busybees.expensetracker first
        try {
            File[] mediaDirs = getExternalMediaDirs();
            if (mediaDirs != null) {
                for (File mDir : mediaDirs) {
                    if (mDir != null) {
                        File target = new File(mDir, "busy_bees_expense_tracker_backup.json");
                        String content = readFileToString(target);
                        if (!content.isEmpty()) return content;
                    }
                }
            }
        } catch (Exception ignored) {
        }

        String[] dirs = new String[]{
            Environment.DIRECTORY_DOWNLOADS,
            Environment.DIRECTORY_DOCUMENTS
        };
        for (String dirType : dirs) {
            try {
                File pubRoot = Environment.getExternalStoragePublicDirectory(dirType);
                if (pubRoot == null) continue;

                // 1. Check BusyBeesBackup/busy_bees_expense_tracker_backup.json
                File bbFile = new File(new File(pubRoot, "BusyBeesBackup"), "busy_bees_expense_tracker_backup.json");
                String content = readFileToString(bbFile);
                if (!content.isEmpty()) return content;

                // 2. Check direct Download/busy_bees_expense_tracker_backup.json
                File directFile = new File(pubRoot, "busy_bees_expense_tracker_backup.json");
                content = readFileToString(directFile);
                if (!content.isEmpty()) return content;

                // 3. Scan directory for any matching busy_bees_expense_tracker_backup*.json
                File[] children = pubRoot.listFiles();
                if (children != null) {
                    File newestMatch = null;
                    for (File child : children) {
                        if (child != null && child.isFile()) {
                            String name = child.getName().toLowerCase(Locale.US);
                            if (name.startsWith("busy_bees_expense_tracker_backup") && name.endsWith(".json")) {
                                if (newestMatch == null || child.lastModified() > newestMatch.lastModified()) {
                                    newestMatch = child;
                                }
                            }
                        }
                    }
                    if (newestMatch != null) {
                        content = readFileToString(newestMatch);
                        if (!content.isEmpty()) return content;
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    private String tryGetGoogleDriveToken(String email) {
        if (email == null || email.trim().isEmpty()) return "";
        String[] scopesToTry = new String[]{
            "oauth2:https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata",
            "oauth2:https://www.googleapis.com/auth/drive"
        };
        Account account = new Account(email.trim(), "com.google");
        AccountManager am = AccountManager.get(this);
        for (String scope : scopesToTry) {
            try {
                AccountManagerFuture<Bundle> future = am.getAuthToken(
                    account,
                    scope,
                    null,
                    this,
                    null,
                    null
                );
                Bundle result = future.getResult(5, TimeUnit.SECONDS);
                if (result != null) {
                    String token = result.getString(AccountManager.KEY_AUTHTOKEN);
                    if (token != null && !token.trim().isEmpty()) {
                        return token.trim();
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    private void uploadToGoogleDriveRestApi(String email, String jsonContent) {
        String token = tryGetGoogleDriveToken(email);
        if (token.isEmpty()) return;
        try {
            byte[] bytes = jsonContent.getBytes(StandardCharsets.UTF_8);
            String existingFileId = findFileIdOnGoogleDriveRestApi(token);
            if (!existingFileId.isEmpty()) {
                URL updateUrl = new URL("https://www.googleapis.com/upload/drive/v3/files/" + existingFileId + "?uploadType=media");
                HttpURLConnection conn = (HttpURLConnection) updateUrl.openConnection();
                conn.setRequestMethod("PATCH");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Content-Type", "application/json; charset=UTF-8");
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(bytes);
                    os.flush();
                }
                conn.getResponseCode();
                conn.disconnect();
            } else {
                String boundary = "bb_drive_boundary_" + System.currentTimeMillis();
                String metadataJson = "{\"name\":\"busy_bees_expense_tracker_backup.json\",\"mimeType\":\"application/json\"}";
                String multipart = "--" + boundary + "\r\n"
                    + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    + metadataJson + "\r\n"
                    + "--" + boundary + "\r\n"
                    + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
                    + jsonContent + "\r\n"
                    + "--" + boundary + "--";
                URL createUrl = new URL("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart");
                HttpURLConnection conn = (HttpURLConnection) createUrl.openConnection();
                conn.setRequestMethod("POST");
                conn.setConnectTimeout(6000);
                conn.setReadTimeout(6000);
                conn.setDoOutput(true);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Content-Type", "multipart/related; boundary=" + boundary);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(multipart.getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
                conn.getResponseCode();
                conn.disconnect();
            }
        } catch (Exception ignored) {
        }
    }

    private String findFileIdOnGoogleDriveRestApi(String token) {
        String[] spaces = new String[]{"appDataFolder", "drive"};
        for (String space : spaces) {
            try {
                String q = URLEncoder.encode("name contains 'busy_bees_expense_tracker_backup' and trashed = false", "UTF-8");
                String urlStr = "https://www.googleapis.com/drive/v3/files?spaces=" + space
                    + "&q=" + q
                    + "&orderBy=modifiedTime%20desc&pageSize=5&fields=files(id,name,modifiedTime,size)";
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                conn.setRequestProperty("Authorization", "Bearer " + token);
                int code = conn.getResponseCode();
                if (code == 200) {
                    try (InputStream is = conn.getInputStream()) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line);
                        }
                        JSONObject obj = new JSONObject(sb.toString());
                        JSONArray files = obj.optJSONArray("files");
                        if (files != null && files.length() > 0) {
                            JSONObject first = files.optJSONObject(0);
                            if (first != null) {
                                String id = first.optString("id", "");
                                if (!id.isEmpty()) {
                                    conn.disconnect();
                                    return id;
                                }
                            }
                        }
                    }
                }
                conn.disconnect();
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    private String downloadFromGoogleDriveRestApi(String email) {
        String token = tryGetGoogleDriveToken(email);
        if (token.isEmpty()) return "";
        try {
            String fileId = findFileIdOnGoogleDriveRestApi(token);
            if (fileId.isEmpty()) return "";
            URL url = new URL("https://www.googleapis.com/drive/v3/files/" + fileId + "?alt=media");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            if (conn.getResponseCode() == 200) {
                try (InputStream is = conn.getInputStream()) {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                    conn.disconnect();
                    return sb.toString().trim();
                }
            }
            conn.disconnect();
        } catch (Exception ignored) {
        }
        return "";
    }

    private void deleteFromGoogleDriveRestApi(String email) {
        String token = tryGetGoogleDriveToken(email);
        if (token.isEmpty()) return;
        try {
            String fileId = findFileIdOnGoogleDriveRestApi(token);
            if (fileId.isEmpty()) return;
            URL url = new URL("https://www.googleapis.com/drive/v3/files/" + fileId);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("DELETE");
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.getResponseCode();
            conn.disconnect();
        } catch (Exception ignored) {
        }
    }

    private void saveInternalBackupCopy(String jsonContent, long timestampMs) {
        try {
            byte[] bytes = jsonContent.getBytes(StandardCharsets.UTF_8);

            // 1. SharedPreferences cache (backed up by Android Google Drive Auto-Backup)
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            String email = prefs.getString(KEY_DRIVE_EMAIL, "");
            prefs.edit()
                .putString(KEY_DRIVE_LAST_JSON, jsonContent)
                .putLong(KEY_DRIVE_LAST_MODIFIED, timestampMs)
                .apply();

            // 2. Internal filesDir copy (overwrites old backup file automatically)
            File file = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
            try (FileOutputStream fos = new FileOutputStream(file, false)) {
                fos.write(bytes);
                fos.flush();
            }

            // 3. App external filesDir copy (overwrites old backup file automatically)
            File extDir = getExternalFilesDir(null);
            if (extDir != null) {
                File extFile = new File(extDir, "busy_bees_expense_tracker_backup.json");
                try (FileOutputStream fos = new FileOutputStream(extFile, false)) {
                    fos.write(bytes);
                    fos.flush();
                }
            }

            // 4. Shared survival folder copy in Download/BusyBeesBackup, Documents/BusyBeesBackup & Android/media
            saveSharedSurvivalBackupCopy(bytes);

            // 5. Silent MediaStore app-scoped backup copy
            saveMediaStoreBackupCopy(bytes);

            // 6. If a persisted Google Drive Document URI exists, overwrite it silently in the background
            String persistedUriStr = prefs.getString(KEY_DRIVE_PERSISTED_URI, "");
            if (persistedUriStr != null && !persistedUriStr.isEmpty()) {
                try (OutputStream os = getContentResolver().openOutputStream(Uri.parse(persistedUriStr), "wt")) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                    }
                } catch (Exception ignored) {
                }
            }

            // 7. Upload/overwrite on Google Drive REST API in background if Google Account token is available
            if (email != null && !email.isEmpty()) {
                uploadToGoogleDriveRestApi(email, jsonContent);
            }

            // 8. Notify Android BackupManager so Google Drive Auto-Backup syncs in background
            try {
                new BackupManager(this).dataChanged();
            } catch (Exception ignored) {
            }
        } catch (Exception ignored) {
        }
    }

    private void saveMediaStoreBackupCopy(byte[] bytes) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        try {
            deleteMediaStoreBackupCopy();
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, "busy_bees_expense_tracker_backup.json");
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/BusyBeesBackup");
            Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            Uri itemUri = resolver.insert(collection, values);
            if (itemUri != null) {
                try (OutputStream os = resolver.openOutputStream(itemUri, "wt")) {
                    if (os != null) {
                        os.write(bytes);
                        os.flush();
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void deleteMediaStoreBackupCopy() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        try {
            ContentResolver resolver = getContentResolver();
            Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            resolver.delete(
                collection,
                MediaStore.MediaColumns.DISPLAY_NAME + " = ?",
                new String[]{"busy_bees_expense_tracker_backup.json"}
            );
        } catch (Exception ignored) {
        }
    }

    private String readMediaStoreBackupCopy() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return "";
        ContentResolver resolver = getContentResolver();
        Uri[] collections = new Uri[]{
            MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY),
            MediaStore.Files.getContentUri("external")
        };
        for (Uri collection : collections) {
            try {
                String[] projection = new String[]{MediaStore.MediaColumns._ID};
                String selection = MediaStore.MediaColumns.DISPLAY_NAME + " LIKE ?";
                String[] selectionArgs = new String[]{"busy_bees_expense_tracker_backup%"};
                String sortOrder = MediaStore.MediaColumns.DATE_MODIFIED + " DESC";
                try (Cursor cursor = resolver.query(collection, projection, selection, selectionArgs, sortOrder)) {
                    if (cursor != null && cursor.moveToFirst()) {
                        long id = cursor.getLong(0);
                        Uri itemUri = ContentUris.withAppendedId(collection, id);
                        try (InputStream is = resolver.openInputStream(itemUri)) {
                            if (is != null) {
                                BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                                StringBuilder sb = new StringBuilder();
                                String line;
                                while ((line = reader.readLine()) != null) {
                                    sb.append(line).append("\n");
                                }
                                String content = sb.toString().trim();
                                if (!content.isEmpty()) return content;
                            }
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }
        return "";
    }

    private String readInternalBackupCopyWithCloudFallback() {
        String local = readInternalBackupCopy();
        if (local != null && !local.trim().isEmpty()) {
            return local;
        }
        // Try background Google Drive REST API scan using connected Google account
        try {
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            String email = prefs.getString(KEY_DRIVE_EMAIL, "");
            if (email != null && !email.isEmpty()) {
                String cloudJson = downloadFromGoogleDriveRestApi(email);
                if (cloudJson != null && !cloudJson.trim().isEmpty()) {
                    long now = System.currentTimeMillis();
                    prefs.edit()
                        .putString(KEY_DRIVE_LAST_JSON, cloudJson)
                        .putLong(KEY_DRIVE_LAST_MODIFIED, now)
                        .apply();
                    saveSharedSurvivalBackupCopy(cloudJson.getBytes(StandardCharsets.UTF_8));
                    return cloudJson;
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private String readInternalBackupCopy() {
        try {
            // 1. Check internal filesDir
            File file = new File(getFilesDir(), "busy_bees_expense_tracker_backup.json");
            String res = readFileToString(file);
            if (!res.isEmpty()) return res;

            // 2. Check SharedPreferences cache
            SharedPreferences prefs = getSharedPreferences(DRIVE_PREFS_NAME, Context.MODE_PRIVATE);
            String prefJson = prefs.getString(KEY_DRIVE_LAST_JSON, "");
            if (prefJson != null && !prefJson.trim().isEmpty()) {
                return prefJson.trim();
            }

            // 3. Check persisted Google Drive Document URI (including any OS-persisted URI permissions)
            String persistedUriStr = prefs.getString(KEY_DRIVE_PERSISTED_URI, "");
            List<Uri> urisToCheck = new ArrayList<>();
            if (persistedUriStr != null && !persistedUriStr.isEmpty()) {
                urisToCheck.add(Uri.parse(persistedUriStr));
            }
            try {
                for (UriPermission perm : getContentResolver().getPersistedUriPermissions()) {
                    if (perm != null && perm.isReadPermission() && perm.getUri() != null) {
                        urisToCheck.add(perm.getUri());
                    }
                }
            } catch (Exception ignored) {
            }
            for (Uri u : urisToCheck) {
                try (InputStream is = getContentResolver().openInputStream(u)) {
                    if (is != null) {
                        BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                        StringBuilder sb = new StringBuilder();
                        String line;
                        while ((line = reader.readLine()) != null) {
                            sb.append(line).append("\n");
                        }
                        String driveJson = sb.toString().trim();
                        if (!driveJson.isEmpty() && driveJson.contains("\"transactions\"")) {
                            prefs.edit()
                                .putString(KEY_DRIVE_LAST_JSON, driveJson)
                                .putLong(KEY_DRIVE_LAST_MODIFIED, System.currentTimeMillis())
                                .apply();
                            return driveJson;
                        }
                    }
                } catch (Exception ignored) {
                }
            }

            // 4. Check external filesDir
            File extDir = getExternalFilesDir(null);
            if (extDir != null) {
                File extFile = new File(extDir, "busy_bees_expense_tracker_backup.json");
                res = readFileToString(extFile);
                if (!res.isEmpty()) return res;
            }

            // 5. Check shared survival folders (Android/media, Download/BusyBeesBackup, Documents/BusyBeesBackup, Download/*.json)
            String sharedJson = readSharedSurvivalBackupCopy();
            if (!sharedJson.isEmpty()) {
                prefs.edit()
                    .putString(KEY_DRIVE_LAST_JSON, sharedJson)
                    .putLong(KEY_DRIVE_LAST_MODIFIED, System.currentTimeMillis())
                    .apply();
                return sharedJson;
            }

            // 6. Check silent MediaStore backup copy
            String mediaStoreJson = readMediaStoreBackupCopy();
            if (!mediaStoreJson.isEmpty()) {
                prefs.edit()
                    .putString(KEY_DRIVE_LAST_JSON, mediaStoreJson)
                    .putLong(KEY_DRIVE_LAST_MODIFIED, System.currentTimeMillis())
                    .apply();
                return mediaStoreJson;
            }

            return "";
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
        WindowCompat.setDecorFitsSystemWindows(window, true);
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller != null) {
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }
    }
}
