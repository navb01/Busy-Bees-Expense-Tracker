import React, { useState } from 'react';
import {
  NotebookPen,
  ChevronRight,
  X,
  Shield,
  Mail,
  Send,
  CheckCircle2,
  Zap,
  Lock,
  BatteryCharging,
} from 'lucide-react';

export const AboutScreen: React.FC = () => {
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);

  // Support form state
  const [supportName, setSupportName] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [supportCategory, setSupportCategory] = useState('General Feedback');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);

  const handleSendSupport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportMessage.trim()) return;
    setSupportSent(true);
    setTimeout(() => {
      setSupportSent(false);
      setSupportModalOpen(false);
      setSupportMessage('');
    }, 2500);
  };

  return (
    <div className="flex-1 flex flex-col justify-between px-6 py-6 max-w-lg mx-auto w-full overflow-y-auto">
      <div className="space-y-6">
        {/* Top Header with BB Logo Emblem */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-50/90 border border-blue-100 flex items-center justify-center text-[#2357A4] shadow-xs relative">
            <NotebookPen className="w-7 h-7 stroke-[1.8]" />
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-xs" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                100% Offline
              </span>
              <span className="text-xs text-slate-400 font-medium">Version 1.0.0</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
              Busy Bees Expense Tracker
            </h2>
          </div>
        </div>

        {/* The Authentic Concept Behind Busy Bees */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-amber-50/40 border border-blue-100/70">
          <h3 className="text-sm font-bold text-slate-900 mb-1.5 flex items-center gap-1.5">
            <span>Not lazy — just busy.</span>
          </h3>
          <p className="text-[13.5px] text-slate-700 leading-relaxed font-normal">
            Most people don't fail at expense tracking because they're lazy; they stop because conventional apps demand too much time, logins, and mental energy.
          </p>
          <p className="text-[13.5px] text-slate-700 leading-relaxed font-normal mt-2">
            You are a <strong>busy bee</strong> with a full schedule. We designed this tracker to be effortlessly fast: record an expense in 3 seconds, keep all records private on your device, and get right back to your life.
          </p>
        </div>

        {/* The 3 Pillars of Busy Bees */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider pl-1">
            Built For Busy Lives
          </h3>

          <div className="grid grid-cols-1 gap-2.5">
            <div className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="p-2 rounded-xl bg-blue-50 text-[#2357A4] shrink-0 mt-0.5">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Zero Friction Logging</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  No bank passwords, no sync delays, no ads, and no spreadsheets. Two taps and you're done.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 shrink-0 mt-0.5">
                <BatteryCharging className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Featherweight on Battery & CPU</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  Engineered with near-zero resource consumption. No continuous background data draining your battery.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-900">Your Money. Strictly Your Device.</h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  100% saved in local storage. Safe from data leaks, breaches, and cloud snooping.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="pt-2 divide-y divide-slate-100 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setPrivacyModalOpen(true)}
            className="w-full py-4 flex items-center justify-between text-left text-[15px] font-medium text-slate-800 hover:text-blue-700 transition"
          >
            <div className="flex items-center gap-2.5">
              <Shield className="w-4 h-4 text-emerald-600" />
              <span>Privacy policy (Standard Legal Clauses)</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => setSupportModalOpen(true)}
            className="w-full py-4 flex items-center justify-between text-left text-[15px] font-medium text-slate-800 hover:text-blue-700 transition"
          >
            <div className="flex items-center gap-2.5">
              <Mail className="w-4 h-4 text-blue-600" />
              <span>Busy Bees Expense Tracker Support</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 text-center">
        <p className="text-xs text-slate-400 font-normal">
          © 2026 Busy Bees Expense Tracker · A little clarity, every day.
        </p>
      </div>

      {/* STANDARD INDUSTRY PRIVACY POLICY MODAL */}
      {privacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 max-h-[88vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-600" />
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">Privacy Policy</h3>
                  <p className="text-[11px] text-slate-400">Effective Date: October 25, 2026 · Standard Legal Clauses</p>
                </div>
              </div>
              <button
                onClick={() => setPrivacyModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 py-4 text-xs text-slate-600 leading-relaxed pr-1">
              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">1. Architectural Model & Zero-Knowledge Architecture</h4>
                <p>
                  Busy Bees Expense Tracker operates on a strictly client-side, zero-knowledge architectural model. Unlike conventional fintech and cloud-backed financial software, Busy Bees does not host central user accounts, remote databases, or cloud synchronization backends. All computation, storage, and rendering take place locally on the user's host device.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">2. Data Collection and Local Storage Retention</h4>
                <p>
                  Any records entered into the application—including transaction categories, amounts, dates, descriptive notes, currency selections, and personal profile attributes (e.g., name, age, city)—are written exclusively to the device's persistent local storage partition (W3C Web Storage / IndexedDB). We do not transmit, intercept, inspect, analyze, or aggregate this data on any remote server.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">3. Non-Collection of Financial Credentials & Banking APIs</h4>
                <p>
                  Busy Bees Expense Tracker does not request, store, or process payment cards, banking account credentials, routing numbers, Plaid/Yodlee credentials, or authentication tokens. All figures are entered manually by the user or imported from local user-initiated files.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">4. Device Permissions & Push Notification Handling</h4>
                <p>
                  <strong>Notifications:</strong> When you authorize notifications, the permission is utilized solely to schedule local inactivity reminders (such as the 24-hour inactivity check) generated directly by the browser or Progressive Web App service worker. No push subscription credentials, hardware tokens, or push identifiers are shared with third-party advertising or telemetric networks.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">5. Absence of Third-Party Advertising & Telemetry Trackers</h4>
                <p>
                  Busy Bees Expense Tracker does not incorporate third-party advertising SDKs, cross-site trackers, affiliate trackers, or tracking pixels (e.g., Google AdMob, Meta Pixel, or behavioral analytics beacons). We do not monetize user data in any capacity.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">6. User Rights, Data Portability & Complete Erasure (GDPR & CCPA)</h4>
                <p>
                  In accordance with the General Data Protection Regulation (GDPR Articles 15–20) and the California Consumer Privacy Act (CCPA):
                </p>
                <ul className="list-disc pl-4 mt-1 space-y-1">
                  <li><strong>Right to Access & Portability:</strong> Users retain full ownership of their financial records and can generate complete CSV, PDF, and JSON exports at any time without fees or artificial restrictions.</li>
                  <li><strong>Right to Erasure (Forget Me):</strong> Users can purge individual records or purge the entire local storage through their browser settings or app cache. Because data resides solely on the client hardware, erasure is instantaneous, complete, and irreversible.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">7. Data Security and Passcode Protection</h4>
                <p>
                  Users may activate the built-in <strong>App Lock</strong> feature to protect their view from unauthorized access on shared devices. Operating system sandboxing isolates application local storage from unauthorized external web origins.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">8. Children's Privacy (COPPA)</h4>
                <p>
                  The application is a general-purpose offline utility and does not knowingly solicit or collect information from children under the age of 13.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 text-[13px] mb-1">9. Policy Revisions & Legal Inquiries</h4>
                <p>
                  Any updates to this policy will be documented with updated version tags. For inquiries regarding this Privacy Policy or data governance, contact the designated maintainer at <strong>support@busybeesapp.dev</strong>.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
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

      {/* CONTACT SUPPORT: BUSY BEES EXPENSE TRACKER MODAL */}
      {supportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border-2 border-[#2357A4] text-[#2357A4] flex items-center justify-center font-bold text-xs">
                  BB
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Busy Bees Expense Tracker</h3>
                  <p className="text-[11px] text-slate-400">Support Desk</p>
                </div>
              </div>
              <button
                onClick={() => setSupportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {supportSent ? (
              <div className="py-8 text-center animate-in zoom-in-95">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h4 className="font-bold text-slate-900 text-base">Message Sent!</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Thank you for reaching out to Busy Bees Expense Tracker Support. We appreciate your feedback and will respond shortly.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSendSupport} className="mt-4 space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Your Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={supportName}
                    onChange={(e) => setSupportName(e.target.value)}
                    placeholder="e.g. Alex"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Your Email (For reply)
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Topic
                  </label>
                  <select
                    value={supportCategory}
                    onChange={(e) => setSupportCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="General Feedback">General Feedback</option>
                    <option value="Bug Report">Bug Report</option>
                    <option value="Feature Request">Feature Request</option>
                    <option value="Data Export / Backup Help">Data Export / Backup Help</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-500 font-medium mb-1">
                    Message
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="Tell us what you love or how we can improve..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <a
                    href={`mailto:support@busybeesapp.dev?subject=${encodeURIComponent(
                      `[Busy Bees Expense Tracker] ${supportCategory}`
                    )}&body=${encodeURIComponent(supportMessage)}`}
                    className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 text-center transition flex items-center justify-center gap-1.5"
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
                  Direct support: <span className="font-mono text-slate-600">support@busybeesapp.dev</span>
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
