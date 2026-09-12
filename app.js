/**
 * app.js — FOCUS Pomodoro Timer
 *
 * Orchestrates: TimerEngine, SettingsManager, AudioManager, NotificationManager.
 * Handles: Pomodoro cycle, UI rendering, settings panel, keyboard shortcuts,
 *          localStorage state persistence, and PWA service worker registration.
 */

import TimerEngine      from './timer.js';
import SettingsManager  from './settings.js';
import AudioManager     from './audio.js';
import NotificationManager from './notifications.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const MODES = {
  FOCUS:       'FOCUS',
  SHORT_BREAK: 'SHORT BREAK',
  LONG_BREAK:  'LONG BREAK',
};

// ─── App State ────────────────────────────────────────────────────────────────

const settings     = new SettingsManager();
const audio        = new AudioManager();
const notifs       = new NotificationManager();

let currentMode    = MODES.FOCUS;
let sessionCount   = 1;   // 1-based, resets after long break
let timerRunning   = false;
let customMode     = false; // user has typed a custom duration

audio.setEnabled(settings.get('soundEnabled'));
notifs.setEnabled(settings.get('notificationsEnabled'));

// ─── Timer Engine ─────────────────────────────────────────────────────────────

const engine = new TimerEngine(
  (remainingMs) => {
    renderTimer(remainingMs);
    // Persist running state every tick
    if (engine.isRunning()) {
      settings.saveState({
        endTimestamp: engine.getEndTimestamp(),
        mode: currentMode,
        sessionCount,
      });
      updateDocTitle(remainingMs);
    }
  },
  () => {
    // Timer completed
    onSessionComplete();
  }
);

// ─── DOM Refs ─────────────────────────────────────────────────────────────────

const elMode        = document.getElementById('mode-label');
const elTimer       = document.getElementById('timer-display');
const elSession     = document.getElementById('session-label');
const elStart       = document.getElementById('btn-start');
const elReset       = document.getElementById('btn-reset');
const elSkip        = document.getElementById('btn-skip');
const elSettingsBtn = document.getElementById('btn-settings');
const elSettingsPanel = document.getElementById('settings-panel');
const elCloseSettings = document.getElementById('btn-close-settings');
const elModeButtons = document.querySelectorAll('.mode-btn');
const elPresets     = document.querySelectorAll('.preset-btn');
const elCustomBtn   = document.getElementById('btn-custom');
const elCustomForm  = document.getElementById('custom-form');
const elCustomHours = document.getElementById('custom-hours');
const elCustomMins  = document.getElementById('custom-mins');
const elCustomSecs  = document.getElementById('custom-secs');
const elCustomApply = document.getElementById('btn-custom-apply');
const elCustomCancel= document.getElementById('btn-custom-cancel');

// Settings inputs
const elSetFocusMins     = document.getElementById('set-focus-mins');
const elSetShortMins     = document.getElementById('set-short-mins');
const elSetLongMins      = document.getElementById('set-long-mins');
const elSetSessions      = document.getElementById('set-sessions');
const elSetAutoStart     = document.getElementById('set-autostart');
const elSetSound         = document.getElementById('set-sound');
const elSetNotifications = document.getElementById('set-notifications');
const elSaveSettings     = document.getElementById('btn-save-settings');
const elInstallBanner    = document.getElementById('install-banner');
const elInstallBtn       = document.getElementById('btn-install');
const elInstallDismiss   = document.getElementById('btn-install-dismiss');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function msToHMS(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return { h, m, s };
}

function formatHMS(h, m, s) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function durationFor(mode) {
  switch (mode) {
    case MODES.FOCUS:       return settings.get('focusDuration') * 1000;
    case MODES.SHORT_BREAK: return settings.get('shortBreakDuration') * 1000;
    case MODES.LONG_BREAK:  return settings.get('longBreakDuration') * 1000;
    default:                return settings.get('focusDuration') * 1000;
  }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

function renderTimer(remainingMs) {
  const { h, m, s } = msToHMS(remainingMs);
  elTimer.textContent = formatHMS(h, m, s);
}

function renderMode() {
  elMode.textContent = currentMode;
}

function renderSession() {
  const total = settings.get('sessionsBeforeLong');
  if (currentMode === MODES.FOCUS) {
    elSession.textContent = `SESSION ${sessionCount} / ${total}`;
  } else {
    elSession.textContent = currentMode === MODES.LONG_BREAK ? 'LONG BREAK' : 'SHORT BREAK';
  }
}

function renderStartBtn() {
  elStart.textContent = timerRunning ? 'PAUSE' : 'START';
  elStart.setAttribute('aria-label', timerRunning ? 'Pause timer' : 'Start timer');
}

function renderModeButtons() {
  elModeButtons.forEach((btn) => {
    const isActive = btn.dataset.mode === currentMode;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function updateDocTitle(remainingMs) {
  const { h, m, s } = msToHMS(remainingMs);
  document.title = `${formatHMS(h, m, s)} — FOCUS`;
}

// ─── Pomodoro Cycle ───────────────────────────────────────────────────────────

function onSessionComplete() {
  timerRunning = false;
  renderStartBtn();
  audio.play();

  const total = settings.get('sessionsBeforeLong');

  if (currentMode === MODES.FOCUS) {
    notifs.show('FOCUS COMPLETE', 'Time for a break!');
    if (sessionCount >= total) {
      sessionCount = 1;
      switchMode(MODES.LONG_BREAK);
    } else {
      sessionCount++;
      switchMode(MODES.SHORT_BREAK);
    }
  } else {
    notifs.show('BREAK COMPLETE', 'Time to focus!');
    switchMode(MODES.FOCUS);
  }

  settings.clearState();
  document.title = 'FOCUS';

  if (settings.get('autoStart')) {
    startTimer();
  }
}

function switchMode(mode) {
  currentMode = mode;
  customMode = false;
  engine.load(durationFor(mode));
  renderMode();
  renderSession();
  renderModeButtons();
  renderTimer(durationFor(mode));
}

// ─── Controls ─────────────────────────────────────────────────────────────────

function startTimer() {
  if (engine.isCompleted()) return;
  timerRunning = true;
  engine.start();
  renderStartBtn();
}

function pauseTimer() {
  timerRunning = false;
  engine.pause();
  renderStartBtn();
  settings.clearState();
  document.title = 'FOCUS';
}

function resetTimer() {
  timerRunning = false;
  customMode = false;
  engine.reset(durationFor(currentMode));
  renderStartBtn();
  renderTimer(durationFor(currentMode));
  settings.clearState();
  document.title = 'FOCUS';
}

function skipTimer() {
  timerRunning = false;
  settings.clearState();
  document.title = 'FOCUS';
  onSessionComplete();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────

elStart.addEventListener('click', () => {
  if (timerRunning) pauseTimer();
  else startTimer();
});

elReset.addEventListener('click', resetTimer);
elSkip.addEventListener('click', skipTimer);

// Mode selector buttons
elModeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.mode;
    if (mode === currentMode && !engine.isRunning()) return;
    timerRunning = false;
    currentMode = mode;
    customMode = false;
    settings.clearState();
    engine.load(durationFor(mode));
    renderMode();
    renderSession();
    renderModeButtons();
    renderTimer(durationFor(mode));
    renderStartBtn();
    document.title = 'FOCUS';
  });
});

// Quick preset buttons
elPresets.forEach((btn) => {
  btn.addEventListener('click', () => {
    const minutes = parseInt(btn.dataset.minutes, 10);
    const ms = minutes * 60 * 1000;
    timerRunning = false;
    customMode = false;
    // Keep in focus mode
    if (currentMode !== MODES.FOCUS) {
      currentMode = MODES.FOCUS;
      renderMode();
      renderModeButtons();
    }
    engine.reset(ms);
    renderTimer(ms);
    renderStartBtn();
    settings.clearState();
    document.title = 'FOCUS';
  });
});

// Custom duration
elCustomBtn.addEventListener('click', () => {
  elCustomForm.classList.toggle('hidden');
  if (!elCustomForm.classList.contains('hidden')) {
    elCustomHours.focus();
  }
});

elCustomCancel.addEventListener('click', () => {
  elCustomForm.classList.add('hidden');
});

elCustomApply.addEventListener('click', applyCustomDuration);

[elCustomHours, elCustomMins, elCustomSecs].forEach((el) => {
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyCustomDuration();
    if (e.key === 'Escape') elCustomForm.classList.add('hidden');
  });
});

function applyCustomDuration() {
  const h = parseInt(elCustomHours.value, 10) || 0;
  const m = parseInt(elCustomMins.value, 10)  || 0;
  const s = parseInt(elCustomSecs.value, 10)  || 0;
  const totalSec = h * 3600 + m * 60 + s;

  if (totalSec <= 0 || totalSec > 24 * 3600) {
    showError('Please enter a valid duration (up to 24 hours).');
    return;
  }

  timerRunning = false;
  customMode = true;
  const ms = totalSec * 1000;
  engine.reset(ms);
  renderTimer(ms);
  renderStartBtn();
  elCustomForm.classList.add('hidden');
  settings.clearState();
  document.title = 'FOCUS';
}

// Settings panel
elSettingsBtn.addEventListener('click', () => {
  populateSettings();
  elSettingsPanel.classList.remove('hidden');
  elSettingsPanel.setAttribute('aria-hidden', 'false');
  elCloseSettings.focus();
});

elCloseSettings.addEventListener('click', closeSettings);

elSettingsPanel.addEventListener('click', (e) => {
  if (e.target === elSettingsPanel) closeSettings();
});

function closeSettings() {
  elSettingsPanel.classList.add('hidden');
  elSettingsPanel.setAttribute('aria-hidden', 'true');
  elSettingsBtn.focus();
}

function populateSettings() {
  elSetFocusMins.value     = Math.round(settings.get('focusDuration') / 60);
  elSetShortMins.value     = Math.round(settings.get('shortBreakDuration') / 60);
  elSetLongMins.value      = Math.round(settings.get('longBreakDuration') / 60);
  elSetSessions.value      = settings.get('sessionsBeforeLong');
  elSetAutoStart.checked   = settings.get('autoStart');
  elSetSound.checked       = settings.get('soundEnabled');
  elSetNotifications.checked = settings.get('notificationsEnabled');
}

elSaveSettings.addEventListener('click', async () => {
  const focusMins  = parseInt(elSetFocusMins.value, 10);
  const shortMins  = parseInt(elSetShortMins.value, 10);
  const longMins   = parseInt(elSetLongMins.value, 10);
  const sessions   = parseInt(elSetSessions.value, 10);

  if (!focusMins || focusMins < 1 || focusMins > 1440 ||
      !shortMins || shortMins < 1 || shortMins > 1440 ||
      !longMins  || longMins  < 1 || longMins  > 1440 ||
      !sessions  || sessions  < 1 || sessions  > 10) {
    showError('Please enter valid values.');
    return;
  }

  const notifEnabled = elSetNotifications.checked;
  if (notifEnabled && notifs.isSupported() && Notification.permission === 'default') {
    await notifs.requestPermission();
  }

  settings.setMany({
    focusDuration:        focusMins * 60,
    shortBreakDuration:   shortMins * 60,
    longBreakDuration:    longMins  * 60,
    sessionsBeforeLong:   sessions,
    autoStart:            elSetAutoStart.checked,
    soundEnabled:         elSetSound.checked,
    notificationsEnabled: notifEnabled,
  });

  audio.setEnabled(settings.get('soundEnabled'));
  notifs.setEnabled(settings.get('notificationsEnabled'));

  // Reload current mode timer if not running
  if (!engine.isRunning() && !customMode) {
    engine.load(durationFor(currentMode));
    renderTimer(durationFor(currentMode));
  }
  renderSession();
  closeSettings();
});

// ─── Keyboard Shortcuts ───────────────────────────────────────────────────────

document.addEventListener('keydown', (e) => {
  // Don't fire shortcuts when typing in an input/textarea
  const tag = e.target.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  switch (e.key) {
    case ' ':
      e.preventDefault();
      if (timerRunning) pauseTimer();
      else startTimer();
      break;
    case 'r': case 'R':
      e.preventDefault();
      resetTimer();
      break;
    case 's': case 'S':
      e.preventDefault();
      skipTimer();
      break;
    case '1':
      e.preventDefault();
      if (currentMode !== MODES.FOCUS) {
        timerRunning = false;
        currentMode = MODES.FOCUS;
        customMode = false;
        engine.load(durationFor(currentMode));
        renderMode(); renderSession(); renderModeButtons();
        renderTimer(durationFor(currentMode)); renderStartBtn();
        settings.clearState(); document.title = 'FOCUS';
      }
      break;
    case '2':
      e.preventDefault();
      if (currentMode !== MODES.SHORT_BREAK) {
        timerRunning = false;
        currentMode = MODES.SHORT_BREAK;
        customMode = false;
        engine.load(durationFor(currentMode));
        renderMode(); renderSession(); renderModeButtons();
        renderTimer(durationFor(currentMode)); renderStartBtn();
        settings.clearState(); document.title = 'FOCUS';
      }
      break;
    case '3':
      e.preventDefault();
      if (currentMode !== MODES.LONG_BREAK) {
        timerRunning = false;
        currentMode = MODES.LONG_BREAK;
        customMode = false;
        engine.load(durationFor(currentMode));
        renderMode(); renderSession(); renderModeButtons();
        renderTimer(durationFor(currentMode)); renderStartBtn();
        settings.clearState(); document.title = 'FOCUS';
      }
      break;
  }
});

// ─── Error display ────────────────────────────────────────────────────────────

function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────

let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  elInstallBanner.classList.remove('hidden');
});

elInstallBtn.addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  elInstallBanner.classList.add('hidden');
});

elInstallDismiss.addEventListener('click', () => {
  elInstallBanner.classList.add('hidden');
});

window.addEventListener('appinstalled', () => {
  elInstallBanner.classList.add('hidden');
  deferredInstallPrompt = null;
});

// ─── Service Worker Registration ─────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // SW registration failed — app still works without offline support
    });
  });
}

// ─── Keyboard shortcut helper (settings panel close on Escape) ───────────────

elSettingsPanel.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSettings();
});

// ─── Restore state on load ────────────────────────────────────────────────────

function init() {
  // Restore persisted state if available
  const state = settings.loadState();
  if (state) {
    currentMode  = state.mode  || MODES.FOCUS;
    sessionCount = state.sessionCount || 1;

    if (state.endTimestamp) {
      engine.load(0); // reset engine
      const restored = engine.restoreRunning(state.endTimestamp);
      if (restored) {
        timerRunning = true;
        renderStartBtn();
      } else {
        // Expired while away — trigger completion logic silently
        engine.load(durationFor(currentMode));
        renderTimer(durationFor(currentMode));
        timerRunning = false;
        settings.clearState();
      }
    } else {
      engine.load(durationFor(currentMode));
      renderTimer(durationFor(currentMode));
    }
  } else {
    engine.load(durationFor(currentMode));
    renderTimer(durationFor(currentMode));
  }

  renderMode();
  renderSession();
  renderModeButtons();
  renderStartBtn();
}

init();
