import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { 
  Maximize2, Minimize2, RotateCcw, Play, Pause, 
  Layers, Eye, Download, Camera, Sliders, Box, SunMedium, Compass
} from 'lucide-react';
import { exportToSTL, exportToOBJ, downloadCanvasSnapshot } from '../services/exporter';
import { THEMES, THEME_LIST, getTheme } from '../constants/themes';



export default function TopographicViewer({
  frameData,
  activeTheme = 'neon',
  onThemeChange,
  showMinutiae = true,
  onFpsUpdate
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Three.js internal references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const meshRef = useRef(null);
  const pointsRef = useRef(null);
  const minutiaeGroupRef = useRef(null);
  const gridHelperRef = useRef(null);
  const animFrameIdRef = useRef(null);

  // Interactive controls state
  const [elevationScale, setElevationScale] = useState(1.8);
  const [renderMode, setRenderMode] = useState('solid'); // 'solid', 'contour', 'wireframe', 'points'
  const [autoRotate, setAutoRotate] = useState(false);
  const [rotateSpeed, setRotateSpeed] = useState(1.5);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControlsDrawer, setShowControlsDrawer] = useState(false);
  const [gridVisible, setGridVisible] = useState(true);

  // Performance telemetry
  const lastFpsCalc = useRef(performance.now());
  const frameCount = useRef(0);

  // Interpolate color from color stops
  const getElevationColor = useCallback((normalizedHeight, themeKey) => {
    const theme = getTheme(themeKey);
    const stops = theme.colors;
    const h = Math.max(0, Math.min(1, normalizedHeight));

    for (let i = 0; i < stops.length - 1; i++) {
      if (h >= stops[i].stop && h <= stops[i + 1].stop) {
        const factor = (h - stops[i].stop) / (stops[i + 1].stop - stops[i].stop);
        const c1 = stops[i].color;
        const c2 = stops[i + 1].color;
        return new THREE.Color(
          c1.r + (c2.r - c1.r) * factor,
          c1.g + (c2.g - c1.g) * factor,
          c1.b + (c2.b - c1.b) * factor
        );
      }
    }
    return stops[stops.length - 1].color.clone();
  }, []);

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    const theme = getTheme(activeTheme);
    scene.background = new THREE.Color(theme.bg);
    scene.fog = new THREE.FogExp2(theme.bg, 0.005);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -95, 95);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and preserveDrawingBuffer for export snapshots
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxDistance = 320;
    controls.minDistance = 25;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above grid floor
    controlsRef.current = controls;

    // 5. Lighting tuned for clean light theme tactile depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(60, -80, 100);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.8);
    dirLight2.position.set(-80, 60, 80);
    scene.add(dirLight2);

    const rimLight = new THREE.PointLight(0xffffff, 0.9, 150);
    rimLight.position.set(0, 0, 80);
    scene.add(rimLight);

    // 6. Subtle Floor Grid
    const gridHelper = new THREE.GridHelper(160, 32, 0xcbd5e1, 0xe2e8f0);
    gridHelper.rotation.x = Math.PI / 2;
    gridHelper.position.z = -1;
    scene.add(gridHelper);
    gridHelperRef.current = gridHelper;


    // 7. Group for Minutiae Holograms
    const minutiaeGroup = new THREE.Group();
    scene.add(minutiaeGroup);
    minutiaeGroupRef.current = minutiaeGroup;

    // 8. Animation Loop
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      // Auto rotation
      if (autoRotate && controlsRef.current) {
        scene.rotation.z += 0.003 * rotateSpeed;
      }

      controls.update();
      renderer.render(scene, camera);

      // FPS Calculation
      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsCalc.current >= 1000) {
        const fps = Math.round((frameCount.current * 1000) / (now - lastFpsCalc.current));
        frameCount.current = 0;
        lastFpsCalc.current = now;
        if (onFpsUpdate) onFpsUpdate(fps);
      }
    };
    animate();

    // 9. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0]) return;
      const { width: newW, height: newH } = entries[0].contentRect;
      if (newW > 0 && newH > 0 && cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = newW / newH;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(newW, newH);
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
    };
  }, []);

  // Update Scene Theme Background and Lights
  useEffect(() => {
    if (!sceneRef.current) return;
    const theme = getTheme(activeTheme);
    sceneRef.current.background = new THREE.Color(theme.bg);
    sceneRef.current.fog = new THREE.FogExp2(theme.bg, 0.004);
  }, [activeTheme]);

  // Build / Update Topographic Mesh whenever frameData or elevationScale changes
  useEffect(() => {
    if (!sceneRef.current || !frameData || !frameData.data) return;

    const scene = sceneRef.current;
    const { data, width, height, minutiae } = frameData;

    // Remove old mesh & points
    if (meshRef.current) {
      scene.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach(m => m.dispose());
      } else {
        meshRef.current.material.dispose();
      }
      meshRef.current = null;
    }
    if (pointsRef.current) {
      scene.remove(pointsRef.current);
      pointsRef.current.geometry.dispose();
      pointsRef.current.material.dispose();
      pointsRef.current = null;
    }

    // Target mesh dimensions in 3D world units
    const meshW = 75;
    const meshH = (meshW / width) * height;
    const segX = width - 1;
    const segY = height - 1;

    // Create Plane Geometry
    const geometry = new THREE.PlaneGeometry(meshW, meshH, segX, segY);
    const posAttr = geometry.attributes.position;
    const count = posAttr.count;

    // Vertex colors array for heightfield gradient
    const colors = new Float32Array(count * 3);
    const maxElevation = 14.0 * elevationScale;

    // Displace vertices Z based on pixel brightness
    for (let i = 0; i < count; i++) {
      // Coordinate indexing
      const xi = i % (segX + 1);
      const yi = segY - Math.floor(i / (segX + 1)); // Invert Y to match raster scan
      const pixelIdx = yi * width + xi;

      const brightness = data[pixelIdx] !== undefined ? data[pixelIdx] : 0;
      const normalized = brightness / 255;

      // Ridge height elevation
      const z = normalized * maxElevation;
      posAttr.setZ(i, z);

      // Color based on theme gradient
      const c = getElevationColor(normalized, activeTheme);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();

    const theme = getTheme(activeTheme);

    // Render Mode Selection
    if (renderMode === 'points') {
      // LiDAR Point Cloud Mode
      const pMat = new THREE.PointsMaterial({
        size: 1.2,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending
      });
      const points = new THREE.Points(geometry, pMat);
      scene.add(points);
      pointsRef.current = points;
    } else {
      // Solid / Wireframe / Contour
      const isWire = renderMode === 'wireframe';
      const material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: theme.material.roughness,
        metalness: theme.material.metalness,
        wireframe: isWire,
        side: THREE.DoubleSide,
        flatShading: renderMode === 'contour'
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      meshRef.current = mesh;
    }

    // Update Holographic 3D Minutiae Pins
    if (minutiaeGroupRef.current) {
      // Clear old markers
      while (minutiaeGroupRef.current.children.length > 0) {
        const obj = minutiaeGroupRef.current.children[0];
        minutiaeGroupRef.current.remove(obj);
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      }

      if (showMinutiae && minutiae && minutiae.length > 0) {
        minutiae.forEach((m) => {
          // Map (m.x, m.y) to 3D mesh space
          const worldX = (m.x / width - 0.5) * meshW;
          const worldY = (0.5 - m.y / height) * meshH;
          const worldZ = m.elevation * maxElevation + 1.2;

          const isBifurcation = m.type === 'bifurcation';
          const pinColor = isBifurcation ? 0xe11d48 : 0x0284c7;

          // Holographic Pin Sphere
          const sphereGeo = new THREE.SphereGeometry(0.7, 12, 12);
          const sphereMat = new THREE.MeshBasicMaterial({
            color: pinColor,
            wireframe: false
          });
          const marker = new THREE.Mesh(sphereGeo, sphereMat);
          marker.position.set(worldX, worldY, worldZ);

          // Projected vertical line to base
          const lineGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(worldX, worldY, 0),
            new THREE.Vector3(worldX, worldY, worldZ)
          ]);
          const lineMat = new THREE.LineBasicMaterial({
            color: pinColor,
            transparent: true,
            opacity: 0.45
          });
          const line = new THREE.Line(lineGeo, lineMat);

          minutiaeGroupRef.current.add(marker);
          minutiaeGroupRef.current.add(line);
        });
      }
    }
  }, [frameData, elevationScale, activeTheme, renderMode, showMinutiae, getElevationColor]);

  // Camera Presets
  const setCameraPreset = (preset) => {
    if (!cameraRef.current || !controlsRef.current || !sceneRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    sceneRef.current.rotation.z = 0; // Reset rotation offset

    switch (preset) {
      case 'top':
        camera.position.set(0, 0, 110);
        break;
      case 'iso':
        camera.position.set(0, -95, 95);
        break;
      case 'ridge':
        camera.position.set(0, -115, 25);
        break;
      case 'macro':
        camera.position.set(0, -45, 38);
        break;
      default:
        camera.position.set(0, -95, 95);
    }
    controls.target.set(0, 0, 4);
    controls.update();
  };

  const handleResetView = () => {
    setCameraPreset('iso');
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[400px] md:h-[460px] bg-slate-50/50 rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm flex flex-col"
    >
      {/* 3D WebGL Canvas */}
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block cursor-grab active:cursor-grabbing outline-none"
      />

      {/* Top Overlay Header */}
      <div className="absolute top-3.5 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs font-mono pointer-events-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-800 font-bold tracking-tight">3D TOPOGRAPHY</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            {frameData ? `${frameData.width}×${frameData.height}` : 'STANDBY'}
          </span>
          <span className="text-slate-300 hidden sm:inline">|</span>
          <span className="text-slate-600 hidden sm:inline">
            DEPTH: {elevationScale.toFixed(1)}x
          </span>
        </div>

        {/* Top-Right Controls */}
        <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1 rounded-full border border-slate-200 shadow-sm pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            title={autoRotate ? 'Pause Rotation' : 'Auto-Rotate Mesh'}
            className={`p-1.5 rounded-full transition-colors ${
              autoRotate ? 'text-slate-900 bg-slate-100 font-bold' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {autoRotate ? <Pause size={15} /> : <Play size={15} />}
          </button>

          <button
            onClick={handleResetView}
            title="Reset Camera View"
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 transition-colors"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>

          <button
            onClick={() => {
              setShowControlsDrawer(!showControlsDrawer);
            }}
            title="Fine-Tune Depth & Shading"
            className={`p-1.5 rounded-full transition-colors ${
              showControlsDrawer ? 'text-white bg-slate-900' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Sliders size={15} />
          </button>
        </div>
      </div>

      {/* Camera Presets Bar */}
      <div className="absolute top-14 left-4 flex flex-wrap gap-1 bg-white/90 backdrop-blur-md p-1 rounded-full border border-slate-200 shadow-sm z-10 text-[11px] font-mono">
        <button
          onClick={() => setCameraPreset('top')}
          className="px-2.5 py-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          2D TOP
        </button>
        <button
          onClick={() => setCameraPreset('iso')}
          className="px-2.5 py-1 rounded-full bg-slate-900 text-white font-bold transition shadow-xs"
        >
          45° ISO
        </button>
        <button
          onClick={() => setCameraPreset('ridge')}
          className="px-2.5 py-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          PROFILE
        </button>
        <button
          onClick={() => setCameraPreset('macro')}
          className="px-2.5 py-1 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
        >
          CORE
        </button>
      </div>

      {/* Theme Filters Ribbon (Bottom Left) */}
      <div className="absolute bottom-3.5 left-4 right-4 sm:right-auto flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm z-10 overflow-x-auto max-w-full">
        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider px-2 hidden sm:inline">
          PALETTE:
        </span>
        {THEME_LIST.map((th) => (
          <button
            key={th.id}
            onClick={() => {
              if (onThemeChange) onThemeChange(th.id);
            }}
            className={`px-3 py-1 text-xs rounded-full font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTheme === th.id
                ? 'bg-slate-900 text-white font-semibold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <span 
              className="w-2.5 h-2.5 rounded-full inline-block border border-slate-300"
              style={{ backgroundColor: '#' + th.colors[th.colors.length - 1].color.getHexString() }}
            />
            {th.name}
          </button>
        ))}
      </div>

      {/* 3D Export Actions (Bottom Right) */}
      <div className="absolute bottom-3.5 right-4 hidden sm:flex items-center gap-1.5 bg-white/90 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 shadow-sm z-10">
        <button
          onClick={() => {
            downloadCanvasSnapshot(canvasRef.current);
          }}
          title="Save Snapshot PNG"
          className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono flex items-center gap-1 transition"
        >
          <Camera size={13} />
          <span>PNG</span>
        </button>

        <button
          onClick={() => {
            if (!frameData) return;
            exportToSTL(frameData.data, frameData.width, frameData.height, elevationScale);
          }}
          title="Export STL for 3D Printing"
          className="px-3 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-mono font-semibold flex items-center gap-1 transition shadow-xs"
        >
          <Download size={13} />
          <span>STL (3D PRINT)</span>
        </button>

        <button
          onClick={() => {
            if (!frameData) return;
            exportToOBJ(frameData.data, frameData.width, frameData.height, elevationScale);
          }}
          title="Export OBJ 3D Model"
          className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono flex items-center gap-1 transition"
        >
          <Box size={13} />
          <span>OBJ</span>
        </button>
      </div>

      {/* Fine-Tuning Drawer */}
      {showControlsDrawer && (
        <div className="absolute top-14 right-4 w-72 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-4 z-20 shadow-xl text-xs font-mono text-slate-800">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <span className="font-bold text-slate-900 tracking-tight">3D MESH TUNING</span>
            <button 
              onClick={() => setShowControlsDrawer(false)}
              className="text-slate-400 hover:text-slate-800"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="text-slate-500">Elevation Depth:</span>
              <span className="text-slate-900 font-bold">{elevationScale.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="4.0"
              step="0.1"
              value={elevationScale}
              onChange={(e) => setElevationScale(parseFloat(e.target.value))}
              className="w-full accent-slate-900 cursor-pointer"
            />
          </div>

          <div className="mb-4">
            <span className="text-slate-500 block mb-1.5">Surface Shading:</span>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'solid', label: 'Ceramic Solid' },
                { id: 'contour', label: 'Contour Facets' },
                { id: 'wireframe', label: 'Wireframe Grid' },
                { id: 'points', label: 'LiDAR Points' }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => {
                    setRenderMode(mode.id);
                  }}
                  className={`p-1.5 rounded-lg border text-center transition ${
                    renderMode === mode.id
                      ? 'border-slate-900 bg-slate-900 text-white font-bold'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {autoRotate && (
            <div className="mb-4">
              <div className="flex justify-between mb-1">
                <span className="text-slate-500">Rotation Velocity:</span>
                <span className="text-slate-900">{rotateSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="5.0"
                step="0.5"
                value={rotateSpeed}
                onChange={(e) => setRotateSpeed(parseFloat(e.target.value))}
                className="w-full accent-slate-900 cursor-pointer"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-slate-500">Sub-Floor Grid:</span>
            <input
              type="checkbox"
              checked={gridVisible}
              onChange={(e) => {
                setGridVisible(e.target.checked);
                if (gridHelperRef.current) {
                  gridHelperRef.current.visible = e.target.checked;
                }
              }}
              className="accent-slate-900 cursor-pointer w-4 h-4"
            />
          </div>
        </div>
      )}
    </div>
  );
}

