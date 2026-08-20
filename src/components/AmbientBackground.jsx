export default function AmbientBackground() {
  return (
    <div className="ambient-depth-bg" aria-hidden="true">
      {/* 3D Deep Space Canvas */}
      <div className="ambient-deep-canvas" />

      {/* Floating 3D Fluid Orbs with Slow Cinematic Drift */}
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />

      {/* 3D Depth-of-Field Aperture Vignette */}
      <div className="ambient-vignette-aperture" />
    </div>
  );
}
