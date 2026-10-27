package com.busybees.expensetracker;

import android.os.Bundle;
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
import java.util.concurrent.Executor;

public class MainActivity extends BridgeActivity {
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
