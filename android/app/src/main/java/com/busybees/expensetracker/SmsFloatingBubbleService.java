package com.busybees.expensetracker;

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
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.text.DecimalFormat;

/**
 * Facebook Messenger-style Floating Bubble Service (Chat Head) for detected SMS transactions.
 * Displays a draggable circular bubble over other apps when SYSTEM_ALERT_WINDOW is granted,
 * snapping to screen edges when dragged and expanding into a Transaction Detected card when tapped.
 */
public class SmsFloatingBubbleService extends Service {

    public static final String ACTION_SHOW_BUBBLE = "com.busybees.expensetracker.SHOW_FLOATING_BUBBLE";
    public static final String ACTION_HIDE_BUBBLE = "com.busybees.expensetracker.HIDE_FLOATING_BUBBLE";

    private WindowManager windowManager;
    private FrameLayout rootContainer;
    private View collapsedBubbleView;
    private View expandedCardView;
    private WindowManager.LayoutParams layoutParams;

    private String currentItemId = "";
    private String currentType = "expense";
    private double currentAmount = 0.0;
    private boolean isExpanded = false;

    private int lastBubbleX = 24;
    private int lastBubbleY = 260;

    public static void showBubble(Context context, String itemId, String type, double amount) {
        if (context == null) return;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
                return;
            }
            Intent intent = new Intent(context, SmsFloatingBubbleService.class);
            intent.setAction(ACTION_SHOW_BUBBLE);
            intent.putExtra(SmsTransactionProcessor.EXTRA_ITEM_ID, itemId);
            intent.putExtra(SmsTransactionProcessor.EXTRA_TX_TYPE, type);
            intent.putExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, amount);
            context.startService(intent);
        } catch (Exception ignored) {
        }
    }

    public static void hideBubble(Context context) {
        if (context == null) return;
        try {
            Intent intent = new Intent(context, SmsFloatingBubbleService.class);
            intent.setAction(ACTION_HIDE_BUBBLE);
            context.startService(intent);
        } catch (Exception ignored) {
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_HIDE_BUBBLE.equals(action)) {
            removeOverlayView();
            stopSelf();
            return START_NOT_STICKY;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String id = intent.getStringExtra(SmsTransactionProcessor.EXTRA_ITEM_ID);
        String type = intent.getStringExtra(SmsTransactionProcessor.EXTRA_TX_TYPE);
        double amount = intent.getDoubleExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, 0.0);

        if (id == null || type == null || amount <= 0) {
            stopSelf();
            return START_NOT_STICKY;
        }

        this.currentItemId = id;
        this.currentType = type;
        this.currentAmount = amount;
        this.isExpanded = false;

        renderOrUpdateOverlay();
        return START_NOT_STICKY;
    }

    private void renderOrUpdateOverlay() {
        try {
            if (windowManager == null) {
                windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
            }
            if (windowManager == null) return;

            removeOverlayView();

            int overlayType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

            DisplayMetrics dm = getResources().getDisplayMetrics();
            int screenWidth = dm.widthPixels;
            lastBubbleX = Math.max(16, screenWidth - dp(84));

            layoutParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                overlayType,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            );
            layoutParams.gravity = Gravity.TOP | Gravity.START;
            layoutParams.x = lastBubbleX;
            layoutParams.y = lastBubbleY;

            rootContainer = new FrameLayout(this);

            collapsedBubbleView = buildCollapsedBubbleView();
            expandedCardView = buildExpandedCardView();
            expandedCardView.setVisibility(View.GONE);

            rootContainer.addView(collapsedBubbleView);
            rootContainer.addView(expandedCardView);

            windowManager.addView(rootContainer, layoutParams);
        } catch (Exception ignored) {
        }
    }

    private View buildCollapsedBubbleView() {
        boolean isIncome = "income".equals(currentType);
        int mainColor = isIncome ? Color.parseColor("#059669") : Color.parseColor("#2357A4");
        DecimalFormat df = new DecimalFormat("#,##0");
        String shortAmt = (isIncome ? "+₹" : "-₹") + df.format(currentAmount);

        LinearLayout wrapper = new LinearLayout(this);
        wrapper.setOrientation(LinearLayout.VERTICAL);
        wrapper.setGravity(Gravity.CENTER_HORIZONTAL);
        wrapper.setPadding(dp(6), dp(6), dp(6), dp(6));

        FrameLayout circleFrame = new FrameLayout(this);
        int circleSize = dp(62);
        LinearLayout.LayoutParams circleLp = new LinearLayout.LayoutParams(circleSize, circleSize);
        circleFrame.setLayoutParams(circleLp);

        GradientDrawable circleBg = new GradientDrawable();
        circleBg.setShape(GradientDrawable.OVAL);
        circleBg.setColor(mainColor);
        circleBg.setStroke(dp(2), Color.WHITE);
        circleFrame.setBackground(circleBg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            circleFrame.setElevation(dp(8));
        }

        LinearLayout innerCol = new LinearLayout(this);
        innerCol.setOrientation(LinearLayout.VERTICAL);
        innerCol.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams innerLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        );
        innerCol.setLayoutParams(innerLp);

        TextView bbLabel = new TextView(this);
        bbLabel.setText("BB");
        bbLabel.setTextColor(Color.WHITE);
        bbLabel.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        bbLabel.setTypeface(Typeface.DEFAULT_BOLD);
        bbLabel.setGravity(Gravity.CENTER);

        TextView smsSub = new TextView(this);
        smsSub.setText(isIncome ? "CREDIT" : "DEBIT");
        smsSub.setTextColor(Color.parseColor("#E2E8F0"));
        smsSub.setTextSize(TypedValue.COMPLEX_UNIT_SP, 8);
        smsSub.setTypeface(Typeface.DEFAULT_BOLD);
        smsSub.setGravity(Gravity.CENTER);

        innerCol.addView(bbLabel);
        innerCol.addView(smsSub);
        circleFrame.addView(innerCol);

        // Red notification dot badge in top-right corner
        TextView dotBadge = new TextView(this);
        dotBadge.setText("1");
        dotBadge.setTextColor(Color.WHITE);
        dotBadge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        dotBadge.setTypeface(Typeface.DEFAULT_BOLD);
        dotBadge.setGravity(Gravity.CENTER);
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setShape(GradientDrawable.OVAL);
        badgeBg.setColor(Color.parseColor("#E11D48"));
        badgeBg.setStroke(dp(1), Color.WHITE);
        dotBadge.setBackground(badgeBg);
        FrameLayout.LayoutParams badgeLp = new FrameLayout.LayoutParams(dp(20), dp(20));
        badgeLp.gravity = Gravity.TOP | Gravity.END;
        dotBadge.setLayoutParams(badgeLp);
        circleFrame.addView(dotBadge);

        // Floating amount pill under the circle
        TextView amtPill = new TextView(this);
        amtPill.setText(shortAmt);
        amtPill.setTextColor(Color.WHITE);
        amtPill.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        amtPill.setTypeface(Typeface.DEFAULT_BOLD);
        amtPill.setPadding(dp(8), dp(2), dp(8), dp(2));
        GradientDrawable pillBg = new GradientDrawable();
        pillBg.setCornerRadius(dp(10));
        pillBg.setColor(Color.parseColor("#0F172A"));
        pillBg.setStroke(dp(1), Color.parseColor("#475569"));
        amtPill.setBackground(pillBg);
        LinearLayout.LayoutParams pillLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        pillLp.topMargin = dp(3);
        amtPill.setLayoutParams(pillLp);

        wrapper.addView(circleFrame);
        wrapper.addView(amtPill);

        // Touch listener for dragging around screen and clicking to expand
        wrapper.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (layoutParams == null || windowManager == null) return false;

                switch (event.getActionMasked()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = layoutParams.x;
                        initialY = layoutParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        moved = false;
                        return true;

                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > dp(6) || Math.abs(dy) > dp(6)) {
                            moved = true;
                        }
                        DisplayMetrics dm = getResources().getDisplayMetrics();
                        int maxX = dm.widthPixels - dp(72);
                        int maxY = dm.heightPixels - dp(120);
                        layoutParams.x = Math.max(0, Math.min(maxX, initialX + dx));
                        layoutParams.y = Math.max(dp(24), Math.min(maxY, initialY + dy));
                        try {
                            windowManager.updateViewLayout(rootContainer, layoutParams);
                        } catch (Exception ignored) {
                        }
                        return true;

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (!moved) {
                            expandBubble();
                        } else {
                            // Snap magnetically to nearest left or right screen edge (like FB Messenger)
                            DisplayMetrics metrics = getResources().getDisplayMetrics();
                            int mid = metrics.widthPixels / 2;
                            if (layoutParams.x + dp(35) < mid) {
                                layoutParams.x = dp(10);
                            } else {
                                layoutParams.x = metrics.widthPixels - dp(82);
                            }
                            lastBubbleX = layoutParams.x;
                            lastBubbleY = layoutParams.y;
                            try {
                                windowManager.updateViewLayout(rootContainer, layoutParams);
                            } catch (Exception ignored) {
                            }
                        }
                        return true;
                }
                return false;
            }
        });

        return wrapper;
    }

    private View buildExpandedCardView() {
        boolean isIncome = "income".equals(currentType);
        int headerColor = isIncome ? Color.parseColor("#059669") : Color.parseColor("#2357A4");
        DecimalFormat df = new DecimalFormat("#,##0.00");
        String formattedAmount = "₹" + df.format(currentAmount);

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int cardWidth = Math.min(dm.widthPixels - dp(24), dp(360));

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(
            cardWidth,
            FrameLayout.LayoutParams.WRAP_CONTENT
        );
        card.setLayoutParams(cardLp);

        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setCornerRadius(dp(22));
        cardBg.setColor(Color.parseColor("#1E293B"));
        cardBg.setStroke(dp(1), Color.parseColor("#334155"));
        card.setBackground(cardBg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            card.setElevation(dp(12));
        }

        // Colored Top Header
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.VERTICAL);
        header.setPadding(dp(16), dp(14), dp(16), dp(14));
        GradientDrawable headerBg = new GradientDrawable();
        headerBg.setCornerRadii(new float[]{
            dp(22), dp(22), dp(22), dp(22), 0, 0, 0, 0
        });
        headerBg.setColor(headerColor);
        header.setBackground(headerBg);

        LinearLayout topRow = new LinearLayout(this);
        topRow.setOrientation(LinearLayout.HORIZONTAL);
        topRow.setGravity(Gravity.CENTER_VERTICAL);

        TextView titleTv = new TextView(this);
        titleTv.setText("TRANSACTION DETECTED");
        titleTv.setTextColor(Color.WHITE);
        titleTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        titleTv.setTypeface(Typeface.DEFAULT_BOLD);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
            0,
            LinearLayout.LayoutParams.WRAP_CONTENT,
            1f
        );
        titleTv.setLayoutParams(titleLp);

        TextView minimizeBtn = new TextView(this);
        minimizeBtn.setText("Minimize");
        minimizeBtn.setTextColor(Color.WHITE);
        minimizeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        minimizeBtn.setTypeface(Typeface.DEFAULT_BOLD);
        minimizeBtn.setPadding(dp(8), dp(4), dp(8), dp(4));
        GradientDrawable minBg = new GradientDrawable();
        minBg.setCornerRadius(dp(10));
        minBg.setColor(Color.parseColor("#33000000"));
        minimizeBtn.setBackground(minBg);
        minimizeBtn.setOnClickListener(v -> collapseToBubble());

        topRow.addView(titleTv);
        topRow.addView(minimizeBtn);

        TextView typeBadge = new TextView(this);
        typeBadge.setText(isIncome ? "CREDIT (INCOME)" : "DEBIT (EXPENSE)");
        typeBadge.setTextColor(Color.parseColor("#E2E8F0"));
        typeBadge.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        typeBadge.setTypeface(Typeface.DEFAULT_BOLD);
        typeBadge.setPadding(0, dp(6), 0, dp(2));

        TextView amountTv = new TextView(this);
        amountTv.setText(formattedAmount);
        amountTv.setTextColor(Color.WHITE);
        amountTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 26);
        amountTv.setTypeface(Typeface.DEFAULT_BOLD);

        TextView privacyTv = new TextView(this);
        privacyTv.setText("Only Debit/Credit & Amount captured • Zero bank info stored");
        privacyTv.setTextColor(Color.parseColor("#D9FFFFFF"));
        privacyTv.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10);
        privacyTv.setPadding(0, dp(4), 0, 0);

        header.addView(topRow);
        header.addView(typeBadge);
        header.addView(amountTv);
        header.addView(privacyTv);

        // Equal-Sized Buttons Row (L -> R: Save, Edit, Ignore)
        LinearLayout actionsRow = new LinearLayout(this);
        actionsRow.setOrientation(LinearLayout.HORIZONTAL);
        actionsRow.setPadding(dp(12), dp(12), dp(12), dp(12));

        TextView saveBtn = createActionButton("Save", headerColor, Color.WHITE);
        saveBtn.setOnClickListener(v -> triggerActivityAction("save"));

        TextView editBtn = createActionButton("Edit", Color.parseColor("#334155"), Color.WHITE);
        LinearLayout.LayoutParams editLp = (LinearLayout.LayoutParams) editBtn.getLayoutParams();
        editLp.leftMargin = dp(6);
        editLp.rightMargin = dp(6);
        editBtn.setLayoutParams(editLp);
        editBtn.setOnClickListener(v -> triggerActivityAction("edit"));

        TextView ignoreBtn = createActionButton("Ignore", Color.parseColor("#0F172A"), Color.parseColor("#94A3B8"));
        ignoreBtn.setOnClickListener(v -> {
            SmsTransactionProcessor.removeDetectedItemFromQueue(getApplicationContext(), currentItemId);
            Intent broadcast = new Intent(SmsTransactionProcessor.ACTION_SMS_DETECTED);
            broadcast.setPackage(getPackageName());
            broadcast.putExtra("dismissedId", currentItemId);
            sendBroadcast(broadcast);
            removeOverlayView();
            stopSelf();
        });

        actionsRow.addView(saveBtn);
        actionsRow.addView(editBtn);
        actionsRow.addView(ignoreBtn);

        card.addView(header);
        card.addView(actionsRow);
        return card;
    }

    private TextView createActionButton(String text, int bgColor, int textColor) {
        TextView btn = new TextView(this);
        btn.setText(text);
        btn.setTextColor(textColor);
        btn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        btn.setTypeface(Typeface.DEFAULT_BOLD);
        btn.setGravity(Gravity.CENTER);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(12));
        bg.setColor(bgColor);
        btn.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0, dp(40), 1f);
        btn.setLayoutParams(lp);
        return btn;
    }

    private void expandBubble() {
        if (isExpanded || rootContainer == null || windowManager == null) return;
        isExpanded = true;
        collapsedBubbleView.setVisibility(View.GONE);
        expandedCardView.setVisibility(View.VISIBLE);

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int cardWidth = Math.min(dm.widthPixels - dp(24), dp(360));
        layoutParams.x = (dm.widthPixels - cardWidth) / 2;
        layoutParams.y = Math.max(dp(60), Math.min(dm.heightPixels - dp(260), lastBubbleY));
        try {
            windowManager.updateViewLayout(rootContainer, layoutParams);
        } catch (Exception ignored) {
        }
    }

    private void collapseToBubble() {
        if (!isExpanded || rootContainer == null || windowManager == null) return;
        isExpanded = false;
        expandedCardView.setVisibility(View.GONE);
        collapsedBubbleView.setVisibility(View.VISIBLE);

        layoutParams.x = lastBubbleX;
        layoutParams.y = lastBubbleY;
        try {
            windowManager.updateViewLayout(rootContainer, layoutParams);
        } catch (Exception ignored) {
        }
    }

    private void triggerActivityAction(String actionType) {
        try {
            Intent launch = new Intent(this, MainActivity.class);
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            launch.putExtra(SmsTransactionProcessor.EXTRA_ACTION_TYPE, actionType);
            launch.putExtra(SmsTransactionProcessor.EXTRA_ITEM_ID, currentItemId);
            launch.putExtra(SmsTransactionProcessor.EXTRA_TX_TYPE, currentType);
            launch.putExtra(SmsTransactionProcessor.EXTRA_TX_AMOUNT, currentAmount);
            startActivity(launch);
        } catch (Exception ignored) {
        }
        removeOverlayView();
        stopSelf();
    }

    private void removeOverlayView() {
        if (windowManager != null && rootContainer != null) {
            try {
                windowManager.removeView(rootContainer);
            } catch (Exception ignored) {
            }
            rootContainer = null;
        }
    }

    @Override
    public void onDestroy() {
        removeOverlayView();
        super.onDestroy();
    }

    private int dp(int value) {
        return (int) TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value,
            getResources().getDisplayMetrics()
        );
    }
}
