import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { SONGS } from "./data";

/**
 * One preview player for the whole world: the setlist, the record on the
 * lift and the shelf all play through it. While a preview plays (and while
 * the meter falls back after it) one rAF reads the analyser and hands the
 * levels to whoever drew from them last frame: the LED wall's meter, the
 * moving heads, the time readout. Paused, nothing runs.
 */

export const BARS = 28;

export type Draw = (f: Readonly<{ levels: Float32Array; beat: number; live: boolean; t: number; d: number }>) => void;

export function useSetlist(visible: boolean) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const bins = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const levels = useRef(new Float32Array(BARS));
  const beat = useRef(0);
  const drawers = useRef(new Set<Draw>());
  const raf = useRef(0);
  const indexRef = useRef(index);
  indexRef.current = index;

  const ensureGraph = () => {
    const audio = audioRef.current;
    if (!audio || ctxRef.current) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      ctxRef.current = ctx;
      analyserRef.current = analyser;
      bins.current = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      // no WebAudio: the preview still plays, the meter falls back to a gentle idle
    }
  };

  /** One frame of levels; false once everything has settled. */
  const step = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return false;
    const L = levels.current;
    const an = analyserRef.current;
    const data = bins.current;
    const live = !audio.paused && !audio.ended;
    let moving = live;
    if (an && data && live) {
      an.getByteFrequencyData(data);
      for (let i = 0; i < BARS; i++) {
        // log-spaced bins so the bass doesn't swallow the whole meter
        const a = Math.floor((i / BARS) ** 1.6 * 90) + 1;
        const b = Math.max(a + 1, Math.floor(((i + 1) / BARS) ** 1.6 * 90) + 1);
        let sum = 0;
        for (let j = a; j < b; j++) sum += data[j];
        const v = sum / (b - a) / 255;
        L[i] = Math.max(v * (0.75 + i / BARS / 2), L[i] * 0.86);
      }
      const kick = (data[1] + data[2] + data[3]) / 765;
      beat.current = Math.max(kick * kick, beat.current * 0.9);
    } else if (live) {
      const t = performance.now() / 1000;
      for (let i = 0; i < BARS; i++) L[i] = 0.25 + 0.2 * Math.sin(t * 3 + i * 0.7) * Math.sin(t * 1.3 + i * 0.21);
      beat.current = 0.35 + 0.25 * Math.sin(t * 7.2);
    } else {
      beat.current *= 0.9;
      for (let i = 0; i < BARS; i++) {
        L[i] *= 0.9;
        if (L[i] > 0.01) moving = true;
      }
      if (beat.current > 0.01) moving = true;
    }
    const d = audio.duration || 30;
    for (const fn of drawers.current) fn({ levels: L, beat: beat.current, live, t: audio.currentTime, d });
    return moving;
  }, []);

  const loop = useCallback(() => {
    cancelAnimationFrame(raf.current);
    const tick = () => {
      raf.current = step() ? requestAnimationFrame(tick) : 0;
    };
    raf.current = requestAnimationFrame(tick);
  }, [step]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  useEffect(() => {
    if (!visible) audioRef.current?.pause();
  }, [visible]);

  const play = useCallback((i: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    setFailed(false);
    if (i !== indexRef.current || !audio.src) {
      audio.src = SONGS[i].previewUrl;
      setIndex(i);
    }
    ensureGraph();
    void ctxRef.current?.resume();
    audio.play().catch(() => setFailed(true));
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) audio.pause();
    else play(indexRef.current);
  }, [play]);

  /** A song from the list: play it, or pause it if it is the one playing. */
  const pick = useCallback(
    (i: number) => {
      const audio = audioRef.current;
      if (i === indexRef.current && audio && !audio.paused) audio.pause();
      else play(i);
    },
    [play],
  );

  /** Draw from the levels each frame they move (and once now). */
  const draw = useCallback(
    (fn: Draw) => {
      drawers.current.add(fn);
      const audio = audioRef.current;
      fn({ levels: levels.current, beat: beat.current, live: false, t: audio?.currentTime ?? 0, d: audio?.duration || 30 });
      return () => {
        drawers.current.delete(fn);
      };
    },
    [],
  );

  const audioProps = useMemo(
    () => ({
      ref: audioRef,
      crossOrigin: "anonymous" as const,
      preload: "none" as const,
      onPlay: () => {
        setPlaying(true);
        loop();
      },
      onPause: () => {
        setPlaying(false);
        loop();
      },
      onEnded: () => setPlaying(false),
      onError: () => {
        if (audioRef.current?.src) setFailed(true);
        setPlaying(false);
      },
    }),
    [loop],
  );

  return { index, song: SONGS[index], playing, failed, play, toggle, pick, draw, audioProps };
}

export type Setlist = ReturnType<typeof useSetlist>;
