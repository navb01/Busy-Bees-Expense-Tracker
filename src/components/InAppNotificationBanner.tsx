import React, { useEffect, useState } from 'react';
import { Bell, X, ArrowRight } from 'lucide-react';

interface InAppNotificationBannerProps {
  onOpenAddExpense: () => void;
}

export const InAppNotificationBanner: React.FC<InAppNotificationBannerProps> = ({
  onOpenAddExpense,
}) => {
  const [notification, setNotification] = useState<{
    title: string;
    body?: string;
  } | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ title: string; body?: string }>;
      if (customEvent.detail) {
        setNotification({
          title: customEvent.detail.title,
          body: customEvent.detail.body,
        });

        // Auto dismiss after 7 seconds
        const timer = setTimeout(() => {
          setNotification(null);
        }, 7000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('bb-in-app-notification', handler);
    return () => window.removeEventListener('bb-in-app-notification', handler);
  }, []);

  if (!notification) return null;

  return (
    <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-slate-700/60 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-600/30 text-blue-400 rounded-xl shrink-0 mt-0.5">
            <Bell className="w-5 h-5 stroke-[2]" />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-white">{notification.title}</h4>
            {notification.body && (
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {notification.body}
              </p>
            )}
            <button
              onClick={() => {
                setNotification(null);
                onOpenAddExpense();
              }}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition"
            >
              <span>Record an expense now</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          onClick={() => setNotification(null)}
          className="text-slate-400 hover:text-white p-1 rounded-lg"
          aria-label="Close notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
