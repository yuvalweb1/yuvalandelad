export default function BlobBackground() {
  const reducedMotion = typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const blob = (name, dur, reverse = false) =>
    reducedMotion ? 'none' : `${name} ${dur}s ease-in-out infinite${reverse ? ' reverse' : ''}`;
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: -1, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', width: 280, height: 280, borderRadius: '50%',
        background: 'var(--neon-pink)', opacity: 0.35, filter: 'blur(80px)',
        top: '-60px', left: '-60px', animation: blob('blobDrift1', 18),
      }} />
      <div style={{
        position: 'absolute', width: 320, height: 260, borderRadius: '50%',
        background: 'var(--blue-violet)', opacity: 0.35, filter: 'blur(80px)',
        top: '30%', right: '-80px', animation: blob('blobDrift2', 22),
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300, borderRadius: '50%',
        background: 'var(--amber-gold)', opacity: 0.35, filter: 'blur(80px)',
        bottom: '-40px', left: '10%', animation: blob('blobDrift3', 25),
      }} />
      <div style={{
        position: 'absolute', width: 200, height: 200, borderRadius: '50%',
        background: 'var(--azure-blue)', opacity: 0.35, filter: 'blur(80px)',
        top: '15%', left: '-20px', animation: blob('blobDrift1', 20, true),
      }} />
      <div style={{
        position: 'absolute', width: 250, height: 220, borderRadius: '50%',
        background: 'var(--blaze-orange)', opacity: 0.35, filter: 'blur(80px)',
        top: '55%', right: '-30px', animation: blob('blobDrift2', 15, true),
      }} />
    </div>
  );
}
