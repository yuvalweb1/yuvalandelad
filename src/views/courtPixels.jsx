// ============================================================
// Pixel-art primitives for Group Court.
//
// Everything here is hand-drawn inline SVG on an integer grid with
// `shape-rendering: crispEdges`, so the art is resolution-independent
// (scales to any size, stays crunchy) with ZERO image assets and ZERO
// network — honoring the privacy invariant. The scenes are left-right
// symmetric so they read correctly under both LTR and RTL (`dir`).
//
// This is a deliberately HEAVY, committed 16-bit courtroom: deep wood
// panelling, a teal back wall, stone columns, a hanging scales emblem,
// and a chibi judge behind a tall bench. Palette = brass / mahogany /
// parchment with strong outlines.
// ============================================================

// ── Palette ───────────────────────────────────────────────────────
const INK      = '#241710'; // hard outline / darkest wood
const WALL      = '#2E5D5A'; // deep teal back wall
const WALL_HI   = '#3A6F6B';
const WALL_LO   = '#244A47';
const WOOD       = '#9A6B3A'; // panelling
const WOOD_HI    = '#B5824B';
const WOOD_LO    = '#6F4A24';
const WOOD_DK    = '#4E331A';
const FLOOR      = '#7A4F2A';
const FLOOR_HI   = '#8C5E33';
const STONE      = '#E9DCC0'; // columns / stone
const STONE_HI   = '#F4EAD2';
const STONE_SH   = '#C4AC82';
const STONE_DK   = '#9C8358';
const GOLD       = '#E8B33A';
const GOLD_HI    = '#F6D061';
const GOLD_LO    = '#B07E1E';
const RED        = '#C24B3A';
const SKIN       = '#E8B98C';
const SKIN_SH    = '#C98F63';
const ROBE       = '#26190F';
const ROBE_HI    = '#3A2616';
const WIG        = '#F3ECDD';
const WIG_SH     = '#D2C6AB';

// A single pixel block. Coordinates are in grid units.
function P({ x, y, w = 1, h = 1, c }) {
  return <rect x={x} y={y} width={w} height={h} fill={c} />;
}

// ── HEAVY courtroom interior — a full scene used as a backdrop.
//    64×64 grid: teal wall, wood panelling, two stone columns, a
//    hanging scales emblem, and a wood floor. Symmetric → RTL-safe.
export function PixelCourtroom({ style }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      aria-hidden="true"
      style={style}
    >
      {/* back wall */}
      <P x={0} y={0} w={64} h={64} c={WALL} />
      <P x={0} y={0} w={64} h={30} c={WALL_HI} />
      {/* subtle wall panel seams */}
      {[8, 20, 44, 56].map((x, i) => <P key={'s' + i} x={x} y={4} w={1} h={22} c={WALL_LO} />)}

      {/* crown moulding */}
      <P x={0} y={26} w={64} h={2} c={WOOD_HI} />
      <P x={0} y={28} w={64} h={2} c={WOOD} />

      {/* lower wood panelling */}
      <P x={0} y={30} w={64} h={20} c={WOOD} />
      {[6, 18, 30, 42, 54].map((x, i) => (
        <g key={'p' + i}>
          <P x={x} y={32} w={8} h={16} c={WOOD_HI} />
          <P x={x} y={32} w={8} h={1} c={WOOD_LO} />
          <P x={x} y={47} w={8} h={1} c={WOOD_LO} />
          <P x={x} y={32} w={1} h={16} c={WOOD_LO} />
        </g>
      ))}

      {/* floor */}
      <P x={0} y={50} w={64} h={14} c={FLOOR} />
      <P x={0} y={50} w={64} h={2} c={FLOOR_HI} />
      {[10, 26, 42, 58].map((x, i) => <P key={'f' + i} x={x} y={52} w={1} h={12} c={WOOD_DK} />)}

      {/* two stone columns flanking */}
      {[4, 56].map((x, i) => (
        <g key={'c' + i}>
          <P x={x} y={2} w={4} h={48} c={STONE} />
          <P x={x} y={2} w={1} h={48} c={STONE_HI} />
          <P x={x + 3} y={2} w={1} h={48} c={STONE_SH} />
          {/* capital + base */}
          <P x={x - 1} y={2} w={6} h={2} c={STONE_SH} />
          <P x={x - 1} y={48} w={6} h={3} c={STONE_SH} />
          {/* fluting */}
          <P x={x + 1} y={6} w={1} h={40} c={STONE_DK} />
        </g>
      ))}

      {/* hanging scales-of-justice emblem on the wall */}
      <P x={31} y={5}  w={2} h={9} c={GOLD} />
      <P x={31} y={4}  w={2} h={1} c={GOLD_HI} />
      <P x={25} y={7}  w={14} h={1} c={GOLD} />
      <P x={25} y={8}  w={1} h={4} c={GOLD_LO} />
      <P x={38} y={8}  w={1} h={4} c={GOLD_LO} />
      <P x={23} y={12} w={5} h={1} c={GOLD} />
      <P x={24} y={13} w={3} h={1} c={GOLD_LO} />
      <P x={36} y={12} w={5} h={1} c={GOLD} />
      <P x={37} y={13} w={3} h={1} c={GOLD_LO} />
      <P x={29} y={14} w={6} h={2} c={GOLD} />
      <P x={29} y={15} w={6} h={1} c={GOLD_LO} />
    </svg>
  );
}

// Back-compat alias (older imports).
export const PixelCourthouse = PixelCourtroom;

// ── Pixel judge — a chibi judge behind a tall bench: powdered wig,
//    robe, gavel. `pose` controls the gavel: 'idle' | 'raise' | 'slam'.
//    34×44 grid, centered, symmetric body → RTL-safe.
export function PixelJudge({ size = 150, pose = 'idle', showBench = true }) {
  const gavelClass = pose === 'slam' ? 'a-gavel-slam' : '';
  const raised = pose === 'raise';

  return (
    <div style={{ width: size, height: size * (44 / 34), position: 'relative', flexShrink: 0 }}>
      <svg viewBox="0 0 34 44" width="100%" height="100%" shapeRendering="crispEdges" aria-hidden="true" style={{ display: 'block' }}>
        {/* ── body ── */}
        {/* robe / shoulders */}
        <P x={7}  y={22} w={20} h={12} c={ROBE} />
        <P x={7}  y={22} w={20} h={1}  c={ROBE_HI} />
        <P x={10} y={23} w={14} h={11} c={ROBE_HI} />
        <P x={10} y={23} w={1}  h={11} c={ROBE} />
        <P x={23} y={23} w={1}  h={11} c={ROBE} />
        {/* white jabot / collar bands */}
        <P x={15} y={23} w={4} h={8} c={WIG} />
        <P x={16} y={23} w={1} h={8} c={WIG_SH} />
        <P x={18} y={23} w={1} h={8} c={WIG_SH} />

        {/* neck */}
        <P x={14} y={20} w={6} h={3} c={SKIN_SH} />

        {/* head */}
        <P x={11} y={11} w={12} h={10} c={SKIN} />
        <P x={11} y={11} w={12} h={1}  c={SKIN_SH} />
        <P x={22} y={12} w={1}  h={8}  c={SKIN_SH} />
        {/* glasses + eyes */}
        <P x={13} y={15} w={3} h={1} c={INK} />
        <P x={18} y={15} w={3} h={1} c={INK} />
        <P x={14} y={16} w={1} h={2} c={INK} />
        <P x={19} y={16} w={1} h={2} c={INK} />
        <P x={16} y={15} w={2} h={1} c={INK} />
        {/* mouth */}
        <P x={15} y={19} w={4} h={1} c={SKIN_SH} />

        {/* powdered wig — domed top + side curls */}
        <P x={12} y={6}  w={10} h={5} c={WIG} />
        <P x={13} y={5}  w={8}  h={1} c={WIG} />
        <P x={10} y={9}  w={2}  h={9} c={WIG} />
        <P x={22} y={9}  w={2}  h={9} c={WIG} />
        <P x={9}  y={11} w={2}  h={6} c={WIG_SH} />
        <P x={23} y={11} w={2}  h={6} c={WIG_SH} />
        {/* curl rows (wig texture) */}
        {[12, 14, 16].map((y, i) => <P key={'wl' + i} x={10} y={y} w={1} h={1} c={WIG_SH} />)}
        {[12, 14, 16].map((y, i) => <P key={'wr' + i} x={23} y={y} w={1} h={1} c={WIG_SH} />)}
        <P x={12} y={6} w={10} h={1} c={WIG_SH} />

        {/* gavel (rotates as one piece) */}
        <g className={gavelClass} style={{ transformOrigin: '25px 30px', transform: raised ? 'rotate(-46deg)' : 'none' }}>
          <P x={24} y={28} w={2} h={8} c={WOOD_HI} />
          <P x={24} y={28} w={1} h={8} c={WOOD_LO} />
          <P x={21} y={24} w={9} h={4} c={GOLD} />
          <P x={21} y={24} w={9} h={1} c={GOLD_HI} />
          <P x={21} y={27} w={9} h={1} c={GOLD_LO} />
          <P x={21} y={24} w={1} h={4} c={GOLD_LO} />
          <P x={29} y={24} w={1} h={4} c={GOLD_LO} />
        </g>

        {/* ── bench (drawn last so it overlaps the robe) ── */}
        {showBench && (
          <g>
            <P x={1}  y={34} w={32} h={10} c={WOOD} />
            <P x={1}  y={34} w={32} h={1}  c={WOOD_HI} />
            <P x={1}  y={34} w={32} h={1}  c={WOOD_HI} />
            {/* front panels */}
            <P x={3}  y={36} w={8}  h={6} c={WOOD_HI} />
            <P x={13} y={36} w={8}  h={6} c={WOOD_HI} />
            <P x={23} y={36} w={8}  h={6} c={WOOD_HI} />
            <P x={3}  y={36} w={8}  h={1} c={WOOD_LO} />
            <P x={13} y={36} w={8}  h={1} c={WOOD_LO} />
            <P x={23} y={36} w={8}  h={1} c={WOOD_LO} />
            {/* gold trim */}
            <P x={1}  y={33} w={32} h={1} c={GOLD} />
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Pixel scales-of-justice icon (standalone, for headers/empty states).
export function PixelScales({ size = 56 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} shapeRendering="crispEdges" aria-hidden="true">
      <P x={11} y={3}  w={2}  h={16} c={GOLD} />
      <P x={11} y={2}  w={2}  h={1}  c={GOLD_HI} />
      <P x={5}  y={4}  w={14} h={1}  c={GOLD} />
      <P x={5}  y={5}  w={1}  h={4}  c={GOLD_LO} />
      <P x={18} y={5}  w={1}  h={4}  c={GOLD_LO} />
      <P x={3}  y={9}  w={5}  h={1}  c={GOLD} />
      <P x={4}  y={10} w={3}  h={1}  c={GOLD_LO} />
      <P x={16} y={9}  w={5}  h={1}  c={GOLD} />
      <P x={17} y={10} w={3}  h={1}  c={GOLD_LO} />
      <P x={8}  y={19} w={8}  h={1}  c={GOLD} />
      <P x={6}  y={20} w={12} h={2}  c={GOLD_LO} />
    </svg>
  );
}

// ── A chunky pixel-bordered panel. Stepped 4px border via stacked
//    box-shadows (crisp, symmetric for RTL). `fill` picks the surface.
export function PixelPanel({ children, fill = STONE, border = INK, style, className = '' }) {
  return (
    <div
      className={className}
      style={{
        position: 'relative', background: fill, color: INK,
        boxShadow: `0 0 0 4px ${fill}, 0 0 0 9px ${border}, 8px 12px 0 0 rgba(36,23,16,0.30)`,
        padding: '18px 16px', ...style,
      }}
    >
      {children}
    </div>
  );
}

export const COURT_PX = {
  INK, WALL, WOOD, WOOD_HI, WOOD_LO, FLOOR, STONE, STONE_HI, STONE_SH,
  GOLD, GOLD_HI, GOLD_LO, RED, SKIN, WIG,
};
