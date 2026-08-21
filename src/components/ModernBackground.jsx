import { useEffect, useRef } from 'react';

export default function ModernBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    // ⚡ Performance Rule: Skip canvas animation completely on mobile / low-power devices
    const isMobile = window.innerWidth <= 768;
    if (isMobile) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Responsive resize handler (debounced)
    let resizeTimer;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!canvas) return;
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initNodes();
      }, 150);
    };

    window.addEventListener('resize', handleResize, { passive: true });

    // Lightweight Node & Beam Configuration
    const NODE_COUNT = Math.min(26, Math.floor(width / 50));
    const CONNECTION_DIST = 120;
    const CONNECTION_DIST_SQ = CONNECTION_DIST * CONNECTION_DIST;
    let nodes = [];

    // Track mouse for subtle interactive reactive field
    let mouse = { x: -1000, y: -1000, radius: 150, radiusSq: 22500 };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseleave', handleMouseLeave, { passive: true });

    const initNodes = () => {
      nodes = [];
      for (let i = 0; i < NODE_COUNT; i++) {
        const isEmerald = Math.random() > 0.4;
        nodes.push({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          radius: Math.random() * 1.5 + 0.8,
          color: isEmerald ? 'rgba(52, 211, 153, ' : 'rgba(56, 189, 248, ',
          pulseSpeed: 0.02 + Math.random() * 0.02,
          pulseVal: Math.random() * Math.PI,
        });
      }
    };

    initNodes();

    // Check for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let isRunning = true;

    // Fast, optimized 60fps render loop with zero square root overhead in inner loops
    const render = () => {
      if (!isRunning) return;

      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        if (!prefersReducedMotion) {
          node.x += node.vx;
          node.y += node.vy;
          node.pulseVal += node.pulseSpeed;

          if (node.x < 0) node.x = width;
          if (node.x > width) node.x = 0;
          if (node.y < 0) node.y = height;
          if (node.y > height) node.y = 0;

          // Proximity interaction using squared distance (0 Math.sqrt calls)
          const dx = mouse.x - node.x;
          const dy = mouse.y - node.y;
          const distSq = dx * dx + dy * dy;
          if (distSq < mouse.radiusSq && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const force = (mouse.radius - dist) / mouse.radius;
            node.x -= (dx / dist) * force * 0.6;
            node.y -= (dy / dist) * force * 0.6;
          }
        }

        const opacity = 0.3 + Math.sin(node.pulseVal) * 0.15;

        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color}${opacity})`;
        ctx.fill();

        // Connect nearby nodes with fast distance check
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const cdx = node.x - other.x;
          const cdy = node.y - other.y;
          const cdistSq = cdx * cdx + cdy * cdy;

          if (cdistSq < CONNECTION_DIST_SQ) {
            const cdist = Math.sqrt(cdistSq);
            const lineOpacity = (1 - cdist / CONNECTION_DIST) * 0.15;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(52, 211, 153, ${lineOpacity})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      if (!prefersReducedMotion && isRunning) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    // Pause when tab is invisible
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animationFrameId);
      } else {
        if (!isRunning) {
          isRunning = true;
          render();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    render();

    return () => {
      isRunning = false;
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="modern-bg-container" aria-hidden="true">
      {/* 1. Volumetric Optical Spotlight */}
      <div className="top-optic-spotlight" />

      {/* 2. Structured Ambient Architectural Aurora */}
      <div className="ambient-radial-mesh mesh-emerald-focal" />
      <div className="ambient-radial-mesh mesh-sapphire-focal" />

      {/* 3. Subtle Cybernetic Data Grid Matrix */}
      <div className="modern-grid-overlay" />

      {/* 4. Real-Time Conversational Signal Mesh (Desktop only) */}
      <canvas ref={canvasRef} className="mesh-canvas-layer" />

      {/* 5. Deep Vignette Frame */}
      <div className="vignette-frame" />
    </div>
  );
}
