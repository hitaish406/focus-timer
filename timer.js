/**
 * TimerEngine — Drift-free countdown timer
 *
 * Uses an absolute target end timestamp rather than subtracting
 * 1 second per tick, so the timer stays accurate even when the
 * browser throttles background tabs or the device sleeps briefly.
 */

class TimerEngine {
  constructor(onTick, onComplete) {
    this._onTick = onTick;       // called every ~1 s with remaining ms
    this._onComplete = onComplete; // called when timer reaches 0

    this._intervalId = null;
    this._endTimestamp = null;   // absolute wall-clock target (ms)
    this._remainingMs = 0;       // snapshot when paused
    this._running = false;
    this._completed = false;
  }

  /** Load a fresh duration (milliseconds). Resets everything. */
  load(durationMs) {
    this._stop();
    this._remainingMs = durationMs;
    this._endTimestamp = null;
    this._running = false;
    this._completed = false;
    this._onTick(this._remainingMs);
  }

  start() {
    if (this._running || this._completed) return;
    // Compute absolute end timestamp from current remaining
    this._endTimestamp = Date.now() + this._remainingMs;
    this._running = true;
    this._tick(); // immediate first render
    this._intervalId = setInterval(() => this._tick(), 500); // 2× per second for smoothness
  }

  pause() {
    if (!this._running) return;
    this._remainingMs = Math.max(0, this._endTimestamp - Date.now());
    this._stop();
    this._running = false;
    this._onTick(this._remainingMs);
  }

  resume() {
    this.start(); // start() reads _remainingMs and resets timestamp
  }

  reset(durationMs) {
    this.load(durationMs);
  }

  /** Returns current remaining ms (safe to call any time) */
  getRemainingMs() {
    if (this._running && this._endTimestamp) {
      return Math.max(0, this._endTimestamp - Date.now());
    }
    return this._remainingMs;
  }

  isRunning() { return this._running; }
  isCompleted() { return this._completed; }

  /**
   * For persistence: save / restore the end timestamp so that
   * reopening the tab correctly picks up where the timer left off.
   */
  getEndTimestamp() { return this._endTimestamp; }

  restoreRunning(endTimestamp) {
    const remaining = endTimestamp - Date.now();
    if (remaining <= 0) {
      // Timer already expired while app was closed
      this._remainingMs = 0;
      this._running = false;
      this._completed = false;
      this._onTick(0);
      return false; // caller should trigger completion
    }
    this._endTimestamp = endTimestamp;
    this._remainingMs = remaining;
    this._running = true;
    this._completed = false;
    this._tick();
    this._intervalId = setInterval(() => this._tick(), 500);
    return true;
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  _tick() {
    if (!this._running) return;
    const remaining = Math.max(0, this._endTimestamp - Date.now());
    this._onTick(remaining);
    if (remaining === 0) {
      this._stop();
      this._running = false;
      this._completed = true;
      this._remainingMs = 0;
      this._onComplete();
    }
  }

  _stop() {
    if (this._intervalId !== null) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }
}

export default TimerEngine;
