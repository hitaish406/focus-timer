/**
 * NotificationManager — Wraps the Browser Notifications API.
 *
 * - Requests permission only once, only when the user enables notifications.
 * - Never repeatedly nags the user.
 * - Silently degrades when the API is unavailable or permission is denied.
 */

class NotificationManager {
  constructor() {
    this._enabled = true;
    this._supported = 'Notification' in window;
  }

  isSupported() {
    return this._supported;
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  isEnabled() {
    return this._enabled;
  }

  /**
   * Request notification permission.
   * Should be called when the user explicitly enables notifications in Settings.
   * Returns true if permission was granted, false otherwise.
   */
  async requestPermission() {
    if (!this._supported) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;
    try {
      const result = await Notification.requestPermission();
      return result === 'granted';
    } catch (_) {
      return false;
    }
  }

  /**
   * Show a notification with the given title and body.
   * Silently does nothing if not enabled / permission denied.
   */
  show(title, body = '') {
    if (!this._enabled || !this._supported) return;
    if (Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        silent: true, // our audio handles the sound
        tag: 'focus-timer', // replaces previous notification
      });
      // Auto-close after 8 seconds
      setTimeout(() => n.close(), 8000);
    } catch (_) {
      // Ignore — e.g. service worker not ready yet
    }
  }
}

export default NotificationManager;
