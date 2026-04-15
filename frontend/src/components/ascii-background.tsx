"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Animated ASCII background inspired by OpenHands.dev
 * Renders a grid of slowly shifting characters in the background.
 */
export function AsciiBackground() {
  const preRef = useRef<HTMLPreElement>(null);
  const frameRef = useRef<number>(0);

  const chars = " .,:;+*#@".split("");
  const specialChars = "AMERICAN AIRLINES CREW RISK  ✈  DFW HUB  ".split("");

  const render = useCallback(() => {
    const pre = preRef.current;
    if (!pre) return;

    const parent = pre.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    const charW = 8.4;
    const charH = 14;
    const cols = Math.floor(rect.width / charW);
    const rows = Math.floor(rect.height / charH);

    const t = performance.now() * 0.0003;
    let out = "";

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const nx = x / cols;
        const ny = y / rows;

        // Simple wave pattern
        const wave = Math.sin(nx * 12 + t * 2) * Math.cos(ny * 8 - t * 1.5);
        const wave2 = Math.sin((nx + ny) * 6 + t) * 0.5;
        const v = (wave + wave2 + 1) / 3;

        // Hash for slight randomness
        const h = ((x * 73856093) ^ (y * 19349669) ^ (Math.floor(t * 2) * 83492791)) >>> 0;

        if (v > 0.55 && v < 0.65) {
          // Band for text
          out += specialChars[(x + Math.floor(t * 3)) % specialChars.length];
        } else {
          const idx = Math.floor(v * chars.length) % chars.length;
          // Occasional random jitter
          if (h % 100 < 3) {
            out += chars[Math.floor(Math.random() * chars.length)];
          } else {
            out += chars[idx];
          }
        }
      }
      if (y < rows - 1) out += "\n";
    }

    pre.textContent = out;
    frameRef.current = requestAnimationFrame(render);
  }, [chars, specialChars]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameRef.current);
  }, [render]);

  return (
    <div className="ascii-bg">
      <pre ref={preRef} aria-hidden="true" />
    </div>
  );
}
