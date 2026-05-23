export default function HomeIndicator() {
  return (
    <div style={{
      position: 'absolute', left: '50%', transform: 'translateX(-50%)',
      bottom: 6, width: 120, height: 4, background: '#fff', borderRadius: 999, zIndex: 50,
    }} />
  );
}
