import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useTelemetryStore } from '../../stores/telemetryStore';
import { Maximize2, RotateCcw, Eye, Layers, ZoomIn, ZoomOut, X, Sparkles, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import { OrbitraLogo } from '../common/OrbitraLogo';
import {
  createFaceTexture,
  createFaceBumpMap,
  createGoldMliTexture,
  createRbfRibbonTexture,
} from './cubeSatTextures';

interface Props {
  title?: string;
}

type InspectDisplayMode = 'solid' | 'wireframe' | 'xray' | 'subsystems';

interface SubsystemInfo {
  id: string;
  name: string;
  callsign: string;
  description: string;
  specs: string;
}

const SUBSYSTEMS: SubsystemInfo[] = [
  {
    id: 'solar',
    name: 'Photovoltaic Solar Arrays',
    callsign: 'EPS-PV-1U',
    description: 'Triple-junction InGaP/GaAs/Ge solar cells with micro-finger silver busbars, anti-reflective coating, and 45° chamfered dies.',
    specs: '2.4W Nominal · 4.2V Bus · 29.5% Efficiency',
  },
  {
    id: 'antenna',
    name: 'UHF Deployable Monopole',
    callsign: 'COMM-ANT-437',
    description: 'Spring-steel deployable whip with helical base spring, right-angle SMA coax mount, and nichrome burn-wire release.',
    specs: '437.500 MHz · GFSK 19.2 kbps · +9.4 dB Link Margin',
  },
  {
    id: 'payload',
    name: 'Multispectral Camera Aperture',
    callsign: 'PLD-CAM-RGB',
    description: 'Machined brass collar with knurled aerospace barrel and multi-element anti-reflective coated optical glass for Earth observation.',
    specs: 'F/2.8 Aperture · 12-bit CMOS · Nadir Ground Track',
  },
  {
    id: 'mli',
    name: 'Gold MLI Thermal Blanket',
    callsign: 'TCS-MLI-KAPTON',
    description: 'Multi-layer aluminized polyimide insulation cavity providing thermal protection against -40°C to +85°C low-Earth orbit extremes.',
    specs: '10-Layer Mylar/Kapton · Emissivity 0.03',
  },
  {
    id: 'imu',
    name: '6-DoF Attitude Determination',
    callsign: 'ADCS-MPU6050',
    description: 'Kalman-filtered 3-axis rate gyroscope and accelerometer calculating real-time Euler quaternion attitude telemetry.',
    specs: '±250°/s Rate · ±2g Range · 100 Hz Bus Sampling',
  },
  {
    id: 'structure',
    name: 'P-POD 1U Aluminum Chassis',
    callsign: 'STR-6061-T6',
    description: 'Anodized aerospace aluminum 6061-T6 rails with 45° deployer lead-in chamfers and spring-loaded separation switches.',
    specs: '100 × 100 × 113.5 mm · CalPoly 1U Compliant',
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
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [displayMode, setDisplayMode] = useState<InspectDisplayMode>('solid');
  const [activeSubsystem, setActiveSubsystem] = useState<SubsystemInfo | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1.0);

  // Three.js object references
  const targetEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const currentEuler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const satGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  // 3D Orbit Inspect Demo state
  const isInspectingRef = useRef(false);
  isInspectingRef.current = isInspecting;

  // Damped hover camera lean (azimuth ±0.30 rad, elevation ±0.09 rad)
  const hoverGain = useRef(0);
  const hoverTarget = useRef({ az: 0, el: 0 });
  const hoverCurrent = useRef({ az: 0, el: 0 });

  // Direct hand manipulation
  const isDragging = useRef(false);
  const pointerStart = useRef({ x: 0, y: 0, time: 0 });
  const dragDelta = useRef({ x: 0, y: 0 });
  const spinVelocity = useRef({ x: 0, y: 0 });
  const lastInteractionTime = useRef(Date.now());
  const inspectRotation = useRef(new THREE.Euler(0, 0, 0, 'YXZ'));
  const inspectZoom = useRef(1.0);

  // Live telemetry listener
  useEffect(() => {
    if (roll !== null && pitch !== null) {
      const radPitch = THREE.MathUtils.degToRad(-pitch);
      const radRoll = THREE.MathUtils.degToRad(roll);
      targetEuler.current.set(radPitch, 0, radRoll, 'YXZ');
    }
  }, [roll, pitch]);

  // Display mode switcher (Solid vs Wireframe vs X-Ray)
  useEffect(() => {
    materialsRef.current.forEach(mat => {
      if (mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshPhysicalMaterial) {
        if (displayMode === 'wireframe') {
          mat.wireframe = true;
          mat.transparent = false;
          mat.opacity = 1.0;
        } else if (displayMode === 'xray') {
          mat.wireframe = false;
          mat.transparent = true;
          mat.opacity = 0.35;
        } else {
          mat.wireframe = false;
          mat.transparent = false;
          mat.opacity = 1.0;
        }
      }
    });
  }, [displayMode]);

  // Main Scene Lifecycle
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
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(3.0, 2.2, 3.8);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      container.appendChild(renderer.domElement);
    } catch {
      setWebGlSupported(false);
      return;
    }

    // ── Space Lighting ───────────────────────────────────────────────────────
    // Solar illumination (Intense white Key Light)
    const sunLight = new THREE.DirectionalLight(0xfffdf5, 3.2);
    sunLight.position.set(9, 12, 8);
    scene.add(sunLight);

    // Earth Albedo reflection (Cyan-blue fill from nadir)
    const earthAlbedo = new THREE.DirectionalLight(0x38bdf8, 1.2);
    earthAlbedo.position.set(-8, -5, -6);
    scene.add(earthAlbedo);

    // Deep space hemisphere ambient light
    const deepSpaceAmbient = new THREE.HemisphereLight(0x1e293b, 0x050508, 0.7);
    scene.add(deepSpaceAmbient);

    // ── Build Authentic 1U CubeSat Assembly ──────────────────────────────────
    const satGroup = new THREE.Group();
    satGroupRef.current = satGroup;
    scene.add(satGroup);

    const materialsList: THREE.Material[] = [];

    // 1. Procedural PBR Textures (Analyzed from NASA / ESA Reference Photograph)
    const cameraFaceTex = createFaceTexture('camera');
    const cameraFaceBump = createFaceBumpMap('camera');
    const mliFaceTex = createFaceTexture('mli');
    const mliFaceBump = createFaceBumpMap('mli');
    const standardFaceTex = createFaceTexture('standard');
    const standardFaceBump = createFaceBumpMap('standard');
    const goldMliTex = createGoldMliTexture();
    const rbfTex = createRbfRibbonTexture();

    // 2. Anodized Aerospace Aluminum 6061-T6 Chassis Frame Core
    const chassisMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b0b0e,
      metalness: 0.94,
      roughness: 0.26,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
    });
    materialsList.push(chassisMat);

    const chassisGeo = new THREE.BoxGeometry(1.36, 1.36, 1.36);
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);
    satGroup.add(chassis);

    // 3. Extruded P-POD Deployer Corner Rails
    const railMat = new THREE.MeshPhysicalMaterial({
      color: 0x24242c,
      metalness: 0.95,
      roughness: 0.22,
      reflectivity: 0.85,
    });
    materialsList.push(railMat);

    const goldPlungeMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      metalness: 0.96,
      roughness: 0.18,
    });
    materialsList.push(goldPlungeMat);

    const railW = 0.075;
    const railL = 1.44;

    const createCornerRail = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
      const geo = new THREE.BoxGeometry(railW, railL, railW);
      const m = new THREE.Mesh(geo, railMat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      satGroup.add(m);

      // Spring-loaded separation plungers on vertical rail ends
      if (rx === 0 && ry === 0 && rz === 0) {
        const plungerGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.08, 12);
        const topPlunger = new THREE.Mesh(plungerGeo, goldPlungeMat);
        topPlunger.position.set(x, y + 0.74, z);
        satGroup.add(topPlunger);

        const botPlunger = new THREE.Mesh(plungerGeo, goldPlungeMat);
        botPlunger.position.set(x, y - 0.74, z);
        satGroup.add(botPlunger);
      }
    };

    // 4 Vertical P-POD corner guide rails
    createCornerRail(0.68, 0, 0.68);
    createCornerRail(-0.68, 0, 0.68);
    createCornerRail(0.68, 0, -0.68);
    createCornerRail(-0.68, 0, -0.68);

    // Horizontal frame rims
    createCornerRail(0, 0.68, 0.68, 0, 0, Math.PI / 2);
    createCornerRail(0, -0.68, 0.68, 0, 0, Math.PI / 2);
    createCornerRail(0, 0.68, -0.68, 0, 0, Math.PI / 2);
    createCornerRail(0, -0.68, -0.68, 0, 0, Math.PI / 2);
    createCornerRail(0.68, 0.68, 0, Math.PI / 2, 0, 0);
    createCornerRail(-0.68, 0.68, 0, Math.PI / 2, 0, 0);
    createCornerRail(0.68, -0.68, 0, Math.PI / 2, 0, 0);
    createCornerRail(-0.68, -0.68, 0, Math.PI / 2, 0, 0);

    // 4. Face Assemblies
    const faceGeo = new THREE.PlaneGeometry(1.24, 1.24);

    // A. Front Face (+Z) - Optical Camera Face with Quad Solar Dies & Silver Traces
    const frontMat = new THREE.MeshPhysicalMaterial({
      map: cameraFaceTex,
      bumpMap: cameraFaceBump,
      bumpScale: 0.05,
      roughness: 0.16,
      metalness: 0.78,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    materialsList.push(frontMat);
    const frontFace = new THREE.Mesh(faceGeo, frontMat);
    frontFace.position.set(0, 0, 0.686);
    satGroup.add(frontFace);

    // B. Left Face (+X) - Model Telemetry Silk-Screen with Recessed Gold MLI Cavity
    const mliMatFace = new THREE.MeshPhysicalMaterial({
      map: mliFaceTex,
      bumpMap: mliFaceBump,
      bumpScale: 0.05,
      roughness: 0.18,
      metalness: 0.75,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    materialsList.push(mliMatFace);
    const leftFace = new THREE.Mesh(faceGeo, mliMatFace);
    leftFace.position.set(0.686, 0, 0);
    leftFace.rotation.y = Math.PI / 2;
    satGroup.add(leftFace);

    // Real 3D Inset Gold MLI Foil inside the +X Cavity Cutout
    const insetMliMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      bumpMap: goldMliTex,
      bumpScale: 0.12,
      metalness: 0.96,
      roughness: 0.22,
      clearcoat: 0.8,
      clearcoatRoughness: 0.2,
    });
    materialsList.push(insetMliMat);
    const insetMliGeo = new THREE.PlaneGeometry(0.32, 0.32);
    const insetMliMesh = new THREE.Mesh(insetMliGeo, insetMliMat);
    insetMliMesh.position.set(0.684, -0.22, 0);
    insetMliMesh.rotation.y = Math.PI / 2;
    satGroup.add(insetMliMesh);

    // C. Back Face (-Z) & Right Face (-X) - Standard High-Efficiency Solar Dies
    const standardMat = new THREE.MeshPhysicalMaterial({
      map: standardFaceTex,
      bumpMap: standardFaceBump,
      bumpScale: 0.05,
      roughness: 0.15,
      metalness: 0.78,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });
    materialsList.push(standardMat);

    const backFace = new THREE.Mesh(faceGeo, standardMat);
    backFace.position.set(0, 0, -0.686);
    backFace.rotation.y = Math.PI;
    satGroup.add(backFace);

    const rightFace = new THREE.Mesh(faceGeo, standardMat);
    rightFace.position.set(-0.686, 0, 0);
    rightFace.rotation.y = -Math.PI / 2;
    satGroup.add(rightFace);

    // D. Bottom Face (-Y) - Full Gold MLI Thermal Shield
    const botMliMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b,
      bumpMap: goldMliTex,
      bumpScale: 0.09,
      metalness: 0.95,
      roughness: 0.26,
      clearcoat: 0.7,
      clearcoatRoughness: 0.25,
    });
    materialsList.push(botMliMat);
    const botFace = new THREE.Mesh(faceGeo, botMliMat);
    botFace.position.set(0, -0.686, 0);
    botFace.rotation.x = Math.PI / 2;
    satGroup.add(botFace);

    // E. Top Face (+Y) - Subsystem Motherboard & Sun Sensor
    const topMat = new THREE.MeshPhysicalMaterial({
      map: standardFaceTex,
      bumpMap: standardFaceBump,
      bumpScale: 0.04,
      roughness: 0.25,
      metalness: 0.8,
    });
    materialsList.push(topMat);
    const topFace = new THREE.Mesh(faceGeo, topMat);
    topFace.position.set(0, 0.686, 0);
    topFace.rotation.x = -Math.PI / 2;
    satGroup.add(topFace);

    // 5. Optical Camera Payload Barrel on +Z Face (Matching Photo Reference)
    const barrelOuterGeo = new THREE.CylinderGeometry(0.25, 0.27, 0.14, 32);
    const barrelMat = new THREE.MeshPhysicalMaterial({ color: 0x121216, metalness: 0.92, roughness: 0.24 });
    const barrel = new THREE.Mesh(barrelOuterGeo, barrelMat);
    barrel.position.set(0, 0, 0.75);
    barrel.rotation.x = Math.PI / 2;
    satGroup.add(barrel);

    // Machined Brass / Gold Anodized Aperture Collar Ring
    const brassRingGeo = new THREE.CylinderGeometry(0.20, 0.20, 0.16, 32);
    const brassRingMat = new THREE.MeshPhysicalMaterial({
      color: 0xd97706,
      metalness: 0.96,
      roughness: 0.14,
      reflectivity: 0.9,
    });
    const brassRing = new THREE.Mesh(brassRingGeo, brassRingMat);
    brassRing.position.set(0, 0, 0.76);
    brassRing.rotation.x = Math.PI / 2;
    satGroup.add(brassRing);

    // Anti-Reflective Optical Glass Convex Lens (AR Cyan-Indigo)
    const lensGeo = new THREE.SphereGeometry(0.175, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42);
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      metalness: 0.15,
      roughness: 0.02,
      transmission: 0.88,
      ior: 1.54,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
    });
    const lens = new THREE.Mesh(lensGeo, lensMat);
    lens.position.set(0, 0, 0.81);
    lens.rotation.x = Math.PI / 2;
    satGroup.add(lens);

    // 6. Deployable UHF Monopole Antenna on Front-Left P-POD Rail (Matching Photo)
    const antMountX = -0.68;
    const antMountZ = 0.68;

    // Brass right-angle SMA Coaxial RF Connector Block
    const smaGeo = new THREE.BoxGeometry(0.065, 0.065, 0.08);
    const smaMat = new THREE.MeshPhysicalMaterial({ color: 0xd97706, metalness: 0.95, roughness: 0.15 });
    const smaBlock = new THREE.Mesh(smaGeo, smaMat);
    smaBlock.position.set(antMountX, 0.73, antMountZ);
    satGroup.add(smaBlock);

    // Helical deployment spring at base
    const springCoilGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.09, 16);
    const springCoilMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const springCoil = new THREE.Mesh(springCoilGeo, springCoilMat);
    springCoil.position.set(antMountX, 0.80, antMountZ);
    satGroup.add(springCoil);

    // Spring-steel whip antenna
    const whipGeo = new THREE.CylinderGeometry(0.010, 0.010, 1.05, 16);
    const whipMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.95, roughness: 0.12 });
    const whip = new THREE.Mesh(whipGeo, whipMat);
    whip.position.set(antMountX, 1.34, antMountZ);
    satGroup.add(whip);

    // Gold tip bead
    const antTipGeo = new THREE.SphereGeometry(0.024, 12, 12);
    const antTip = new THREE.Mesh(antTipGeo, goldPlungeMat);
    antTip.position.set(antMountX, 1.87, antMountZ);
    satGroup.add(antTip);

    // Nichrome burn-wire release bracket at lower rail
    const releaseGeo = new THREE.BoxGeometry(0.045, 0.08, 0.045);
    const releaseMesh = new THREE.Mesh(releaseGeo, smaMat);
    releaseMesh.position.set(antMountX, -0.30, antMountZ);
    satGroup.add(releaseMesh);

    // 7. Quad-cell Sun Sensor on Top Face (+Y)
    const sunSensGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.04, 24);
    const sunSensMat = new THREE.MeshPhysicalMaterial({ color: 0x1e293b, metalness: 0.88, roughness: 0.2 });
    const sunSens = new THREE.Mesh(sunSensGeo, sunSensMat);
    sunSens.position.set(0.35, 0.706, -0.35);
    satGroup.add(sunSens);

    // 8. Remove Before Flight (RBF) Embroidered Safety Ribbon
    const rbfGeo = new THREE.PlaneGeometry(0.88, 0.16);
    const rbfMat = new THREE.MeshStandardMaterial({
      map: rbfTex,
      side: THREE.DoubleSide,
      roughness: 0.55,
    });
    const rbfRibbon = new THREE.Mesh(rbfGeo, rbfMat);
    rbfRibbon.position.set(antMountX - 0.05, -0.35, antMountZ + 0.1);
    rbfRibbon.rotation.set(0, 0, -Math.PI / 3);
    satGroup.add(rbfRibbon);

    // 9. Coordinate floor grid and reference axes
    const grid = new THREE.GridHelper(10, 20, 0x27272a, 0x111115);
    grid.position.y = -1.65;
    scene.add(grid);

    materialsRef.current = materialsList;

    // ── Animation Loop (Implements 3d-orbit-inspect-demo) ─────────────────────
    let animationFrameId: number;
    let lastTime = performance.now();
    const baseCamPos = new THREE.Vector3(3.0, 2.2, 3.8);

    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      // Gentle flutter on the RBF ribbon
      rbfRibbon.rotation.z = -Math.PI / 3 + Math.sin(now * 0.0035) * 0.045;

      if (!isInspectingRef.current) {
        // Rest mode: Smoothly follow live telemetry Euler angles
        currentEuler.current.x = THREE.MathUtils.lerp(currentEuler.current.x, targetEuler.current.x, 0.10);
        currentEuler.current.y = THREE.MathUtils.lerp(currentEuler.current.y, targetEuler.current.y, 0.10);
        currentEuler.current.z = THREE.MathUtils.lerp(currentEuler.current.z, targetEuler.current.z, 0.10);
        satGroup.rotation.copy(currentEuler.current);

        // Bounded damped hover lean
        const damp = 1 - Math.exp(-4.5 * dt);
        hoverCurrent.current.az += (hoverTarget.current.az * hoverGain.current - hoverCurrent.current.az) * damp;
        hoverCurrent.current.el += (hoverTarget.current.el * hoverGain.current - hoverCurrent.current.el) * damp;

        const radius = baseCamPos.length();
        const basePhi = Math.acos(baseCamPos.y / radius);
        const baseTheta = Math.atan2(baseCamPos.x, baseCamPos.z);

        const newTheta = baseTheta + hoverCurrent.current.az;
        const newPhi = THREE.MathUtils.clamp(basePhi + hoverCurrent.current.el, 0.25, Math.PI - 0.25);

        camera.position.x = radius * Math.sin(newPhi) * Math.sin(newTheta);
        camera.position.y = radius * Math.cos(newPhi);
        camera.position.z = radius * Math.sin(newPhi) * Math.cos(newTheta);
        camera.lookAt(0, 0, 0);

      } else {
        // Inspect Mode: Free drag rotation with inertial coasting & damping
        if (!isDragging.current) {
          const idleTime = Date.now() - lastInteractionTime.current;
          if (idleTime > 2200) {
            inspectRotation.current.y += 0.22 * dt;
          } else {
            const spinDamp = Math.exp(-2.4 * dt);
            spinVelocity.current.x *= spinDamp;
            spinVelocity.current.y *= spinDamp;

            inspectRotation.current.y += spinVelocity.current.x * dt;
            inspectRotation.current.x += spinVelocity.current.y * dt;
            inspectRotation.current.x = THREE.MathUtils.clamp(inspectRotation.current.x, -Math.PI / 2.1, Math.PI / 2.1);
          }
        }

        satGroup.rotation.copy(inspectRotation.current);

        const inspectDist = 3.8 / inspectZoom.current;
        camera.position.set(0, 0, inspectDist);
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

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

  // ── Pointer Handlers ───────────────────────────────────────────────────────
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (!isInspecting) {
      const px = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const py = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      hoverGain.current = 1.0;
      hoverTarget.current = {
        az: THREE.MathUtils.clamp(px * 0.30, -0.30, 0.30),
        el: THREE.MathUtils.clamp(-py * 0.09, -0.09, 0.09),
      };
    } else {
      if (isDragging.current) {
        const dx = e.clientX - dragDelta.current.x;
        const dy = e.clientY - dragDelta.current.y;
        dragDelta.current = { x: e.clientX, y: e.clientY };

        const radX = dx * 0.0085;
        const radY = dy * 0.0065;

        inspectRotation.current.y += radX;
        inspectRotation.current.x += radY;
        inspectRotation.current.x = THREE.MathUtils.clamp(inspectRotation.current.x, -Math.PI / 2.1, Math.PI / 2.1);

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

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!isInspecting) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0015);
    const newZoom = THREE.MathUtils.clamp(inspectZoom.current * factor, 0.70, 1.85);
    inspectZoom.current = newZoom;
    setZoomLevel(newZoom);
    lastInteractionTime.current = Date.now();
  };

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
    setShowReferenceModal(false);
    setActiveSubsystem(null);
    hoverGain.current = 0;
  }, []);

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

  const isStale = connState === 'stale' || (mpuTimestamp && Date.now() - mpuTimestamp > 10000);
  const isLive = (roll !== null || ax !== null) && connState === 'connected' && !isStale;
  const statusLabel = isLive ? 'LIVE' : isStale ? 'STALE' : 'SIM';

  if (!webGlSupported) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 text-center bg-black rounded-md border border-white/10 font-mono">
        <OrbitraLogo size={28} className="opacity-40 mb-2" />
        <p className="text-white font-medium text-xs">WebGL offline</p>
        <p className="text-zinc-500 text-[11px] mt-1">Hardware acceleration is required for 3D inspection.</p>
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

      {/* ── Normal Rest HUD ────────────────────────────────────────────────── */}
      {!isInspecting ? (
        <>
          <div className="absolute top-2 left-2 pointer-events-none">
            <div className="flex items-center gap-1.5 mb-1 text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="font-medium text-zinc-300">CubeSat 1U Flight Model</span>
              <span className="text-[10px] text-zinc-500 font-mono">[{statusLabel}]</span>
            </div>

            <div className="rounded-md px-2.5 py-1.5 text-[11px] bg-black/90 border border-white/10 shadow-lg space-y-0.5">
              <div className="flex justify-between gap-3 text-zinc-400">
                <span>Roll:</span>
                <span className="text-white font-medium tabular-nums">{roll !== null ? `${roll.toFixed(1)}°` : '0.0°'}</span>
              </div>
              <div className="flex justify-between gap-3 text-zinc-400">
                <span>Pitch:</span>
                <span className="text-white font-medium tabular-nums">{pitch !== null ? `${pitch.toFixed(1)}°` : '0.0°'}</span>
              </div>
              {ax !== null && (
                <div className="flex justify-between gap-3 text-zinc-400 pt-0.5 border-t border-white/5 text-[10px]">
                  <span>Accel:</span>
                  <span className="text-zinc-300 font-medium tabular-nums">{ax.toFixed(2)}, {ay?.toFixed(2) ?? '0'}, {az?.toFixed(2) ?? '0'}g</span>
                </div>
              )}
            </div>
          </div>

          {/* Clean Top-Right Action Button */}
          <div className="absolute top-2 right-2">
            <button
              onClick={openInspect}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md bg-zinc-900/90 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-200 hover:text-white text-xs font-medium transition-all shadow-sm active:scale-[0.98]"
              title="Inspect 3D satellite"
            >
              <Maximize2 size={12} className="text-sky-400" />
              <span>Inspect</span>
            </button>
          </div>

          <div className="absolute bottom-1.5 left-2 pointer-events-none text-[10px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-zinc-500" />
            <span>Hover to lean · Click to inspect 3D flight model</span>
          </div>
        </>
      ) : (
        /* ── Full Interactive 3D Inspection Mode ──────────────────────────── */
        <>
          {/* Header Bar */}
          <div className="absolute top-3 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5">
              <OrbitraLogo size={20} />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-white tracking-tight">
                    1U CubeSat Flight Model Inspection
                  </h3>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-white/10 text-zinc-300 border border-white/10">
                    AETHER-1 · P-POD Standard
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Drag to rotate 360° · Scroll to zoom · Arrow keys · Esc to dock
                </p>
              </div>
            </div>

            {/* Display Switcher, Reference Photo Toggle & Close Button */}
            <div className="flex items-center gap-2 pointer-events-auto">
              <button
                onClick={() => setShowReferenceModal(!showReferenceModal)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all active:scale-[0.98] ${
                  showReferenceModal
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-zinc-900/90 hover:bg-zinc-800 border-white/10 text-zinc-300 hover:text-white'
                }`}
                title="Toggle authentic NASA flight model reference photo"
              >
                <ImageIcon size={12} />
                <span>Reference photo</span>
              </button>

              <div className="flex bg-zinc-900 border border-white/10 rounded-md p-0.5">
                {(['solid', 'wireframe', 'xray', 'subsystems'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setDisplayMode(mode)}
                    className={`h-6 px-2 rounded text-[11px] capitalize transition-colors ${
                      displayMode === mode
                        ? 'bg-zinc-700 text-white font-medium shadow-sm'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={closeInspect}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-white hover:bg-zinc-200 text-black text-xs font-medium transition-all shadow active:scale-[0.98]"
              >
                <X size={13} /> Close
              </button>
            </div>
          </div>

          {/* Reference Photo Comparison Drawer */}
          {showReferenceModal && (
            <div className="absolute right-4 top-16 w-96 max-h-[80vh] overflow-y-auto bg-black/95 border border-white/15 rounded-lg p-3.5 shadow-2xl pointer-events-auto backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <ImageIcon size={14} className="text-sky-400" />
                  <span className="text-xs font-semibold text-white">AI Analyzed NASA Reference</span>
                </div>
                <button
                  onClick={() => setShowReferenceModal(false)}
                  className="text-zinc-400 hover:text-white p-1"
                >
                  <X size={13} />
                </button>
              </div>

              <div className="relative rounded overflow-hidden border border-white/10 mb-3 bg-zinc-950">
                <img
                  src="/cubesat-reference.jpg"
                  alt="NASA 1U CubeSat Flight Model Reference"
                  className="w-full h-auto object-cover"
                />
                <span className="absolute bottom-1 right-1.5 text-[9px] bg-black/80 px-1.5 py-0.5 rounded text-zinc-400 font-mono">
                  SN:042 · AETHER-1
                </span>
              </div>

              <div className="space-y-2 text-[11px]">
                <div className="text-zinc-400 font-medium text-[10px] uppercase tracking-wider">
                  Analyzed Mechanical Features (1:1 Match):
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Segmented solar dies:</strong> 4 discrete InGaP dies per face with silver conductor ribbons and 45° corner chamfers.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Machined brass aperture:</strong> Center camera barrel with anti-reflective optical glass lens.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Gold MLI cavity:</strong> Real 3D recessed Kapton thermal insulation blanket with crumpled foil relief.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>Corner rail UHF monopole:</strong> Deployable spring-steel whip with right-angle SMA connector and burn wire.</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-zinc-300">
                    <CheckCircle2 size={12} className="text-emerald-400 mt-0.5 shrink-0" />
                    <span><strong>P-POD deployer rails:</strong> Extruded 6061-T6 aluminum posts with separation plunge switches.</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subsystems Drawer (when mode === 'subsystems') */}
          {displayMode === 'subsystems' && (
            <div className="absolute left-4 top-16 w-80 space-y-2 pointer-events-auto max-h-[75vh] overflow-y-auto pr-1">
              <div className="text-[11px] font-medium text-zinc-400 mb-1">Integrated Subsystems</div>
              {SUBSYSTEMS.map(sub => (
                <div
                  key={sub.id}
                  onClick={() => setActiveSubsystem(sub)}
                  className={`p-2.5 rounded-md border transition-all cursor-pointer ${
                    activeSubsystem?.id === sub.id
                      ? 'bg-zinc-900 border-sky-400/80 text-white shadow'
                      : 'bg-[#09090b]/90 border-white/10 text-zinc-300 hover:border-white/20 hover:bg-zinc-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-white">{sub.name}</span>
                    <span className="text-[10px] text-sky-400 font-mono">{sub.callsign}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{sub.description}</p>
                  <p className="text-[10px] text-emerald-400 font-mono mt-1 pt-1 border-t border-white/5">{sub.specs}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bottom Bar: Telemetry Readout & Controls */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
            <div className="rounded-md px-2.5 py-1.5 bg-black/85 border border-white/10 text-xs text-zinc-300 flex items-center gap-3">
              <span>Rot X: <strong className="text-white font-mono">{THREE.MathUtils.radToDeg(inspectRotation.current.x).toFixed(1)}°</strong></span>
              <span>Rot Y: <strong className="text-white font-mono">{THREE.MathUtils.radToDeg(inspectRotation.current.y).toFixed(1)}°</strong></span>
              <span>Zoom: <strong className="text-white font-mono">{(zoomLevel * 100).toFixed(0)}%</strong></span>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                onClick={() => {
                  inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current * 1.15, 0.7, 1.85);
                  setZoomLevel(inspectZoom.current);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors"
                title="Zoom in (+)"
              >
                <ZoomIn size={13} />
              </button>
              <button
                onClick={() => {
                  inspectZoom.current = THREE.MathUtils.clamp(inspectZoom.current / 1.15, 0.7, 1.85);
                  setZoomLevel(inspectZoom.current);
                }}
                className="h-7 w-7 flex items-center justify-center rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white transition-colors"
                title="Zoom out (-)"
              >
                <ZoomOut size={13} />
              </button>
              <button
                onClick={() => {
                  inspectRotation.current.set(0, 0, 0);
                  inspectZoom.current = 1.0;
                  setZoomLevel(1.0);
                }}
                className="h-7 px-2.5 inline-flex items-center gap-1 rounded-md bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                title="Reset view"
              >
                <RotateCcw size={12} /> Reset view
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}