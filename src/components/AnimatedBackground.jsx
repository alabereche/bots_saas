import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const mountRef = useRef(null);

  useEffect(() => {
    let scene, camera, renderer, animationId;
    let planeGeometry, mesh, points, floatingPoints;
    let clock;

    // Load Three.js
    const loadThreeJS = () => {
      return new Promise((resolve) => {
        if (window.THREE) {
          resolve(window.THREE);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload = () => resolve(window.THREE);
        document.head.appendChild(script);
      });
    };

    // Create glowing dot texture
    const createDotTexture = (THREE) => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.8)');      // soft purple center
      gradient.addColorStop(0.2, 'rgba(99, 102, 241, 0.5)');    // indigo
      gradient.addColorStop(0.5, 'rgba(99, 102, 241, 0.1)');    // light glow
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');             // transparent edges
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(canvas);
    };

    const initScene = async () => {
      const THREE = await loadThreeJS();

      if (!mountRef.current) return;

      // 1. Scene
      scene = new THREE.Scene();
      
      // Fog for depth
      scene.fog = new THREE.FogExp2(0x020a1c, 0.0012);

      // 2. Camera
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 3000);
      camera.position.set(0, 150, 400); // Angle
      camera.lookAt(0, 0, 0);

      // 3. Renderer
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // alpha: true for CSS background merge
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
      mountRef.current.appendChild(renderer.domElement);

      clock = new THREE.Clock();

      // 4. Wave Mesh (PlaneGeometry)
      planeGeometry = new THREE.PlaneGeometry(2500, 1500, 60, 40);
      planeGeometry.rotateX(-Math.PI / 2); // Rotate to layout

      // Wireframe Material
      const lineMaterial = new THREE.MeshBasicMaterial({
        color: 0x4f46e5,
        wireframe: true,
        transparent: true,
        opacity: 0.05,
      });

      // Particles Material
      const dotTexture = createDotTexture(THREE);
      const pointsMaterial = new THREE.PointsMaterial({
        size: 8,
        map: dotTexture,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending, // Glow on overlap
        depthWrite: false, 
      });

      mesh = new THREE.Mesh(planeGeometry, lineMaterial);
      points = new THREE.Points(planeGeometry, pointsMaterial);

      scene.add(mesh);
      scene.add(points);

      // 5. Floating Particles
      const floatGeometry = new THREE.BufferGeometry();
      const floatPositions = [];
      for (let i = 0; i < 300; i++) {
        floatPositions.push((Math.random() - 0.5) * 3000); // X
        floatPositions.push((Math.random() - 0.5) * 1000 + 200); // Y
        floatPositions.push((Math.random() - 0.5) * 3000); // Z
      }
      floatGeometry.setAttribute('position', new THREE.Float32BufferAttribute(floatPositions, 3));
      const floatMaterial = new THREE.PointsMaterial({
        size: 10,
        map: dotTexture,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      floatingPoints = new THREE.Points(floatGeometry, floatMaterial);
      scene.add(floatingPoints);

      animate();
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const time = clock.getElapsedTime();
      
      // Wave animation
      if (planeGeometry) {
        const positions = planeGeometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
          const x = positions[i];
          const z = positions[i + 2]; 
          
          const y = Math.sin(x * 0.003 + time * 0.4) * 30 +
                    Math.cos(z * 0.004 + time * 0.25) * 30 +
                    Math.sin((x + z) * 0.002 + time * 0.3) * 20;
                    
          positions[i + 1] = y - 50; // shift down slightly
        }
        planeGeometry.attributes.position.needsUpdate = true;
      }

      // Floating particles animation
      if (floatingPoints) {
        floatingPoints.rotation.y = time * 0.01;
        floatingPoints.rotation.x = Math.sin(time * 0.05) * 0.02;
      }

      // Overall mesh animation
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
      zIndex: -1, // Keep behind all content
      pointerEvents: 'none', // Allow clicks to pass through
    }}>
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-base)'
        }}
      />
      <div ref={mountRef} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, opacity: 0.25 }} />
    </div>
  );
}
