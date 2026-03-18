import { useEffect, useRef } from 'react';

// Skip Three.js on mobile — canvas intercepts touch events and hurts performance
const isMobile = () => window.innerWidth < 1024;

export default function AnimatedBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    // On mobile: no Three.js, no canvas — pure CSS background only
    if (isMobile()) return;

    let scene, camera, renderer, animationId;
    let planeGeometry, mesh, points, floatingPoints;
    let clock;

    const loadThreeJS = () => {
      return new Promise((resolve) => {
        if (window.THREE) { resolve(window.THREE); return; }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => resolve(window.THREE);
        document.head.appendChild(script);
      });
    };

    const createDotTexture = (THREE) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64; canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');
      gradient.addColorStop(0.2, 'rgba(99, 102, 241, 0.5)');
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };

    const initScene = async () => {
      const THREE = await loadThreeJS();
      if (!mountRef.current) return;

      scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x020a1c, 0.0012);

      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
      camera.position.set(0, 150, 400);
      camera.lookAt(0, 0, 0);

      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      mountRef.current.appendChild(renderer.domElement);

      // Prevent canvas from intercepting any pointer/touch events
      renderer.domElement.style.pointerEvents = 'none';
      renderer.domElement.style.touchAction = 'none';

      clock = new THREE.Clock();

      planeGeometry = new THREE.PlaneGeometry(2500, 1500, 60, 40);
      planeGeometry.rotateX(-Math.PI / 2);

      const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0x4f46e5, wireframe: true, transparent: true, opacity: 0.05,
      });

      const dotTexture = createDotTexture(THREE);
      const pointsMaterial = new THREE.PointsMaterial({
        size: 8, map: dotTexture, transparent: true, opacity: 0.6,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });

      mesh = new THREE.Mesh(planeGeometry, lineMaterial);
      points = new THREE.Points(planeGeometry, pointsMaterial);
      scene.add(mesh);
      scene.add(points);

      const floatGeometry = new THREE.BufferGeometry();
      const floatPositions = [];
      for (let i = 0; i < 300; i++) {
        floatPositions.push((Math.random() - 0.5) * 3000);
        floatPositions.push((Math.random() - 0.5) * 1000 + 200);
        floatPositions.push((Math.random() - 0.5) * 3000);
      }
      floatGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floatPositions, 3));
      const floatMaterial = new THREE.PointsMaterial({
        size: 10, map: dotTexture, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      floatingPoints = new THREE.Points(floatGeometry, floatMaterial);
      scene.add(floatingPoints);

      animate();
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();

      if (planeGeometry) {
        const positions = planeGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2];
          positions[i + 1] =
            Math.sin(x * 0.003 + time * 0.4) * 30 +
            Math.cos(z * 0.004 + time * 0.25) * 30 +
            Math.sin((x + z) * 0.002 + time * 0.3) * 20 - 50;
        }
        planeGeometry.attributes.position.needsUpdate = true;
      }

      if (floatingPoints) {
        floatingPoints.rotation.y = time * 0.01;
        floatingPoints.rotation.x = Math.sin(time * 0.05) * 0.02;
      }
      if (mesh && points) {
        mesh.rotation.y = Math.sin(time * 0.05) * 0.02;
        points.rotation.y = Math.sin(time * 0.05) * 0.02;
      }
      renderer.render(scene, camera);
    };

    const handleResize = () => {
      if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    initScene();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationId) cancelAnimationFrame(animationId);
      if (mountRef.current && renderer) {
        mountRef.current.removeChild(renderer.domElement);
      }
      if (planeGeometry) planeGeometry.dispose();
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100vw', height: '100vh',
      overflow: 'hidden',
      zIndex: -1,
      pointerEvents: 'none',
      touchAction: 'none',
    }}>
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'var(--bg-base)',
      }} />
      {/* Three.js mount — desktop only */}
      <div
        ref={mountRef}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          opacity: 0.25,
          pointerEvents: 'none',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
