package com.busybees.expensetracker;

import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.JavascriptInterface;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

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
