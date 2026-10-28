import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { formatDistanceToNow } from 'date-fns';
import { Maximize2, Minimize2, RotateCcw, Eye, Layers, Compass, ZoomIn, ZoomOut, X, Sparkles } from 'lucide-react';
import { OrbitraLogo, GyroIcon } from '../common/OrbitraLogo';

interface Props {
  title?: string;
}

type InspectDisplayMode = 'solid' | 'wireframe' | 'subsystems';

interface SubsystemInfo {
  id: string;
  name: string;
  callsign: string;
  description: string;
  specs: string;
  position: [number, number, number];
}

const SUBSYSTEMS: SubsystemInfo[] = [
  {
    id: 'solar',
    name: 'Photovoltaic Solar Arrays',
    callsign: 'EPS-PV-1U',
    description: 'Triple-junction InGaP/GaAs/Ge solar cells with 29.5% efficiency rating.',
    specs: '2.4W Nominal · 4.2V Bus · Peak Albedo Harvest',
    position: [0.75, 0, 0],
  },
  {
    id: 'antenna',
    name: 'Deployable UHF Monopole',
    callsign: 'COMM-ANT-437',
    description: 'Quarter-wave spring-steel antenna deployed via thermal wire burn mechanism.',
    specs: '437.500 MHz · GFSK 19.2 kbps · Link Margin +9.4 dB',
    position: [0.4, 1.1, 0.4],
  },
  {
    id: 'imu',
    name: 'Avionics & 6-DoF IMU Bus',
    callsign: 'ADCS-MPU6050',
    description: 'MEMS 3-axis accelerometer and rate gyro coupled with Kalman filter attitude estimation.',
    specs: '±250°/s · ±2g Range · 100 Hz Bus Rate',
    position: [0, 0, 0],
  },
  {
    id: 'payload',
    name: 'Optical Multispectral Camera',
    callsign: 'PLD-CAM-RGB',
    description: 'Earth-observation aperture for multispectral cloud and ground tracking imagery.',
    specs: 'F/2.8 Aperture · 12-bit CMOS · Nadir Pointing',
    position: [0, 0, 0.74],
  },
  {
    id: 'frame',
    name: 'Al-6061-T6 Space Chassis',
    callsign: 'STR-1U-CHASSIS',
    description: 'Hard-anodized aerospace aluminum chassis compliant with NASA CubeSat Standard.',
    specs: '100x100x113.5 mm · Mass 280g · Rail Hard-Coat',
    position: [-0.7, 0.7, 0.7],
  },
];

export function CubeSatViewer({ title = 'CubeSat Attitude 3D' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Live telemetry
  const roll = useTelemetryStore(s => s.latestValues['mpu6050.roll'] ?? null);
  const pitch = useTelemetryStore(s => s.latestValues['mpu6050.pitch'] ?? null);
  const ax = useTelemetryStore(s => s.latestValues['mpu6050.ax'] ?? s.latestValues['mpu6050.accel_x'] ?? null);
  const ay = useTelemetryStore(s => s.latestValues['mpu6050.ay'] ?? s.latestValues['mpu6050.accel_y'] ?? null);
  const az = useTelemetryStore(s => s.latestValues['mpu6050.az'] ?? s.latestValues['mpu6050.accel_z'] ?? null);
  const mpuTimestamp = useTelemetryStore(s => s.latestTimestamps['mpu6050.roll'] ?? s.latestTimestamps['mpu6050.ax'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);

  // State
  const [webGlSupported, setWebGlSupported] = useState(true);
  const [isInspecting, setIsInspecting] = useState(false);
  const [displayMode, setDisplayMode] = useState<InspectDisplayMode>('solid');
  const [activeSubsystem, setActiveSubsystem] = useState<SubsystemInfo | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // References for Three.js state
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const satGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialsRef = useRef<{ chassis: THREE.MeshStandardMaterial; solar: THREE.MeshStandardMaterial } | null>(null);

  // 3d-orbit-inspect-demo specific state
  const isInspectingRef = useRef(false);
  isInspectingRef.current = isInspecting;

  // Hover lean state (camera lean with gain tau 0.3s, az +-0.30, el +-0.09)
  const hoverGain = useRef(0);
  const hoverTarget = useRef({ az: 0, el: 0 });
  const hoverCurrent = useRef({ az: 0, el: 0 });

  // Inspect hand turn & damping state
  const isDragging = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0, time: 0 });
  const dragDelta = useRef({ x: 0, y: 0 });
  const spinVelocity = useRef({ x: 0, y: 0 });
  const lastInteractionTime = useRef(Date.now());
  const inspectRotation = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const inspectZoom = useRef(1.0);

  // Update target euler from live telemetry
  useEffect(() => {
    if (roll !== null && pitch !== null) {
      const radPitch = THREE.MathUtils.degToRad(-pitch);
      const radRoll = THREE.MathUtils.degToRad(roll);
      targetEuler.current.set(radPitch, 0, radRoll, 'YXZ');
    }
  }, [roll, pitch]);

  // Handle display mode toggles (Solid vs Wireframe)
  useEffect(() => {
    if (!materialsRef.current) return;
    const isWire = displayMode === 'wireframe';
    materialsRef.current.chassis.wireframe = isWire;
    materialsRef.current.solar.wireframe = isWire;
  }, [displayMode]);

  // Main Three.js Scene Setup & Animation Loop
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) { setWebGlSupported(false); return; }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 300;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Pure AMOLED pitch black

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(2.8, 2.0, 3.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    // High-contrast clean aerospace lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const sunKeyLight = new THREE.DirectionalLight(0xffffff, 2.8);
    sunKeyLight.position.set(8, 10, 7);
    scene.add(sunKeyLight);

    const earthAlbedoRim = new THREE.DirectionalLight(0x38bdf8, 1.1);
    earthAlbedoRim.position.set(-7, -4, -6);
    scene.add(earthAlbedoRim);

    // Root spacecraft assembly group
    const satGroup = new THREE.Group();
    satGroupRef.current = satGroup;
    scene.add(satGroup);

    // ── Build Precision 1U CubeSat ──────────────────────────────────────────
    // 1. Chassis
    const chassisGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x111115,
      metalness: 0.9,
      roughness: 0.25,
      wireframe: false,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    satGroup.add(chassis);

    // 2. Solar Panels
    const solarGeo = new THREE.PlaneGeometry(1.22, 1.22);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x0a1628,
      metalness: 0.85,
      roughness: 0.1,
      wireframe: false,
    });
    materialsRef.current = { chassis: chassisMat, solar: solarMat };

    const addSolarPanel = (pos: [number, number, number], rot: [number, number, number]) => {
      const p = new THREE.Mesh(solarGeo, solarMat);
      p.position.set(...pos);
      p.rotation.set(...rot);
      satGroup.add(p);
    };

    addSolarPanel([0, 0, 0.705], [0, 0, 0]);           // +Z Face
    addSolarPanel([0, 0, -0.705], [0, Math.PI, 0]);    // -Z Face
    addSolarPanel([0.705, 0, 0], [0, Math.PI / 2, 0]); // +X Face
    addSolarPanel([-0.705, 0, 0], [0, -Math.PI / 2, 0]);// -X Face

    // 3. Gold Corner Guide Rails
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.2,
    });
    const railThick = 0.08;
    const railLen = 1.42;

    const createRail = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const geo = new THREE.BoxGeometry(railThick, railLen, railThick);
      const m = new THREE.Mesh(geo, railMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      satGroup.add(m);
    };

    createRail(0.7, 0, 0.7);
    createRail(-0.7, 0, 0.7);
    createRail(0.7, 0, -0.7);
    createRail(-0.7, 0, -0.7);
    createRail(0, 0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, 0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(0.7, -0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, -0.7, 0, Math.PI / 2, 0, 0);

    // 4. Optical Camera Lens on +Z
    const lensRingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24);
    const lensRingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const lensRing = new THREE.Mesh(lensRingGeo, lensRingMat);
    lensRing.position.set(0, 0, 0.74);
    lensRing.rotation.x = Math.PI / 2;
    satGroup.add(lensRing);

    const lensGlassGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.09, 24);
    const lensGlassMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.98, roughness: 0.05 });
    const lensGlass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
    lensGlass.position.set(0, 0, 0.74);
    lensGlass.rotation.x = Math.PI / 2;
    satGroup.add(lensGlass);

    // 5. Deployable Monopole Antenna
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.85, 12);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.1 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0.4, 1.1, 0.4);
    satGroup.add(antenna);

    // 6. Inertial reference axes
    const axes = new THREE.AxesHelper(1.2);
    satGroup.add(axes);

    // 7. Coordinate floor grid
    const grid = new THREE.GridHelper(9, 18, 0x27272a, 0x18181b);
    grid.position.y = -1.6;
    scene.add(grid);

    // ── Animation Loop (Implements 3d-orbit-inspect-demo rules) ──────────────
    let animationFrameId: number;
    let lastTime = performance.now();

    const baseCamPos = new THREE.Vector3(2.8, 2.0, 3.8);

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      if (!isInspectingRef.current) {
        // ── REST / FLIGHT MODE ───────────────────────────────────────────────
        // 1. Follow live telemetry target with smooth damping
        currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, 0.12);
        currentEuler.current.y = THREE.MathUtils.lerp(currentEuler.current.y, targetEuler.current.y, 0.12);
        currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, 0.12);
        satGroup.rotation.copy(currentEuler.current);

        // 2. 3d-orbit-inspect-demo rule: Damped hover camera lean (azimuth ±0.30, elevation ±0.09)
        const dampFactor = 1 - Math.exp(-4.5 * dt);
        hoverCurrent.current.az += (hoverTarget.current.az * hoverGain.current - hoverCurrent.current.az) * dampFactor;
        hoverCurrent.current.el += (hoverTarget.current.el * hoverGain.current - hoverCurrent.current.el) * dampFactor;

        // Apply lean in spherical coordinates around origin
        const radius = baseCamPos.length();
        const basePhi = Math.acos(baseCamPos.y / radius);
        const baseTheta = Math.atan2(baseCamPos.x, baseCamPos.z);

        const newTheta = baseTheta + hoverCurrent.current.az;
        const newPhi = THREE.MathUtils.clamp(basePhi + hoverCurrent.current.el, 0.2, Math.PI - 0.2);

        camera.position.x = radius * Math.sin(newPhi) * Math.sin(newTheta);
        camera.position.y = radius * Math.cos(newPhi);
        camera.position.z = radius * Math.sin(newPhi) * Math.cos(newTheta);
        camera.lookAt(0, 0, 0);

      } else {
        // ── INSPECT MODE ("IN THE HAND") ─────────────────────────────────────
        // 1. Inertial coasting and spin damping (exp(-2.4 * dt))
        if (!isDragging.current) {
          const timeSinceInteraction = Date.now() - lastInteractionTime.current;
          if (timeSinceInteraction > 2200) {
            // Idle turn: 0.26 rad/s
            inspectRotation.current.y += 0.26 * dt;
          } else {
            // Coast with spin damping
            const spinDamp = Math.exp(-2.4 * dt);
            spinVelocity.current.x *= spinDamp;
            spinVelocity.current.y *= spinDamp;

            inspectRotation.current.y += spinVelocity.current.x * dt;
            inspectRotation.current.x += spinVelocity.current.y * dt;
            inspectRotation.current.x = THREE.MathUtils.clamp(inspectRotation.current.x, -Math.PI / 2.2, Math.PI / 2.2);
          }
        }

        // Apply inspection rotation to satellite
        satGroup.rotation.copy(inspectRotation.current);

        // Apply inspect zoom dolly
        const inspectRadius = 3.8 / inspectZoom.current;
        camera.position.set(0, 0, inspectRadius);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w > 0 && h > 0) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    });

    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // ── 3d-orbit-inspect-demo Pointer Handlers ────────────────────────────────
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (!isInspecting) {
      // Rule: Hover lean gain rises while pointer is on canvas; target is clamped relative to piece center
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      hoverGain.current = 1.0;
      hoverTarget.current = {
        az: THREE.MathUtils.clamp(px * 0.30, -0.30, 0.30),
        el: THREE.MathUtils.clamp(-py * 0.09, -0.09, 0.09),
      };
    } else {
      // In inspect mode: drag-to-turn (0.0085 rad/px horizontal, 0.0065 rad/px vertical)
      if (isDragging.current) {
        const dx = e.clientX - dragDelta.current.x;
        const dy = e.clientY - dragDelta.current.y;
        dragDelta.current = { x: e.clientX, y: e.clientY };

        const radX = dx * 0.0085;
        const radY = dy * 0.0065;

        inspectRotation.current.y += radX;
        inspectRotation.current.x += radY;
        inspectRotation.current.x = THREE.MathUtils.clamp(inspectRotation.current.x, -Math.PI / 2.2, Math.PI / 2.2);

        spinVelocity.current = { x: radX * 35, y: radY * 35 };
        lastInteractionTime.current = Date.now();
      }
    }
  };

  const handlePointerLeave = () => {
    hoverGain.current = 0.0;
    hoverTarget.current = { az: 0, el: 0 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStart.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    if (isInspecting) {
      isDragging.current = true;
      dragDelta.current = { x: e.clientX, y: e.clientY };
      spinVelocity.current = { x: 0, y: 0 };
      lastInteractionTime.current = Date.now();
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInspecting) {
      // Rule 5: Under 6px and under 600ms opens inspect mode
      const dx = Math.abs(e.clientX - pointerStart.current.x);
      const dy = Math.abs(e.clientY - pointerStart.current.y);
      const dt = Date.now() - pointerStart.current.time;
      if (dx < 6 && dy < 6 && dt < 600) {
        openInspect();
      }
    } else {
      isDragging.current = false;
    }
  };

  // Zoom Dolly with Wheel
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isInspecting) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newZoom = THREE.MathUtils.clamp(inspectZoom.current * factor, 0.70, 1.85);
    inspectZoom.current = newZoom;
    setZoomLevel(newZoom);
    lastInteractionTime.current = Date.now();
  };

  // Open & Close Inspect Transitions
  const openInspect = useCallback(() => {
    setIsInspecting(true);
    inspectZoom.current = 1.0;
    setZoomLevel(1.0);
    inspectRotation.current.copy(currentEuler.current);
    spinVelocity.current = { x: 0, y: 0 };
    lastInteractionTime.current = Date.now();
  }, []);

  const closeInspect = useCallback(() => {
    setIsInspecting(false);
    setActiveSubsystem(null);
    hoverGain.current = 0;
  }, []);

  // Keyboard Navigation in Inspect Mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isInspecting) return;
      if (e.key === 'Escape') {
        closeInspect();
      } else if (e.key === 'ArrowLeft') {
        inspectRotation.current.y -= 0.14;
        lastInteractionTime.current = Date.now();
      } else if (e.key === 'ArrowRight') {
        inspectRotation.current.y += 0.14;
        lastInteractionTime.current = Date.now();
      } else if (e.key === 'ArrowUp') {
        inspectRotation.current.x -= 0.14;
        lastInteractionTime.current = Date.now();
      } else if (e.key === 'ArrowDown') {
        inspectRotation.current.x += 0.14;
        lastInteractionTime.current = Date.now();
      } else if (e.key === '+' || e.key === '=') {
        inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current * 1.15, 0.7, 1.85);
        setZoomLevel(inspectZoom.current);
      } else if (e.key === '-' || e.key === '_') {
        inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current / 1.15, 0.7, 1.85);
        setZoomLevel(inspectZoom.current);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isInspecting, closeInspect]);

  // Compute status
  const isStale = connState === 'stale' || (mpuTimestamp && Date.now() - mpuTimestamp > 10000);
  const isLive = (roll !== null || ax !== null) && connState === 'connected' && !isStale;
  const statusLabel = isLive ? 'LIVE ORIENTATION' : isStale ? 'STALE LINK' : 'SIMULATED ATTITUDE';

  if (!webGlSupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-black rounded-lg border border-white/10 font-mono">
        <OrbitraLogo size={32} className="opacity-40 mb-2" />
        <p className="text-white font-semibold text-xs uppercase tracking-wider">WebGL Offline</p>
        <p className="text-zinc-500 text-[11px] mt-1 max-w-xs">Hardware acceleration required for 3D attitude inspection.</p>
      </div>
    );
  }

  return (
    <div
      className={`h-full flex flex-col relative bg-black overflow-hidden select-none font-mono ${
        isInspecting ? 'fixed inset-0 z-50 p-4 bg-black/95' : ''
      }`}
      onWheel={handleWheel}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={mountRef}
        className={`flex-1 w-full min-h-0 relative ${isInspecting ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      />

      {/* ── Flight HUD Overlay (Rest Mode) ─────────────────────────────────── */}
      {!isInspecting ? (
        <>
          {/* Top-left Telemetry Vector HUD */}
          <div className="absolute top-2.5 left-2.5 pointer-events-none">
            <div className="flex items-center gap-2 mb-1">
              <OrbitraLogo size={15} />
              <span className="text-[10px] font-bold uppercase tracking-wider text-white">
                CUBESAT 1U
              </span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${
                isLive
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/30'
              }`}>
                {statusLabel}
              </span>
            </div>

            <div className="rounded-lg p-2 text-[11px] space-y-1 bg-black/85 border border-white/10 shadow-2xl backdrop-blur-none">
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">ROLL (φ):</span>
                <span className="text-sky-300 font-bold tabular-nums">
                  {roll !== null ? `${roll > 0 ? '+' : ''}${roll.toFixed(1)}°` : '0.0°'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-400">PITCH (θ):</span>
                <span className="text-sky-300 font-bold tabular-nums">
                  {pitch !== null ? `${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}°` : '0.0°'}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-zinc-500">YAW (ψ):</span>
                <span className="text-zinc-500">INERTIAL</span>
              </div>
              {ax !== null && (
                <div className="pt-1 border-t border-white/[0.08] flex justify-between gap-3 text-[10px] text-zinc-400">
                  <span>ACCEL:</span>
                  <span className="text-emerald-400 font-medium tabular-nums">
                    {ax.toFixed(2)}, {ay?.toFixed(2) ?? '0'}, {az?.toFixed(2) ?? '0'} G
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Top-right "Inspect Spacecraft" Click Cue Button */}
          <div className="absolute top-2.5 right-2.5">
            <button
              onClick={openInspect}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/80 hover:bg-zinc-900 border border-white/10 hover:border-white/20 text-white text-[11px] uppercase tracking-wider font-semibold transition-all shadow-lg inspect-cue-pill"
              title="Enter full interactive 3D inspection mode"
            >
              <Maximize2 size={12} className="text-sky-400" />
              <span>Inspect Orbit</span>
            </button>
          </div>

          {/* Bottom Hover Cue Pill */}
          <div className="absolute bottom-2 left-2.5 pointer-events-none text-[10px] text-zinc-500 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 animate-pulse" />
            <span>Hover to lean camera · Click to enter 3D inspect</span>
          </div>
        </>
      ) : (
        /* ── Full Interactive 3D Inspect Mode Overlay ("Picked up in hand") ── */
        <>
          {/* Header Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3">
              <OrbitraLogo size={24} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    SPACECRAFT ORBITAL INSPECTION
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 border border-sky-400/30 text-sky-300 font-semibold uppercase">
                    3D INSPECT ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Drag to turn 360° · Wheel/pinch to zoom · Arrow keys · Esc to dock
                </p>
              </div>
            </div>

            {/* Inspect Actions */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {/* Display Mode Switcher */}
              <div className="flex bg-[#0c0c0e] border border-white/10 rounded-lg p-0.5 text-xs">
                <button
                  onClick={() => setDisplayMode('solid')}
                  className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-wider transition-colors ${
                    displayMode === 'solid' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Solid Hull
                </button>
                <button
                  onClick={() => setDisplayMode('wireframe')}
                  className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-wider transition-colors ${
                    displayMode === 'wireframe' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Wireframe CAD
                </button>
                <button
                  onClick={() => setDisplayMode('subsystems')}
                  className={`px-2.5 py-1 rounded text-[11px] uppercase tracking-wider transition-colors ${
                    displayMode === 'subsystems' ? 'bg-white text-black font-semibold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Subsystems
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={closeInspect}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold uppercase tracking-wider transition-colors shadow-md"
              >
                <X size={14} /> Close [ESC]
              </button>
            </div>
          </div>

          {/* Subsystem Hotspots (When Subsystems Mode is selected) */}
          {displayMode === 'subsystems' && (
            <div className="absolute left-6 top-24 w-80 space-y-2 pointer-events-auto max-h-[75vh] overflow-y-auto pr-1">
              <div className="text-[10px] text-sky-400 font-semibold uppercase tracking-wider mb-1">
                Subsystem Bus Registry
              </div>
              {SUBSYSTEMS.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => setActiveSubsystem(sub)}
                  className={`p-2.5 rounded-lg border transition-all cursor-pointer ${
                    activeSubsystem?.id === sub.id
                      ? 'bg-sky-500/10 border-sky-400 text-white shadow-lg'
                      : 'bg-black/80 border-white/10 text-zinc-300 hover:border-white/20 hover:bg-zinc-900/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-white">{sub.name}</span>
                    <span className="text-[10px] text-sky-400">{sub.callsign}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{sub.description}</p>
                  <p className="text-[10px] text-emerald-400 font-mono mt-1 pt-1 border-t border-white/[0.06]">{sub.specs}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Precision Controls & Camera Telemetry */}
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between pointer-events-none">
            {/* Live Euler Angles while inspecting */}
            <div className="rounded-lg px-3 py-2 bg-black/85 border border-white/10 text-xs text-zinc-300 flex items-center gap-4">
              <span>ROT X: <strong className="text-white font-mono">{THREE.MathUtils.radToDeg(inspectRotation.current.x).toFixed(1)}°</strong></span>
              <span>ROT Y: <strong className="text-white font-mono">{THREE.MathUtils.radToDeg(inspectRotation.current.y).toFixed(1)}°</strong></span>
              <span>DOLLY: <strong className="text-sky-400 font-mono">{(zoomLevel * 100).toFixed(0)}%</strong></span>
            </div>

            {/* Quick Camera Dolly & Reset Controls */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => {
                  inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current * 1.15, 0.7, 1.85);
                  setZoomLevel(inspectZoom.current);
                }}
                className="p-2 rounded-lg bg-black border border-white/10 hover:border-white/20 text-white transition-colors"
                title="Zoom in (+)"
              >
                <ZoomIn size={14} />
              </button>
              <button
                onClick={() => {
                  inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current / 1.15, 0.7, 1.85);
                  setZoomLevel(inspectZoom.current);
                }}
                className="p-2 rounded-lg bg-black border border-white/10 hover:border-white/20 text-white transition-colors"
                title="Zoom out (-)"
              >
                <ZoomOut size={14} />
              </button>
              <button
                onClick={() => {
                  inspectRotation.current.set(0, 0, 0);
                  inspectZoom.current = 1.0;
                  setZoomLevel(1.0);
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black border border-white/10 hover:border-white/20 text-white text-xs uppercase tracking-wider transition-colors"
                title="Reset view angles"
              >
                <RotateCcw size={12} /> Reset View
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
