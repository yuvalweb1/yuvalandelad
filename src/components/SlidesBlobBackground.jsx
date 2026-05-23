import { useEffect, useRef } from 'react';

export default function SlidesBlobBackground() {
  const containerRef = useRef(null);
  const b1 = useRef(null), b2 = useRef(null), b3 = useRef(null), b4 = useRef(null);

  useEffect(() => {
    const blobRefs = [b1, b2, b3, b4];
    // cx/cy = center as fraction of container size; spread across all 4 quadrants
    const configs = [
      { cx: 0.18, cy: 0.20, ax1: 55, ay1: 50, ax2: 30, ay2: 35, fx1: 0.00071, fy1: 0.00053, fx2: 0.00041, fy2: 0.00067, px1: 0.0, py1: 1.2, px2: 2.1, py2: 0.5 },
      { cx: 0.78, cy: 0.30, ax1: 50, ay1: 60, ax2: 35, ay2: 28, fx1: 0.00059, fy1: 0.00079, fx2: 0.00037, fy2: 0.00043, px1: 3.1, py1: 0.8, px2: 1.5, py2: 2.7 },
      { cx: 0.22, cy: 0.72, ax1: 65, ay1: 42, ax2: 28, ay2: 50, fx1: 0.00083, fy1: 0.00047, fx2: 0.00061, fy2: 0.00031, px1: 1.7, py1: 3.4, px2: 0.9, py2: 1.1 },
      { cx: 0.74, cy: 0.76, ax1: 45, ay1: 55, ax2: 40, ay2: 32, fx1: 0.00049, fy1: 0.00073, fx2: 0.00081, fy2: 0.00057, px1: 2.3, py1: 0.6, px2: 0.4, py2: 2.9 },
    ];
    let rafId;
    const animate = (t) => {
      const container = containerRef.current;
      const W = container ? container.offsetWidth : 380;
      const H = container ? container.offsetHeight : 820;
      blobRefs.forEach((ref, i) => {
        if (!ref.current) return;
        const c = configs[i];
        const el = ref.current;
        const x = c.cx * W + Math.sin(t * c.fx1 + c.px1) * c.ax1 + Math.sin(t * c.fx2 + c.px2) * c.ax2;
        const y = c.cy * H + Math.sin(t * c.fy1 + c.py1) * c.ay1 + Math.sin(t * c.fy2 + c.py2) * c.ay2;
        el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px)`;
      });
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div ref={b1} style={{ position: 'absolute', width: 160, height: 160, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #f94144 0%, #f3722c 45%, transparent 70%)', opacity: 0.45 }} />
      <div ref={b2} style={{ position: 'absolute', width: 140, height: 140, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #577590 0%, #277da1 45%, transparent 70%)', opacity: 0.40 }} />
      <div ref={b3} style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #f9c74f 0%, #f3722c 45%, transparent 70%)', opacity: 0.42 }} />
      <div ref={b4} style={{ position: 'absolute', width: 130, height: 130, borderRadius: '50%', willChange: 'transform', background: 'radial-gradient(circle, #277da1 0%, #577590 50%, transparent 70%)', opacity: 0.38 }} />
    </div>
  );
}
