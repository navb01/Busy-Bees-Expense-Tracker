# SMS Transaction Auto-Detection (Play Store & App Store Compliant)

## 1. Overview & Privacy Guarantee
This plan implements automatic transaction detection from incoming SMS notifications while remaining **100% compliant with Google Play Store and Apple App Store policies** and enforcing **strict zero-bank-data privacy**:
- **Captured Fields Only**: `type` (`'expense'` for Debit or `'income'` for Credit), `amount` (numeric value), and `detectedAt` (timestamp).
- **Strictly Excluded**: Bank names, account/card numbers, UPI IDs, reference numbers, available balances, merchant names, and raw SMS text are **never stored** in memory queues, `localStorage`, or Google Drive backups.

---

## 2. Architecture & Detection Channels

### A. On-Device Privacy-First SMS Parser (`src/services/smsTransactionParser.ts`)
- **Keyword Classification**:
  - **Debit (`expense`)**: `debited`, `withdrawn`, `spent`, `paid`, `sent`, `purchase`, `charged`, `txn of`, `dr`
  - **Credit (`income`)**: `credited`, `deposited`, `received`, `refund`, `added`, `cr`
- **Exclusion / False-Positive Guard**:
  - Ignores OTPs (`OTP`, `one time password`, `verification code`), balance inquiries without transactions, bill reminders (`due on`, `will be debited`), and promotional messages (`loan`, `offer`, `pre-approved`, `win`).
- **Transaction Amount vs. Balance Disambiguation**:
  - Strips `Avl Bal`, `Available Balance`, `Bal:`, `Total Limit` segments first so the parser always extracts the actual transaction amount (`Rs.`, `INR`, `₹`, `$`, `EUR`, `GBP`, `AED`, etc.) and never mistakes the remaining account balance for the transaction amount.
- **Immediate Sanitization**:
  - Returns only `{ id, type: 'income' | 'expense', amount: number, detectedAt: number }`. Raw text is immediately discarded.

### B. Android Automatic Detection (`NotificationListenerService` — Google Play Store Compliant)
- **Native Service (`SmsNotificationListenerService.java`)**:
  - Extends Android's `NotificationListenerService` (`android.permission.BIND_NOTIFICATION_LISTENER_SERVICE` in `AndroidManifest.xml` — no restricted `READ_SMS` or `RECEIVE_SMS` permissions).
  - Listens for incoming notifications from SMS/messaging packages (`com.google.android.apps.messaging`, `com.samsung.android.messaging`, default SMS apps, etc.).
  - Runs the same strict regex extraction in Java: extracts **only** `debit`/`credit` and the numeric `amount`, discards the notification text immediately, stores only `{ id, type, amount, detectedAt }` in a lightweight native pending queue (`SharedPreferences`), posts a high-priority heads-up notification (**"Transaction Detected: ₹450 Debit — Tap to Save or Edit"**), and dispatches a live event (`bb-sms-detected`) to the WebView if the app is open.
- **Native Bridge Extensions (`MainActivity.java`)**:
  - `isSmsNotificationAccessGranted()`: Checks if Notification Access is enabled for Busy Bees.
  - `openSmsNotificationAccessSettings()`: Opens Android's *Notification Access* system screen directly so the user can toggle Busy Bees ON in one tap.
  - `consumePendingSmsTransactions()`: Drains any transactions detected while the app was closed/backgrounded and forwards them into the React queue on launch/resume.

### C. iOS & Cross-Platform Support (App Store Compliant)
- **URL Scheme / Query Trigger**:
  - Supports deep links / URL parameters (`?smsText=...` or `?detectedType=expense&detectedAmount=500`) so iOS users can set up a 1-time **iOS Shortcuts Automation** (*"When I receive a message containing 'debited' or 'credited' → Open Busy Bees URL"*), which immediately parses the text locally, strips the URL parameter from history, and queues the Truecaller-style popup.
- **Smart Clipboard / Paste & Test Simulator**:
  - Optional **"Scan Copied SMS"** action and a **"Test SMS Detection"** simulator inside Settings so users can test or paste any SMS on iOS, Android, or Web.

---

## 3. Queued Truecaller-Style Popup UI (`src/components/SmsDetectionPopup.tsx`)
- **Floating Truecaller-Style Summary Card**:
  - Appears automatically whenever one or more detected transactions are in the queue.
  - **Queue Badge & Navigation**: If multiple SMS transactions were detected (e.g., `1 of 3 detected`), displays a queue counter and automatically advances to the next detected transaction as each one is saved, edited, or dismissed.
  - **Privacy Badge**: Displays a subtle reassurance pill: *"Only Debit/Credit & Amount captured • No bank details stored"*.
  - **Editable Type & Quick Category Dropdown**:
    - Shows the detected **Debit (Expense)** or **Credit (Income)** badge (with a 1-tap toggle in case the user wants to flip it) and formatted **Amount**.
    - Includes a **Quick Category Dropdown** right inside the popup card (populated with `EXPENSE_CATEGORIES` or `INCOME_CATEGORIES`, defaulting to `'Other'` or `'Shopping'` / `'Salary'`) so the user can pick a category and save in a single tap.
  - **3 Actions**:
    1. **Save As Is**: Immediately saves the transaction with the selected category and today's date, triggers the bottom fading confirmation toast, and advances to the next queued item (Note: if saving an expense causes a Debit Balance, respects the existing Debit Balance warning rule).
    2. **Edit Details**: Opens `AddTransactionScreen` pre-populated with the detected `type`, `amount`, and selected `category` so the user can add a custom note or change the date before saving.
    3. **Dismiss / Ignore**: Removes the item from the queue without saving.

---

## 4. Settings Integration (`src/components/screens/SettingsScreen.tsx`)
- Adds a **"Smart SMS Detection"** section under Settings:
  - **Auto-Detect from SMS Toggle** (`settings.smsAutoDetectEnabled`).
  - **Prominent Privacy Disclosure** (required for Google Play Store compliance): Clearly states that notification text is scanned 100% offline on-device to detect only Debit/Credit status and Amount, and no bank information ever leaves the device or gets stored.
  - **Android Notification Permission Status**: Shows whether Android Notification Access is granted, with a **"Grant Notification Access"** button that opens the system settings page.
  - **iOS Shortcut / Smart Paste & "Simulate Bank SMS" Test Button**: Lets the user test the Truecaller-style popup immediately with sample Debit/Credit SMS messages or paste a copied SMS.

---

## 5. Files to Create & Modify
1. **Create** `src/services/smsTransactionParser.ts` — Privacy-first regex parser, duplicate-detection guard, and pending queue storage helper.
2. **Create** `src/components/SmsDetectionPopup.tsx` — Truecaller-style floating modal with queue counter, quick category dropdown, **Save As Is**, **Edit**, and **Dismiss** actions.
3. **Create** `android/app/src/main/java/com/busybees/expensetracker/SmsNotificationListenerService.java` — Native Android `NotificationListenerService` that detects bank/UPI SMS notifications in the background, extracts only `{ type, amount }`, queues them, and posts a heads-up prompt.
4. **Modify** `android/app/src/main/AndroidManifest.xml` — Register `SmsNotificationListenerService` with `BIND_NOTIFICATION_LISTENER_SERVICE` and `POST_NOTIFICATIONS` permissions (no `READ_SMS` / `RECEIVE_SMS`).
5. **Modify** `android/app/src/main/java/com/busybees/expensetracker/MainActivity.java` — Add bridge methods to check/request Notification Listener access and drain background-detected transactions into the WebView on app resume.
6. **Modify** `src/types/index.ts` & `src/services/storage.ts` — Add `DetectedSmsTransaction` interface and `smsAutoDetectEnabled` setting.
7. **Modify** `src/components/screens/SettingsScreen.tsx` & `src/App.tsx` — Wire up the Settings controls, native/deep-link listeners, debit-balance warning check on quick-save, and the `SmsDetectionPopup` queue.
