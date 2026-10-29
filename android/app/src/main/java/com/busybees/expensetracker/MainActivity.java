package com.busybees.expensetracker;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
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
import androidx.core.content.ContextCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.Locale;
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {

    private final BroadcastReceiver smsDetectedReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || bridge == null || bridge.getWebView() == null) return;
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

        // Configure status bar & navigation bar icon contrast so time and battery icons are clearly visible
        updateSystemBarAppearance(false);

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
                    return isNotificationListenerEnabled();
                }

                @JavascriptInterface
                public void openSmsNotificationAccessSettings() {
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
                        SmsNotificationListenerService.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    String pending = prefs.getString(
                        SmsNotificationListenerService.KEY_PENDING_QUEUE,
                        "[]"
                    );
                    prefs.edit().putString(SmsNotificationListenerService.KEY_PENDING_QUEUE, "[]").apply();
                    return pending != null ? pending : "[]";
                }

                @JavascriptInterface
                public void setSmsAutoDetectEnabled(boolean enabled) {
                    SharedPreferences prefs = getSharedPreferences(
                        SmsNotificationListenerService.PREFS_NAME,
                        Context.MODE_PRIVATE
                    );
                    prefs.edit().putBoolean(
                        SmsNotificationListenerService.KEY_AUTO_DETECT_ENABLED,
                        enabled
                    ).apply();
                }
            }, "BusyBeesNative");
        }

        // Intercept Android hardware / gesture Back button and forward to WebView (#21 & #22)
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
    public void onStart() {
        super.onStart();
        IntentFilter filter = new IntentFilter(SmsNotificationListenerService.ACTION_SMS_DETECTED);
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
                    // BiometricPrompt automatically shows retry UI on sensor mismatch
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
