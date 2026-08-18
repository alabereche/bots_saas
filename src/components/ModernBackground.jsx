import { useEffect, useRef } from 'react';

export default function ModernBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Responsive resize handler
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initNodes();
    };

    window.addEventListener('resize', handleResize);

    // Node & Beam Configuration for Conversational Commerce Mesh
    const NODE_COUNT = Math.min(48, Math.floor(width / 35));
    const CONNECTION_DIST = 140;
    let nodes = [];

    // Track mouse for subtle interactive reactive field
    let mouse = { x: -1000, y: -1000, radius: 180 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    const initNodes = () => {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const isEmerald = Math.random() > 0.4;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.4,
          vy: (Math.random() - 0.5) * 0.4,
          radius: Math.random() * 1.8 + 1,
          color: isEmerald ? 'rgba(52, 211, 153, ' : 'rgba(56, 189, 248, ',
          pulseSpeed: 0.02 + Math.random() * 0.03,
          pulseVal: Math.random() * Math.PI,
        });
      }
    };

    initNodes();

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Render loop
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw and update each node
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;
          node.pulseVal += node.pulseSpeed;

          // Boundary wrap
          if (node.x < 0) node.x = width;
          if (node.x > width) node.x = 0;
          if (node.y < 0) node.y = height;
          if (node.y > height) node.y = 0;

          // Mouse proximity slight repulsion/attraction
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < mouse.radius) {
            const force = (mouse.radius - dist) / mouse.radius;
            node.x -= (dx / dist) * force * 0.8;
            node.y -= (dy / dist) * force * 0.8;
          }
        }

        const opacity = 0.35 + Math.sin(node.pulseVal) * 0.2;

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}${opacity})`;
        ctx.fill();

        // Connect nearby nodes with subtle data threads
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const cdx = node.x - other.x;
          const cdy = node.y - other.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist < CONNECTION_DIST) {
            const lineOpacity = (1 - cdist / CONNECTION_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(52, 211, 153, ${lineOpacity})`;
            ctx.lineWidth = 0.85;
            ctx.stroke();
          }
        }
      }

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="modern-bg-container" aria-hidden="true">
      {/* 1. Volumetric Optical Spotlight from top-center */}
      <div className="top-optic-spotlight" />

      {/* 2. Structured Ambient Architectural Aurora */}
      <div className="ambient-radial-mesh mesh-emerald-focal" />
      <div className="ambient-radial-mesh mesh-sapphire-focal" />

      {/* 3. Subtle Cybernetic Data Grid Matrix */}
      <div className="modern-grid-overlay" />

      {/* 4. Real-Time Conversational Signal Mesh (Canvas) */}
      <canvas ref={canvasRef} className="mesh-canvas-layer" />

      {/* 5. Tactile Micro-Texture / Film Grain Overlay */}
      <div className="noise-texture-overlay" />

      {/* 6. Deep Vignette Frame */}
      <div className="vignette-frame" />
    </div>
  );
}
