/* The 2028 Ballot — WebAudio sound cues.
 *
 * Two synthesized sounds:
 *   pickClick()      — soft 30ms click when a card is tapped.
 *   resolvedChime()  — low-volume two-note arpeggio when the reveal settles.
 *
 * Both are gated by a localStorage-persisted mute toggle (default unmuted).
 * Exposed on `window.Sounds` so app.js can call without a module import.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'ballot28.muted.v1';
  let ctx = null;
  let muted = (function () {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch { return false; }
  })();

  function ensureCtx() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    // iOS Safari: contexts start suspended until a user gesture; resume on first call.
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try { ctx.resume(); } catch { /* ignore */ }
    }
    return ctx;
  }

  function pickClick() {
    if (muted) return;
    const ac = ensureCtx();
    if (!ac) return;
    const now = ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 820;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  function chimeNote(ac, freq, startOffset, duration, peak) {
    const start = ac.currentTime + startOffset;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function resolvedChime() {
    if (muted) return;
    const ac = ensureCtx();
    if (!ac) return;
    // E5 → A5 ascending, low peak gain so it sits under the room rather than over it.
    chimeNote(ac, 659.25, 0,     0.18, 0.06); // E5
    chimeNote(ac, 880.00, 0.10,  0.22, 0.06); // A5
  }

  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(STORAGE_KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }
  function isMuted() { return muted; }

  window.Sounds = { pickClick, resolvedChime, setMuted, isMuted };
})();
