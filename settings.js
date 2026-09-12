/**
 * SettingsManager — Manages all app preferences with localStorage persistence.
 */

const STORAGE_KEY = 'focus_settings';
const STATE_KEY   = 'focus_state';

const DEFAULTS = {
  // Durations in seconds
  focusDuration:      25 * 60,
  shortBreakDuration:  5 * 60,
  longBreakDuration:  15 * 60,
  sessionsBeforeLong: 4,

  // Behaviour
  autoStart:     false,
  soundEnabled:  true,
  notificationsEnabled: true,
};

class SettingsManager {
  constructor() {
    this._data = this._load();
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    this._data[key] = value;
    this._save();
  }

  setMany(obj) {
    Object.assign(this._data, obj);
    this._save();
  }

  getAll() {
    return { ...this._data };
  }

  // ─── State persistence (timer running state) ────────────────────────────────

  saveState(state) {
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (_) { /* ignore quota errors */ }
  }

  loadState() {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  clearState() {
    try { localStorage.removeItem(STATE_KEY); } catch (_) {}
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      return { ...DEFAULTS, ...saved };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._data));
    } catch (_) { /* ignore quota errors */ }
  }
}

export default SettingsManager;
