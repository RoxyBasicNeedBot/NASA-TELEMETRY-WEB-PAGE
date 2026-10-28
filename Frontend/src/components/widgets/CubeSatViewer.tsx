import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { formatDistanceToNow } from 'date-fns';
import { Compass, AlertTriangle } from 'lucide-react';

interface Props {
  title?: string;
}

export function CubeSatViewer({ title = 'CubeSat Attitude 3D' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  // Live telemetry subscriptions
  const roll = useTelemetryStore(s => s.latestValues['mpu6050.roll'] ?? null);
  const pitch = useTelemetryStore(s => s.latestValues['mpu6050.pitch'] ?? null);
  const ax = useTelemetryStore(s => s.latestValues['mpu6050.ax'] ?? s.latestValues['mpu6050.accel_x'] ?? null);
  const ay = useTelemetryStore(s => s.latestValues['mpu6050.ay'] ?? s.latestValues['mpu6050.accel_y'] ?? null);
  const az = useTelemetryStore(s => s.latestValues['mpu6050.az'] ?? s.latestValues['mpu6050.accel_z'] ?? null);
  const mpuTimestamp = useTelemetryStore(s => s.latestTimestamps['mpu6050.roll'] ?? s.latestTimestamps['mpu6050.ax'] ?? null);
  const connState = useTelemetryStore(s => s.connectionState);

  const [webGlSupported, setWebGlSupported] = useState(true);

  // References for animation loop
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const satelliteGroupRef = useRef<THREE.Group | null>(null);

  // Update target angles whenever live telemetry changes
  useEffect(() => {
    if (roll !== null && pitch !== null) {
      const radPitch = THREE.MathUtils.degToRad(-pitch);
      const radRoll = THREE.MathUtils.degToRad(roll);
      targetEuler.current.set(radPitch, 0, radRoll, 'YXZ');
    }
  }, [roll, pitch]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Check WebGL availability
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setWebGlSupported(false);
        return;
      }
    } catch {
      setWebGlSupported(false);
      return;
    }

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 200;

    // Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030206);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(2.8, 2.2, 3.5);
    camera.lookAt(0, 0, 0);

    // Renderer with optimized pixel ratio (capped at 1.5 for 60fps)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    // Solar illumination & Earth albedo
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 2.4);
    sunLight.position.set(6, 8, 6);
    scene.add(sunLight);

    const earthAlbedo = new THREE.DirectionalLight(0x38bdf8, 0.7);
    earthAlbedo.position.set(-6, -4, -5);
    scene.add(earthAlbedo);

    // ── Build 1U CubeSat Spacecraft Model ────────────────────────────────────
    const satGroup = new THREE.Group();
    satelliteGroupRef.current = satGroup;
    scene.add(satGroup);

    // 1. Chassis Body (anodized dark space frame with violet undertones)
    const chassisGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0x161226,
      roughness: 0.35,
      metalness: 0.85,
    });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    satGroup.add(chassis);

    // 2. Gold/Amber rails along 12 edges
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.9,
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

    // Vertical rails
    createRail(0.7, 0, 0.7);
    createRail(-0.7, 0, 0.7);
    createRail(0.7, 0, -0.7);
    createRail(-0.7, 0, -0.7);
    // Horizontal top/bottom rails
    createRail(0, 0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, 0.7, 0, 0, Math.PI / 2);
    createRail(0, 0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0, -0.7, -0.7, 0, 0, Math.PI / 2);
    createRail(0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, 0.7, 0, Math.PI / 2, 0, 0);
    createRail(0.7, -0.7, 0, Math.PI / 2, 0, 0);
    createRail(-0.7, -0.7, 0, Math.PI / 2, 0, 0);

    // 3. Solar Panels on faces (Deep crystalline indigo with high reflectivity)
    const solarGeo = new THREE.PlaneGeometry(1.2, 1.2);
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1e1548,
      roughness: 0.1,
      metalness: 0.85,
    });

    const addSolarPanel = (pos: [number, number, number], rot: [number, number, number]) => {
      const p = new THREE.Mesh(solarGeo, solarMat);
      p.position.set(...pos);
      p.rotation.set(...rot);
      satGroup.add(p);
    };

    addSolarPanel([0, 0, 0.71], [0, 0, 0]);           // +Z Face
    addSolarPanel([0, 0, -0.71], [0, Math.PI, 0]);    // -Z Face
    addSolarPanel([0.71, 0, 0], [0, Math.PI / 2, 0]); // +X Face
    addSolarPanel([-0.71, 0, 0], [0, -Math.PI / 2, 0]);// -X Face

    // 4. Optical Camera / Payload Aperture on +Z top-center
    const lensRingGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 24);
    const lensRingMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const lensRing = new THREE.Mesh(lensRingGeo, lensRingMat);
    lensRing.position.set(0, 0, 0.74);
    lensRing.rotation.x = Math.PI / 2;
    satGroup.add(lensRing);

    const lensGlassGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.09, 24);
    const lensGlassMat = new THREE.MeshStandardMaterial({ color: 0xc026d3, metalness: 0.95, roughness: 0.05 });
    const lensGlass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
    lensGlass.position.set(0, 0, 0.74);
    lensGlass.rotation.x = Math.PI / 2;
    satGroup.add(lensGlass);

    // 5. Deployable Monopole Antenna on top (+Y)
    const antennaGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.8, 12);
    const antennaMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.9, roughness: 0.1 });
    const antenna = new THREE.Mesh(antennaGeo, antennaMat);
    antenna.position.set(0.4, 1.1, 0.4);
    satGroup.add(antenna);

    // 6. 3D Body Axes (X=Red, Y=Green, Z=Blue)
    const axes = new THREE.AxesHelper(1.1);
    satGroup.add(axes);

    // Technical coordinate reference grid
    const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    grid.position.y = -1.5;
    scene.add(grid);

    // ── Animation Loop ───────────────────────────────────────────────────────
    let animationFrameId: number;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (satGroup) {
        currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, 0.12);
        currentEuler.current.y = THREE.MathUtils.lerp(currentEuler.current.y, targetEuler.current.y, 0.12);
        currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, 0.12);

        satGroup.rotation.copy(currentEuler.current);
      }

      renderer.render(scene, camera);
    };

    animate();

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

  // Compute status
  const isStale = connState === 'stale' || (mpuTimestamp && Date.now() - mpuTimestamp > 10000);
  const isLive = (roll !== null || ax !== null) && connState === 'connected' && !isStale;
  const statusLabel = isLive ? 'LIVE' : isStale ? 'STALE' : 'WAITING';
  const statusColor = isLive
    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    : isStale
    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
    : 'text-slate-400 bg-white/[0.04] border-white/10';

  if (!webGlSupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-black/60 rounded-xl border border-white/10">
        <AlertTriangle size={28} className="text-amber-400 mb-2" />
        <p className="text-slate-200 font-semibold text-sm">WebGL Offline</p>
        <p className="text-slate-400 text-xs mt-1">Please enable WebGL in your browser to render the 3D spacecraft orientation.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col relative bg-transparent overflow-hidden select-none">
      {/* 3D Canvas Container */}
      <div ref={mountRef} className="flex-1 w-full min-h-0 relative" />

      {/* Floating Precision HUD Telemetry Readout */}
      <div className="absolute top-2 left-2.5 pointer-events-none">
        <div className="flex items-center gap-2 mb-1.5 font-mono">
          <Compass size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
            ATTITUDE 3D
          </span>
          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        <div className="rounded-lg p-2 font-mono text-[11px] space-y-1 bg-[#090d18]/90 border border-white/10 shadow-xl">
          <div className="flex justify-between gap-5">
            <span className="text-slate-400">ROLL (φ):</span>
            <span className="text-sky-300 font-bold tabular-nums">
              {roll !== null ? `${roll > 0 ? '+' : ''}${roll.toFixed(1)}°` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-slate-400">PITCH (θ):</span>
            <span className="text-sky-300 font-bold tabular-nums">
              {pitch !== null ? `${pitch > 0 ? '+' : ''}${pitch.toFixed(1)}°` : 'N/A'}
            </span>
          </div>
          <div className="flex justify-between gap-5">
            <span className="text-slate-500">YAW (ψ):</span>
            <span className="text-slate-500 font-mono">CALC</span>
          </div>
          {ax !== null && (
            <div className="pt-1 border-t border-white/[0.08] flex justify-between gap-3 text-[10px] text-slate-400">
              <span>ACCEL:</span>
              <span className="text-emerald-400 font-mono font-medium tabular-nums">
                {ax.toFixed(2)}, {ay?.toFixed(2) ?? '0'}, {az?.toFixed(2) ?? '0'} G
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Last update footer */}
      {mpuTimestamp && (
        <div className="absolute bottom-1.5 right-1.5 text-[9px] text-slate-400 font-mono pointer-events-none px-1.5 py-0.5 rounded bg-black/60 border border-white/[0.08]">
          {formatDistanceToNow(new Date(mpuTimestamp), { addSuffix: true })}
        </div>
      )}
    </div>
  );
}
