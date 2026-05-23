import { useState, useEffect } from 'react';

export function useAnimatedNumber(target, duration = 1400, deps = []) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target == null || isNaN(target)) { setValue(0); return; }
    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) { setValue(target); return; }
    let frame;
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, deps);
  return value;
}
