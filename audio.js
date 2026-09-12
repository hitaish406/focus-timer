/**
 * AudioManager — Generates a clean notification chime using the Web Audio API.
 *
 * No external audio files required.
 * Handles browser autoplay restrictions: audio context is created (or resumed)
 * only after the user has interacted with the page.
 */

class AudioManager {
  constructor() {
    this._ctx = null;
    this._enabled = true;
    this._userInteracted = false;

    // Mark interaction on first user gesture
    const markInteraction = () => {
      this._userInteracted = true;
      document.removeEventListener('click', markInteraction);
      document.removeEventListener('keydown', markInteraction);
    };
    document.addEventListener('click', markInteraction);
    document.addEventListener('keydown', markInteraction);
  }

  setEnabled(enabled) {
    this._enabled = enabled;
  }

  isEnabled() {
    return this._enabled;
  }

  /**
   * Play a short, clean two-tone chime.
   * Safe to call at any time; silently does nothing if:
   * - Sound is disabled
   * - User hasn't interacted yet
   * - Web Audio API is unavailable
   */
  play() {
    if (!this._enabled || !this._userInteracted) return;
    try {
      this._ensureContext();
      if (!this._ctx) return;
      if (this._ctx.state === 'suspended') {
        this._ctx.resume().then(() => this._playChime());
      } else {
        this._playChime();
      }
    } catch (e) {
      // Web Audio unavailable — silently ignore
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _ensureContext() {
    if (this._ctx) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) this._ctx = new Ctx();
    } catch (_) {}
  }

  _playChime() {
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Three note arpeggio: C5 → E5 → G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.18);

      const start = now + i * 0.18;
      const end   = start + 0.4;

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.4, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, end);

      osc.start(start);
      osc.stop(end + 0.05);
    });
  }
}

export default AudioManager;
