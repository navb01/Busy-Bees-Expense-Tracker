import React, { useState } from 'react';
import {
  ChevronRight,
  X,
  Shield,
  Zap,
  Lock,
  BatteryCharging,
  Sparkles,
  Check,
} from 'lucide-react';
import { AppSettings, LogoVariant } from '../../types';
import { BusyBeesLogo } from '../BusyBeesLogo';

interface AboutScreenProps {
  settings?: AppSettings;
  onUpdateSettings?: (updates: Partial<AppSettings>) => void;
  onShowToast?: (message: string) => void;
}

const LOGO_CONCEPTS: Array<{
  id: LogoVariant;
  badge: string;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'swoosh',
    badge: 'Concept 1 · Primary',
    title: 'Rupee Swoop',
    subtitle: 'Golden bee weaving through the ₹ loop with flight trail',
  },
  {
    id: 'monogram',
    badge: 'Concept 2 · Preserved',
    title: 'Honeycomb ₹ Crest',
    subtitle: 'Geometric negative-space bee & ₹ hexagon monogram',
  },
  {
    id: 'mascot',
    badge: 'Concept 3 · Preserved',
    title: '3D ₹ Coin Mascot',
    subtitle: 'Friendly golden bee orbiting a gleaming ₹ gold coin',
  },
];

export const AboutScreen: React.FC<AboutScreenProps> = ({
  settings,
  onUpdateSettings,
  onShowToast,
}) => {
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [previewAnimated, setPreviewAnimated] = useState(true);
  const activeVariant: LogoVariant = settings?.logoVariant || 'swoosh';

  const handleSelectLogoVariant = (variant: LogoVariant, title: string) => {
    onUpdateSettings?.({ logoVariant: variant });
    onShowToast?.(`Brand emblem set to ${title}`);
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 pt-6 pb-20 sm:pb-8 max-w-lg mx-auto w-full">
      <div className="space-y-6">
        {/* Top Header with Animated Rupee-Bee Logo Emblem */}
        <div className="flex items-center gap-4">
          <BusyBeesLogo variant={activeVariant} size={60} animated={true} />
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">Version 1.0.0</span>
            </div>
            <h2 className="text-xl font-brand text-slate-900 dark:text-slate-100 leading-tight mt-0.5 tracking-wide">
              Busy Bees Expense Tracker
            </h2>
          </div>
        </div>

        {/* The Authentic Concept Behind Busy Bees */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-amber-50/40 dark:from-slate-800 dark:via-slate-800/90 dark:to-slate-800 border border-blue-100/70 dark:border-slate-700">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
            <span>Not lazy — just busy.</span>
          </h3>
          <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
            Most people don't fail at expense tracking because they're lazy; they stop because conventional apps demand too much time, logins, and mental energy.
          </p>
          <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-relaxed font-normal mt-2">
            You are a <strong>busy bee</strong> with a full schedule. We designed this tracker to be effortlessly fast: record an expense in 3 seconds, keep all records private on your device, and get right back to your life.
          </p>
        </div>

        {/* Brand Identity & Logo Concepts Gallery (Option 1 Primary + Options 2 & 3 Preserved) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pl-1">
            <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Brand Identity & Logo Concepts
            </h3>
            <button
              type="button"
              onClick={() => setPreviewAnimated((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-medium text-[#2357A4] dark:text-blue-400 hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{previewAnimated ? 'Motion: On' : 'Motion: Static'}</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {LOGO_CONCEPTS.map((concept) => {
              const isSelected = activeVariant === concept.id;
              return (
                <button
                  key={concept.id}
                  type="button"
                  onClick={() => handleSelectLogoVariant(concept.id, concept.title)}
                  className={`p-3 rounded-2xl border text-left flex flex-col items-center transition active:scale-[0.98] ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-[#2357A4] dark:border-blue-400 shadow-xs'
                      : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="my-1">
                    <BusyBeesLogo
                      variant={concept.id}
                      size={56}
                      animated={previewAnimated}
                      title={concept.title}
                    />
                  </div>
                  <div className="w-full text-center mt-2">
                    <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                      {concept.badge}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 flex items-center justify-center gap-1">
                      <span className="truncate">{concept.title}</span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#2357A4] dark:text-blue-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug line-clamp-2">
                      {concept.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 pl-1">
            Concept 1 (Rupee Swoop) is active by default; Concepts 2 &amp; 3 are preserved here so you can preview or switch emblems anytime.
          </p>
        </div>

        {/* The 3 Pillars of Busy Bees */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">
            Built For Busy Lives
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2357A4] dark:text-blue-400 shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Zero Friction Logging</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  No bank passwords, no sync delays, no ads, and no spreadsheets. Two taps and you're done.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Featherweight on Battery & CPU</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Engineered with near-zero resource consumption. No continuous background data draining your battery.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-xs">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Your Money. Strictly Your Device.</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Saved in local storage on your phone. Safe from data leaks, breaches, and cloud snooping.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="pt-2 divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(true)}
            className="w-full py-4 flex items-center justify-between text-left text-[15px] font-medium text-slate-800 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 transition"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Privacy policy (Standard Legal Clauses)</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>

          {/* Busy Bees Support link — commented out for later implementation
          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="w-full py-4 flex items-center justify-between text-left text-[15px] font-medium text-slate-800 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 transition"
          >
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Busy Bees Expense Tracker Support</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          </button>
          */}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 text-center">
        <p className="text-xs text-slate-400 dark:text-slate-500 font-normal">
          © 2026 Busy Bees Expense Tracker · A little clarity, every day.
        </p>
      </div>

      {/* STANDARD INDUSTRY PRIVACY POLICY MODAL */}
      {privacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-700 max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight">Privacy Policy</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-400">Effective Date: October 25, 2026 · Standard Legal Clauses</p>
                </div>
              </div>
              <button
                onClick={() => setPrivacyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pr-1">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">1. Architectural Model & Zero-Knowledge Architecture</h4>
                <p>
                  Busy Bees Expense Tracker operates on a strictly client-side, zero-knowledge architectural model. Unlike conventional fintech and cloud-backed financial software, Busy Bees does not host central user accounts, remote databases, or cloud synchronization backends. All computation, storage, and rendering take place locally on the user's host device.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">2. Data Collection and Local Storage Retention</h4>
                <p>
                  Any records entered into the application—including transaction categories, amounts, dates, descriptive notes, currency selections, and personal profile attributes (e.g., name, age, city)—are written exclusively to the device's persistent local storage partition (W3C Web Storage / IndexedDB). We do not transmit, intercept, inspect, analyze, or aggregate this data on any remote server.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">3. Non-Collection of Financial Credentials &amp; Banking APIs</h4>
                <p>
                  Busy Bees Expense Tracker does not request, store, or process payment cards, banking account credentials, routing numbers, Plaid/Yodlee credentials, or authentication tokens. All figures are entered manually by the user or confirmed by the user from local on-device transaction detection prompts.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">4. Smart SMS &amp; Notification Transaction Detection Disclaimer</h4>
                <p>
                  When the optional <strong>Auto-Detect from SMS</strong> feature and Android Notification Access (<code>BIND_NOTIFICATION_LISTENER_SERVICE</code>) or manual SMS scanning are enabled by the user:
                </p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><strong>100% On-Device Ephemeral Parsing:</strong> Incoming messaging notifications are inspected strictly in volatile memory on your device using local pattern matching to identify transaction direction keywords (such as <em>debit, credit, withdrawn, deposited, spent, received</em>) and the numeric transaction amount.</li>
                  <li><strong>Strict Zero-Bank-Data Guarantee:</strong> The application captures <strong>only</strong> the Debit/Credit status and the numeric Amount. Bank names, account numbers, card digits, UPI IDs, reference numbers, merchant names, available account balances, OTPs, and the raw SMS text itself are <strong>strictly ignored, immediately discarded from memory, and never stored, logged, or backed up</strong>.</li>
                  <li><strong>No External Transmission:</strong> Notification and SMS contents are never transmitted to any external server, cloud service, or third party under any circumstances.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">5. Device Permissions &amp; Push Notification Handling</h4>
                <p>
                  <strong>Notifications:</strong> When you authorize notifications, the permission is utilized solely to schedule local inactivity reminders (such as the 24-hour inactivity check) and local prompts for detected transactions generated directly by the device. No push subscription credentials, hardware tokens, or push identifiers are shared with third-party advertising or telemetric networks.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">6. Absence of Third-Party Advertising &amp; Telemetry Trackers</h4>
                <p>
                  Busy Bees Expense Tracker does not incorporate third-party advertising SDKs, cross-site trackers, affiliate trackers, or tracking pixels (e.g., Google AdMob, Meta Pixel, or behavioral analytics beacons). We do not monetize user data in any capacity.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">7. User Rights, Data Portability &amp; Complete Erasure (GDPR &amp; CCPA)</h4>
                <p>
                  In accordance with the General Data Protection Regulation (GDPR Articles 15–20) and the California Consumer Privacy Act (CCPA):
                </p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><strong>Right to Access &amp; Portability:</strong> Users retain full ownership of their financial records and can generate complete CSV and PDF exports at any time without fees or artificial restrictions.</li>
                  <li><strong>Right to Erasure (Forget Me):</strong> Users can purge individual records or purge the entire local storage through their device settings. Because data resides solely on the client hardware, erasure is instantaneous, complete, and irreversible.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">8. Data Security and Passcode Protection</h4>
                <p>
                  Users may activate the built-in <strong>App Lock</strong> feature to protect their view from unauthorized access on shared devices. Operating system sandboxing isolates application local storage from unauthorized external origins.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">9. Children's Privacy (COPPA)</h4>
                <p>
                  The application is a general-purpose utility and does not knowingly solicit or collect information from children under the age of 13.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[13px] mb-1">10. Policy Revisions &amp; Legal Inquiries</h4>
                <p>
                  Any updates to this policy will be documented with updated version tags. For inquiries regarding this Privacy Policy or data governance, contact the designated maintainer at <strong>support@busybeesapp.dev</strong>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setPrivacyModalOpen(false)}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#2357A4] text-white text-xs font-semibold hover:bg-[#1D4A8C] transition"
              >
                I Acknowledge & Agree
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONTACT SUPPORT: BUSY BEES EXPENSE TRACKER MODAL — commented out for later implementation
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-2xl border border-slate-100 dark:border-slate-700 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-[#2357A4] dark:border-blue-400 text-[#2357A4] dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  BB
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Busy Bees Expense Tracker</h3>
                  <p className="text-[11px] text-slate-400">Support Desk</p>
                </div>
              </div>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {supportSent ? (
              <div className="py-8 text-center animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-base">Message Sent!</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Thank you for reaching out to Busy Bees Expense Tracker Support. We appreciate your feedback and will respond shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendSupport} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={supportName}
                    onChange={(e) => setSupportName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    Your Email (For reply)
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    Topic
                  </label>
                  <select
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="General Feedback">General Feedback</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Data Export Help">Data Export Help</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 dark:text-slate-400 font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Tell us what you love or how we can improve..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <a
                    href={`mailto:support@busybeesapp.dev?subject=${encodeURIComponent(
                      `[Busy Bees Expense Tracker] ${supportCategory}`
                    )}&body=${encodeURIComponent(supportMessage)}`}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 text-center transition flex items-center justify-center gap-1.5"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email App</span>
                  </a>

                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#2357A4] text-white font-medium hover:bg-[#1D4A8C] transition flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit</span>
                  </button>
                </div>

                <p className="text-[11px] text-slate-400 text-center pt-1">
                  Direct support: <span className="font-mono text-slate-600 dark:text-slate-300">support@busybeesapp.dev</span>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
      */}
    </div>
  );
};
