export default function NeumorphicBackground() {
  return (
    <div className="neumorphic-bg-wrapper" aria-hidden="true">
      {/* ─── Cinematic Dark AI Background & Radial Vignette ─── */}
      <div className="neumorph-backdrop-img" style={{ backgroundImage: `url('/saas-bg.jpg')` }} />
      <div className="neumorph-backdrop-overlay" />
      <div className="ambient-radial-glow glow-1" />
      <div className="ambient-radial-glow glow-2" />
    </div>
  );
}
