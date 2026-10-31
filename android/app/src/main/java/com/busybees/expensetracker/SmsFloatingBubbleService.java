package com.busybees.expensetracker;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.app.NotificationCompat;
import java.util.Locale;

/**
 * System-wide floating overlay bubble notification for detected SMS transactions.
 *
 * Features requested by user:
 *  1. Green (#16A34A) for Credit (Income) and Red (#DC2626) for Debit (Expense).
 *  2. Maximised by default when an SMS transaction is detected.
 *  3. No "Minimize" text link at the top right — only the circular Bubble Icon at the top right,
 *     clicking which toggles between Minimised and Maximised states.
 *  4. Category dropdown selector inside the colored card section (defaults to "Shopping" for Debit
 *     and "Salary" for Credit).
 *  5. Dragging the bubble notification to the bottom of the screen closes/dismisses it.
 */
public class SmsFloatingBubbleService extends Service {

    private static final String OVERLAY_CHANNEL_ID = "bb_sms_overlay_service_channel";
    private static final int OVERLAY_FG_NOTIF_ID = 7901;

    private static final String[] EXPENSE_CATEGORIES = new String[]{
        "Food & groceries",
        "Shopping",
        "Transport",
        "Bills & utilities",
        "Entertainment",
        "Health & medical",
        "Education",
        "Housing & rent",
        "Personal care",
        "Travel",
        "Other"
    };

    private static final String[] INCOME_CATEGORIES = new String[]{
        "Salary",
        "Rentals",
        "Freelance",
        "Investments",
        "Gift",
        "Refund",
        "Business",
        "Other"
    };

    private WindowManager windowManager;
    private View overlayRootView;
    private WindowManager.LayoutParams overlayParams;

    private View dismissTargetContainer;
    private TextView dismissTargetPill;
    private WindowManager.LayoutParams dismissParams;

    private View categoryPickerOverlay;
    private WindowManager.LayoutParams categoryPickerParams;

    private String currentItemId = "";
    private String currentType = "expense";
    private double currentAmount = 0.0;
    private String selectedCategory = "Shopping";
    private boolean isExpanded = true; // Maximised by default

    public static void showDetectedTransaction(
        Context context,
        String itemId,
        String type,
        double amount
    ) {
        if (context == null || amount <= 0) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            return;
        }
        try {
            Intent intent = new Intent(context, SmsFloatingBubbleService.class);
            intent.setAction("SHOW_BUBBLE");
            intent.putExtra(SmsTransactionProcessor.EXTRA_ITEM_ID, itemId);
            intent.putExtra(SmsTransactionProcessor.EXTRA_TX_TYPE, type);
            intent.putExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, amount);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }
        } catch (Exception ignored) {
        }
    }

    public static void dismissIfMatching(Context context, String itemId) {
        if (context == null || itemId == null || itemId.isEmpty()) return;
        try {
            Intent intent = new Intent(context, SmsFloatingBubbleService.class);
            intent.setAction("DISMISS_IF_MATCHING");
            intent.putExtra(SmsTransactionProcessor.EXTRA_ITEM_ID, itemId);
            context.startService(intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        startMinimalForeground();
    }

    private void startMinimalForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                NotificationChannel channel = new NotificationChannel(
                    OVERLAY_CHANNEL_ID,
                    "Floating Transaction Bubble",
                    NotificationManager.IMPORTANCE_MIN
                );
                channel.setShowBadge(false);
                channel.setSound(null, null);
                channel.enableVibration(false);
                nm.createNotificationChannel(channel);
            }
            Notification notification = new NotificationCompat.Builder(this, OVERLAY_CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Busy Bees")
                .setContentText("Transaction bubble active")
                .setPriority(NotificationCompat.PRIORITY_MIN)
                .setSilent(true)
                .build();
            try {
                startForeground(OVERLAY_FG_NOTIF_ID, notification);
            } catch (Exception ignored) {
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopBubbleService();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if ("DISMISS_IF_MATCHING".equals(action)) {
            String targetId = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
            if (targetId != null && targetId.equals(currentItemId)) {
                stopBubbleService();
            } else if (overlayRootView == null) {
                stopBubbleService();
            }
            return START_NOT_STICKY;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopBubbleService();
            return START_NOT_STICKY;
        }

        String itemId = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
        String txType = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_TYPE);
        double txAmount = intent.getDoubleExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, 0.0);

        if (txAmount <= 0) {
            stopBubbleService();
            return START_NOT_STICKY;
        }

        currentItemId = itemId != null ? itemId : ("sms_" + System.currentTimeMillis());
        currentType = "income".equals(txType) ? "income" : "expense";
        currentAmount = txAmount;
        selectedCategory = "income".equals(currentType) ? "Salary" : "Shopping";
        isExpanded = true; // Always show maximised by default when a new SMS arrives

        ensureDismissZoneView();
        renderOverlayView();

        return START_NOT_STICKY;
    }

    private void ensureDismissZoneView() {
        if (dismissTargetContainer != null || windowManager == null) return;

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        dismissParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            dp(110),
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        dismissParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;

        FrameLayout container = new FrameLayout(this);
        container.setVisibility(View.GONE);

        TextView pill = new TextView(this);
        pill.setText("✕   Drag here to close");
        pill.setTextColor(Color.WHITE);
        pill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        pill.setTypeface(Typeface.DEFAULT_BOLD);
        pill.setGravity(Gravity.CENTER);
        pill.setPadding(dp(22), dp(12), dp(22), dp(12));
        pill.setBackground(createRoundedDrawable(Color.parseColor("#CC0F172A"), dp(28), dp(2), Color.parseColor("#66FFFFFF")));

        FrameLayout.LayoutParams pillLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        pillLp.gravity = Gravity.CENTER;
        container.addView(pill, pillLp);

        dismissTargetContainer = container;
        dismissTargetPill = pill;

        try {
            windowManager.addView(dismissTargetContainer, dismissParams);
        } catch (Exception ignored) {
        }
    }

    private void setDismissZoneState(boolean visible, boolean activeHover) {
        if (dismissTargetContainer == null || dismissTargetPill == null) return;
        dismissTargetContainer.setVisibility(visible ? View.VISIBLE : View.GONE);
        if (visible) {
            if (activeHover) {
                dismissTargetPill.setText("✕   Release to close");
                dismissTargetPill.setBackground(
                    createRoundedDrawable(Color.parseColor("#EEB91C1C"), dp(28), dp(2), Color.WHITE)
                );
                dismissTargetPill.setScaleX(1.08f);
                dismissTargetPill.setScaleY(1.08f);
            } else {
                dismissTargetPill.setText("✕   Drag here to close");
                dismissTargetPill.setBackground(
                    createRoundedDrawable(Color.parseColor("#CC0F172A"), dp(28), dp(2), Color.parseColor("#66FFFFFF"))
                );
                dismissTargetPill.setScaleX(1.0f);
                dismissTargetPill.setScaleY(1.0f);
            }
        }
    }

    private void renderOverlayView() {
        if (windowManager == null) return;

        closeCategoryPickerOverlay();

        int prevY = dp(105);
        int prevX = 0;
        boolean hadPrevious = false;
        if (overlayRootView != null && overlayParams != null) {
            prevY = overlayParams.y;
            prevX = overlayParams.x;
            hadPrevious = true;
            try {
                windowManager.removeView(overlayRootView);
            } catch (Exception ignored) {
            }
            overlayRootView = null;
        }

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenWidth = dm.widthPixels;
        int cardWidth = Math.min(screenWidth - dp(24), dp(400));

        overlayParams = new WindowManager.LayoutParams(
            isExpanded ? cardWidth : ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );

        if (isExpanded) {
            overlayParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            overlayParams.x = hadPrevious ? prevX : 0;
            overlayParams.y = hadPrevious ? prevY : dp(105);
        } else {
            overlayParams.gravity = Gravity.TOP | Gravity.END;
            overlayParams.x = dp(16);
            overlayParams.y = hadPrevious ? prevY : dp(120);
        }

        overlayRootView = isExpanded ? buildMaximisedCardView() : buildMinimisedBubbleView();

        try {
            windowManager.addView(overlayRootView, overlayParams);
        } catch (Exception ignored) {
        }
    }

    /**
     * Builds the Minimised floating circular Bubble Icon (Green for Credit, Red for Debit).
     * Tapping it expands to the Maximised card; dragging it to the bottom closes it.
     */
    private View buildMinimisedBubbleView() {
        boolean isIncome = "income".equals(currentType);
        int accentColor = isIncome ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626");

        FrameLayout wrapper = new FrameLayout(this);
        wrapper.setPadding(dp(4), dp(4), dp(4), dp(4));

        LinearLayout circle = new LinearLayout(this);
        circle.setOrientation(LinearLayout.VERTICAL);
        circle.setGravity(Gravity.CENTER);
        circle.setBackground(createRoundedDrawable(accentColor, dp(28), dp(2), Color.WHITE));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            circle.setElevation(dp(8));
        }

        TextView symbolText = new TextView(this);
        symbolText.setText(isIncome ? "+₹" : "-₹");
        symbolText.setTextColor(Color.WHITE);
        symbolText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        symbolText.setTypeface(Typeface.DEFAULT_BOLD);
        symbolText.setGravity(Gravity.CENTER);
        circle.addView(symbolText);

        FrameLayout.LayoutParams circleLp = new FrameLayout.LayoutParams(dp(56), dp(56));
        wrapper.addView(circle, circleLp);

        attachDragAndClickHandler(
            wrapper,
            () -> {
                isExpanded = true;
                renderOverlayView();
            }
        );

        return wrapper;
    }

    /**
     * Builds the Maximised Transaction Card matching the user's screenshot:
     * - Top colored section: Green (#16A34A) for Credit, Red (#DC2626) for Debit.
     * - Top row: "TRANSACTION DETECTED" on the left + circular Bubble Icon at the top right (no "Minimize" link).
     *   Clicking the top-right Bubble Icon toggles between Minimised and Maximised.
     * - Subtitle: "CREDIT (INCOME)" or "DEBIT (EXPENSE)"
     * - Large Amount: "₹54.00"
     * - Category Dropdown Selector right below the amount
     * - Privacy footnote: "Only Debit/Credit & Amount captured • Zero bank info stored"
     * - Bottom dark bar (#111827) with Save (Green/Red), Edit (#334155), Ignore (#090D16) buttons.
     */
    private View buildMaximisedCardView() {
        boolean isIncome = "income".equals(currentType);
        int primaryColor = isIncome ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626");
        int darkerAccent = isIncome ? Color.parseColor("#15803D") : Color.parseColor("#B91C1C");

        LinearLayout cardRoot = new LinearLayout(this);
        cardRoot.setOrientation(LinearLayout.VERTICAL);
        cardRoot.setBackground(createRoundedDrawable(Color.parseColor("#111827"), dp(22), dp(1), Color.parseColor("#33FFFFFF")));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            cardRoot.setElevation(dp(12));
        }

        // =========================================================================
        // 1. TOP COLORED SECTION (GREEN FOR CREDIT / RED FOR DEBIT)
        // =========================================================================
        LinearLayout topSection = new LinearLayout(this);
        topSection.setOrientation(LinearLayout.VERTICAL);
        topSection.setPadding(dp(18), dp(14), dp(16), dp(14));
        topSection.setBackground(createTopRoundedDrawable(primaryColor, dp(22)));

        // Header Row: "TRANSACTION DETECTED" + Top-Right Circular Bubble Icon (toggles minimise/maximise)
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView titleTv = new TextView(this);
        titleTv.setText("TRANSACTION DETECTED");
        titleTv.setTextColor(Color.parseColor("#F0FDF4"));
        titleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        titleTv.setTypeface(Typeface.DEFAULT_BOLD);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            titleTv.setLetterSpacing(0.08f);
        }
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        headerRow.addView(titleTv, titleLp);

        // Top-right circular Bubble Icon (replaces the old "Minimize" text link)
        FrameLayout topBubbleButton = new FrameLayout(this);
        topBubbleButton.setBackground(
            createRoundedDrawable(darkerAccent, dp(20), dp(2), Color.WHITE)
        );
        TextView bubbleIconTv = new TextView(this);
        bubbleIconTv.setText(isIncome ? "+₹" : "-₹");
        bubbleIconTv.setTextColor(Color.WHITE);
        bubbleIconTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        bubbleIconTv.setTypeface(Typeface.DEFAULT_BOLD);
        bubbleIconTv.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams iconInnerLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        );
        topBubbleButton.addView(bubbleIconTv, iconInnerLp);

        LinearLayout.LayoutParams bubbleBtnLp = new LinearLayout.LayoutParams(dp(38), dp(38));
        headerRow.addView(topBubbleButton, bubbleBtnLp);

        // Clicking or dragging the top-right bubble icon toggles minimise / drags the card
        attachDragAndClickHandler(
            topBubbleButton,
            () -> {
                isExpanded = false;
                renderOverlayView();
            }
        );

        topSection.addView(headerRow);

        // Subtitle: "DEBIT (EXPENSE)" or "CREDIT (INCOME)"
        TextView typeTv = new TextView(this);
        typeTv.setText(isIncome ? "CREDIT (INCOME)" : "DEBIT (EXPENSE)");
        typeTv.setTextColor(Color.parseColor("#DCFCE7"));
        typeTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        typeTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams typeLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        typeLp.topMargin = dp(2);
        topSection.addView(typeTv, typeLp);

        // Large Formatted Amount: "₹54.00"
        TextView amountTv = new TextView(this);
        amountTv.setText(String.format(Locale.US, "₹%,.2f", currentAmount));
        amountTv.setTextColor(Color.WHITE);
        amountTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        amountTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams amountLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        amountLp.topMargin = dp(2);
        topSection.addView(amountTv, amountLp);

        // Category Dropdown Selector Row inside the colored section
        LinearLayout categorySelectorBtn = new LinearLayout(this);
        categorySelectorBtn.setOrientation(LinearLayout.HORIZONTAL);
        categorySelectorBtn.setGravity(Gravity.CENTER_VERTICAL);
        categorySelectorBtn.setPadding(dp(12), dp(8), dp(12), dp(8));
        categorySelectorBtn.setBackground(
            createRoundedDrawable(darkerAccent, dp(12), dp(1), Color.parseColor("#55FFFFFF"))
        );

        TextView catLabelTv = new TextView(this);
        catLabelTv.setText("Category: ");
        catLabelTv.setTextColor(Color.parseColor("#E2E8F0"));
        catLabelTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        categorySelectorBtn.addView(catLabelTv);

        TextView catValueTv = new TextView(this);
        catValueTv.setText(selectedCategory);
        catValueTv.setTextColor(Color.WHITE);
        catValueTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        catValueTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams catValLp = new LinearLayout.LayoutParams(
            0,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            1f
        );
        categorySelectorBtn.addView(catValueTv, catValLp);

        TextView chevronTv = new TextView(this);
        chevronTv.setText("▼");
        chevronTv.setTextColor(Color.WHITE);
        chevronTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        categorySelectorBtn.addView(chevronTv);

        categorySelectorBtn.setOnClickListener(v -> showCategoryPickerModal(catValueTv));

        LinearLayout.LayoutParams catRowLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        catRowLp.topMargin = dp(8);
        catRowLp.bottomMargin = dp(8);
        topSection.addView(categorySelectorBtn, catRowLp);

        // Privacy Footnote
        TextView privacyTv = new TextView(this);
        privacyTv.setText("Only Debit/Credit & Amount captured • Zero bank info stored");
        privacyTv.setTextColor(Color.parseColor("#F1F5F9"));
        privacyTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        topSection.addView(privacyTv);

        // Allow dragging the entire top section to move the card or drag to bottom to close
        attachDragAndClickHandler(topSection, null);

        cardRoot.addView(topSection);

        // =========================================================================
        // 2. BOTTOM ACTION BAR (Save / Edit / Ignore)
        // =========================================================================
        LinearLayout bottomSection = new LinearLayout(this);
        bottomSection.setOrientation(LinearLayout.HORIZONTAL);
        bottomSection.setPadding(dp(14), dp(14), dp(14), dp(14));
        bottomSection.setGravity(Gravity.CENTER_VERTICAL);

        // Save Button (Green for Credit, Red for Debit)
        TextView saveBtn = buildActionButton("Save", primaryColor, Color.WHITE);
        saveBtn.setOnClickListener(v -> handleSaveClicked());

        // Edit Button
        TextView editBtn = buildActionButton("Edit", Color.parseColor("#334155"), Color.WHITE);
        editBtn.setOnClickListener(v -> handleEditClicked());

        // Ignore Button
        TextView ignoreBtn = buildActionButton("Ignore", Color.parseColor("#090D16"), Color.parseColor("#CBD5E1"));
        ignoreBtn.setOnClickListener(v -> handleIgnoreClicked());

        LinearLayout.LayoutParams btnLp1 = new LinearLayout.LayoutParams(0, dp(44), 1f);
        btnLp1.rightMargin = dp(8);
        LinearLayout.LayoutParams btnLp2 = new LinearLayout.LayoutParams(0, dp(44), 1f);
        btnLp2.rightMargin = dp(8);
        LinearLayout.LayoutParams btnLp3 = new LinearLayout.LayoutParams(0, dp(44), 1f);

        bottomSection.addView(saveBtn, btnLp1);
        bottomSection.addView(editBtn, btnLp2);
        bottomSection.addView(ignoreBtn, btnLp3);

        cardRoot.addView(bottomSection);

        return cardRoot;
    }

    private TextView buildActionButton(String text, int bgColor, int textColor) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(textColor);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setGravity(Gravity.CENTER);
        tv.setBackground(createRoundedDrawable(bgColor, dp(14), 0, Color.TRANSPARENT));
        return tv;
    }

    /**
     * Displays an overlay dropdown list of categories when the user taps the Category selector.
     */
    private void showCategoryPickerModal(TextView catValueTvToUpdate) {
        closeCategoryPickerOverlay();
        if (windowManager == null) return;

        int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        categoryPickerParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayType,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        categoryPickerParams.gravity = Gravity.CENTER;

        FrameLayout backdrop = new FrameLayout(this);
        backdrop.setBackgroundColor(Color.parseColor("#88000000"));
        backdrop.setOnClickListener(v -> closeCategoryPickerOverlay());

        boolean isIncome = "income".equals(currentType);
        String[] categories = isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
        int accentColor = isIncome ? Color.parseColor("#16A34A") : Color.parseColor("#DC2626");

        LinearLayout sheet = new LinearLayout(this);
        sheet.setOrientation(LinearLayout.VERTICAL);
        sheet.setPadding(dp(16), dp(16), dp(16), dp(16));
        sheet.setBackground(createRoundedDrawable(Color.parseColor("#1E293B"), dp(20), dp(1), Color.parseColor("#475569")));

        TextView header = new TextView(this);
        header.setText(isIncome ? "Select Income Category" : "Select Expense Category");
        header.setTextColor(Color.WHITE);
        header.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        header.setTypeface(Typeface.DEFAULT_BOLD);
        header.setPadding(dp(6), dp(2), dp(6), dp(10));
        sheet.addView(header);

        ScrollView scrollView = new ScrollView(this);
        LinearLayout listContainer = new LinearLayout(this);
        listContainer.setOrientation(LinearLayout.VERTICAL);

        for (String cat : categories) {
            boolean isSelected = cat.equals(selectedCategory);
            TextView itemTv = new TextView(this);
            itemTv.setText(isSelected ? ("✓  " + cat) : ("     " + cat));
            itemTv.setTextColor(Color.WHITE);
            itemTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
            itemTv.setTypeface(isSelected ? Typeface.DEFAULT_BOLD : Typeface.DEFAULT);
            itemTv.setPadding(dp(12), dp(11), dp(12), dp(11));
            if (isSelected) {
                itemTv.setBackground(createRoundedDrawable(accentColor, dp(10), 0, Color.TRANSPARENT));
            }
            itemTv.setOnClickListener(v -> {
                selectedCategory = cat;
                if (catValueTvToUpdate != null) {
                    catValueTvToUpdate.setText(cat);
                }
                closeCategoryPickerOverlay();
            });
            LinearLayout.LayoutParams itemLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            itemLp.bottomMargin = dp(4);
            listContainer.addView(itemTv, itemLp);
        }

        scrollView.addView(listContainer);
        LinearLayout.LayoutParams scrollLp = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            dp(310)
        );
        sheet.addView(scrollView, scrollLp);

        DisplayMetrics dm = getResources().getDisplayMetrics();
        FrameLayout.LayoutParams sheetLp = new FrameLayout.LayoutParams(
            Math.min(dm.widthPixels - dp(40), dp(340)),
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        sheetLp.gravity = Gravity.CENTER;
        backdrop.addView(sheet, sheetLp);

        categoryPickerOverlay = backdrop;
        try {
            windowManager.addView(categoryPickerOverlay, categoryPickerParams);
        } catch (Exception ignored) {
        }
    }

    private void closeCategoryPickerOverlay() {
        if (categoryPickerOverlay != null && windowManager != null) {
            try {
                windowManager.removeView(categoryPickerOverlay);
            } catch (Exception ignored) {
            }
            categoryPickerOverlay = null;
        }
    }

    /**
     * Attaches touch drag handling so the user can:
     * 1. Drag the bubble/card anywhere on the screen.
     * 2. Drag it to the bottom of the screen to dismiss/close it.
     * 3. Tap (without dragging) to trigger onClickAction (e.g. toggle minimise/maximise).
     */
    private void attachDragAndClickHandler(View touchHandle, Runnable onClickAction) {
        touchHandle.setOnTouchListener(new View.OnTouchListener() {
            private float downRawX;
            private float downRawY;
            private int startParamX;
            private int startParamY;
            private boolean isDragging;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (overlayParams == null || windowManager == null) return false;
                DisplayMetrics dm = getResources().getDisplayMetrics();
                int screenHeight = dm.heightPixels;
                int dismissThresholdY = (int) (screenHeight * 0.78f);

                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        downRawX = event.getRawX();
                        downRawY = event.getRawY();
                        startParamX = overlayParams.x;
                        startParamY = overlayParams.y;
                        isDragging = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        float dx = event.getRawX() - downRawX;
                        float dy = event.getRawY() - downRawY;
                        if (!isDragging && (Math.abs(dx) > dp(8) || Math.abs(dy) > dp(8))) {
                            isDragging = true;
                            setDismissZoneState(true, false);
                        }
                        if (isDragging) {
                            if ((overlayParams.gravity & Gravity.END) == Gravity.END) {
                                overlayParams.x = Math.max(0, startParamX - (int) dx);
                            } else {
                                overlayParams.x = startParamX + (int) dx;
                            }
                            overlayParams.y = Math.max(dp(24), startParamY + (int) dy);
                            try {
                                windowManager.updateViewLayout(overlayRootView, overlayParams);
                            } catch (Exception ignored) {
                            }

                            boolean inDismissZone = event.getRawY() >= dismissThresholdY;
                            setDismissZoneState(true, inDismissZone);
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isDragging) {
                            boolean inDismissZone = event.getRawY() >= dismissThresholdY;
                            setDismissZoneState(false, false);
                            if (inDismissZone) {
                                handleIgnoreClicked();
                            }
                        } else if (onClickAction != null) {
                            onClickAction.run();
                        }
                        return true;
                }
                return false;
            }
        });
    }

    private void handleSaveClicked() {
        Context appContext = getApplicationContext();
        SmsTransactionProcessor.resolveAndCancelNotification(appContext, currentItemId);
        SmsTransactionProcessor.enqueueAutoSavedItem(
            appContext,
            currentItemId,
            currentType,
            currentAmount,
            selectedCategory
        );

        Intent liveEvent = new Intent("com.busybees.expensetracker.SMS_DETECTED");
        liveEvent.setPackage(getPackageName());
        liveEvent.putExtra("autoSavedId", currentItemId);
        liveEvent.putExtra("id", currentItemId);
        liveEvent.putExtra("type", currentType);
        liveEvent.putExtra("amount", currentAmount);
        liveEvent.putExtra("category", selectedCategory);
        sendBroadcast(liveEvent);

        Toast.makeText(
            appContext,
            ("income".equals(currentType) ? "Income saved (" : "Expense saved (") + selectedCategory + ")",
            Toast.LENGTH_SHORT
        ).show();

        stopBubbleService();
    }

    private void handleEditClicked() {
        Context appContext = getApplicationContext();
        SmsTransactionProcessor.resolveAndCancelNotification(appContext, currentItemId);

        Intent editIntent = new Intent(appContext, MainActivity.class);
        editIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        editIntent.putExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE, "edit");
        editIntent.putExtra(SmsTransactionProcessor.EXTRA_ITEM_ID, currentItemId);
        editIntent.putExtra(SmsTransactionProcessor.EXTRA_TX_TYPE, currentType);
        editIntent.putExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, currentAmount);
        editIntent.putExtra(SmsTransactionProcessor.EXTRA_TX_CATEGORY, selectedCategory);
        startActivity(editIntent);

        stopBubbleService();
    }

    private void handleIgnoreClicked() {
        Context appContext = getApplicationContext();
        SmsTransactionProcessor.resolveAndCancelNotification(appContext, currentItemId);

        Intent liveEvent = new Intent("com.busybees.expensetracker.SMS_DETECTED");
        liveEvent.setPackage(getPackageName());
        liveEvent.putExtra("dismissedId", currentItemId);
        sendBroadcast(liveEvent);

        stopBubbleService();
    }

    private void stopBubbleService() {
        closeCategoryPickerOverlay();
        if (overlayRootView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayRootView);
            } catch (Exception ignored) {
            }
            overlayRootView = null;
        }
        if (dismissTargetContainer != null && windowManager != null) {
            try {
                windowManager.removeView(dismissTargetContainer);
            } catch (Exception ignored) {
            }
            dismissTargetContainer = null;
        }
        stopForeground(true);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        closeCategoryPickerOverlay();
        if (overlayRootView != null && windowManager != null) {
            try {
                windowManager.removeView(overlayRootView);
            } catch (Exception ignored) {
            }
            overlayRootView = null;
        }
        if (dismissTargetContainer != null && windowManager != null) {
            try {
                windowManager.removeView(dismissTargetContainer);
            } catch (Exception ignored) {
            }
            dismissTargetContainer = null;
        }
        super.onDestroy();
    }

    private GradientDrawable createRoundedDrawable(int fillColor, int radiusPx, int strokeWidthPx, int strokeColor) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(fillColor);
        gd.setCornerRadius(radiusPx);
        if (strokeWidthPx > 0) {
            gd.setStroke(strokeWidthPx, strokeColor);
        }
        return gd;
    }

    private GradientDrawable createTopRoundedDrawable(int fillColor, int radiusPx) {
        GradientDrawable gd = new GradientDrawable();
        gd.setColor(fillColor);
        gd.setCornerRadii(new float[]{
            radiusPx, radiusPx,
            radiusPx, radiusPx,
            0f, 0f,
            0f, 0f
        });
        return gd;
    }

    private int dp(int value) {
        return Math.round(
            TypedValue.applyDimension(
                TypedValue.COMPLEX_UNIT_DIP,
                value,
                getResources().getDisplayMetrics()
            )
        );
    }
}
