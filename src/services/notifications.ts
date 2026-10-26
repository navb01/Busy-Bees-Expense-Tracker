import { storage } from './storage';

export interface NotificationStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
}

class NotificationService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermission(): NotificationPermission | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  async requestPermission(): Promise<NotificationPermission | 'unsupported'> {
    if (!this.isSupported()) return 'unsupported';
    try {
      const perm = await Notification.requestPermission();
      storage.saveSettings({ notificationsEnabled: perm === 'granted' });
      return perm;
    } catch (e) {
      console.warn('Failed to request notification permission', e);
      return 'denied';
    }
  }

  playSubtleChime() {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // AudioContext may be restricted by autoplay policy until user gesture
    }
  }

  sendNotification(title: string, options?: NotificationOptions) {
    this.playSubtleChime();

    if (this.isSupported() && Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          icon: '/icon.svg',
          badge: '/icon.svg',
          body: options?.body || '',
          ...options,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
        return true;
      } catch (err) {
        console.warn('Native notification failed, falling back to in-app event', err);
      }
    }

    // Dispatch custom DOM event for in-app alert banner
    window.dispatchEvent(
      new CustomEvent('bb-in-app-notification', {
        detail: {
          title,
          body: options?.body,
          timestamp: Date.now(),
        },
      })
    );
    return false;
  }

  checkAndTrigger24hReminder(): boolean {
    const settings = storage.getSettings();
    if (!settings.inactivityReminder) return false;

    const { isInactive, hoursInactive } = storage.check24hInactivity();
    if (isInactive) {
      this.sendNotification('Busy Bees Reminder 🐝', {
        body: `Too busy to track today? Take 3 seconds to log your entries and keep your finances in order.`,
        tag: 'inactivity-reminder-24h',
      });
      storage.recordActivity();
      return true;
    }
    return false;
  }

  triggerTestNotification() {
    return this.sendNotification('Busy Bees 24h Reminder 🐝', {
      body: "Too busy today? Take 3 seconds to log your entries and get back to your day.",
      tag: 'test-reminder',
    });
  }

  // Simulate inactivity for testing purposes
  simulate25HoursInactivity() {
    const twentyFiveHoursAgo = Date.now() - 25 * 60 * 60 * 1000;
    localStorage.setItem('bb_last_active_time', String(twentyFiveHoursAgo));
    return this.checkAndTrigger24hReminder();
  }
}

export const notificationService = new NotificationService();
