import { useEffect, useRef } from "react";

/**
 * SecretSynth — hold S + move the mouse to play soft pentatonic tones.
 *
 * Quiet easter egg. Mapped to a C-major pentatonic so every note is
 * pleasant regardless of cursor position. Attack/release is generous
 * so it feels like warm bells, not a synth line.
 *
 *  • Cursor X → pitch (pentatonic step)
 *  • Cursor Y → low-pass filter cutoff
 *  • While held, indicator pins to the top-right (bottom-right is
 *    taken by the command palette trigger) and the cursor turns
 *    into a music-note glyph so it's obvious the mode is active.
 *  • Releases all voices on key-up
 */

// Tiny SVG cursor — warm gold eighth-note on a transparent background.
// Hotspot is roughly the note head so the pitch the user expects to
// play lines up with where they clicked.
const SYNTH_CURSOR =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><g fill='none' stroke='%23e2b877' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'><ellipse cx='9' cy='19' rx='4.5' ry='3.25' fill='%23e2b877'/><path d='M13 19V5l9 3v2'/></g></svg>\") 9 19, crosshair";

const PENTATONIC = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.0,  // G4
  440.0,  // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
  783.99, // G5
  880.0,  // A5
];

export function SecretSynth() {
  const ctxRef = useRef<AudioContext | null>(null);
  const holdingRef = useRef(false);
  const lastNoteRef = useRef<number | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const indicatorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function ensureCtx() {
      if (ctxRef.current) return;
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const master = ctx.createGain();
      master.gain.value = 0.08;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1400;
      filter.Q.value = 0.6;
      master.connect(filter).connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
      filterRef.current = filter;
    }

    function playNote(freq: number) {
      const ctx = ctxRef.current!;
      const master = masterRef.current!;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.value = freq;
      osc2.frequency.value = freq * 2.005; // slight detune upper octave for shimmer
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(0, ctx.currentTime);
      voiceGain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.015);
      voiceGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.6);
      osc1.connect(voiceGain);
      osc2.connect(voiceGain);
      voiceGain.connect(master);
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.65);
      osc2.stop(ctx.currentTime + 1.65);
    }

    function getIndicator() {
      if (indicatorRef.current) return indicatorRef.current;
      const el = document.createElement("div");
      el.style.cssText = `
        position: fixed;
        top: 1.5rem;
        right: 1.5rem;
        padding: 6px 12px;
        border-radius: 9999px;
        background: oklch(0.22 0.02 60);
        color: oklch(0.96 0.01 60);
        font-family: Satoshi, sans-serif;
        font-size: 11px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        z-index: 100;
        pointer-events: none;
        opacity: 0;
        transition: opacity 200ms ease;
      `;
      el.textContent = "♫ synth on";
      document.body.appendChild(el);
      indicatorRef.current = el;
      return el;
    }

    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
      if (e.key.toLowerCase() === "s" && !e.repeat && !e.metaKey && !e.ctrlKey) {
        holdingRef.current = true;
        ensureCtx();
        ctxRef.current?.resume();
        const ind = getIndicator();
        ind.style.opacity = "1";
        document.documentElement.style.cursor = SYNTH_CURSOR;
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "s") {
        holdingRef.current = false;
        lastNoteRef.current = null;
        const ind = indicatorRef.current;
        if (ind) ind.style.opacity = "0";
        document.documentElement.style.cursor = "";
      }
    }

    function onMove(e: PointerEvent) {
      if (!holdingRef.current || !ctxRef.current || !filterRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const step = Math.min(
        PENTATONIC.length - 1,
        Math.max(0, Math.floor((e.clientX / w) * PENTATONIC.length))
      );
      // Map Y → filter cutoff 300Hz..3500Hz (inverted so higher = brighter)
      const cutoff = 3500 - (e.clientY / h) * 3200;
      filterRef.current.frequency.linearRampToValueAtTime(
        cutoff,
        ctxRef.current.currentTime + 0.05
      );
      if (step !== lastNoteRef.current) {
        lastNoteRef.current = step;
        playNote(PENTATONIC[step]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onMove);
      indicatorRef.current?.remove();
      indicatorRef.current = null;
      document.documentElement.style.cursor = "";
      ctxRef.current?.close();
      ctxRef.current = null;
    };
  }, []);

  return null;
}
