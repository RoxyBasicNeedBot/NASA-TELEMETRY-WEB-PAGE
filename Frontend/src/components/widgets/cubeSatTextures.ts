import * as THREE from 'three';

/**
 * Procedural Photorealistic PBR Texture Generator
 * Faithfully matches NASA / ESA 1U Flight Model specifications:
 * - Segmented multi-junction solar cells with silver interconnects
 * - Anti-reflective dark indigo-violet crystalline silicon
 * - Silk-screened aerospace telemetry markings (AETHER-1 / ORBITRA)
 * - Gold Kapton MLI (Multi-Layer Insulation) thermal blanket
 * - Optical aperture bezel & diagnostic ports
 */

export function createFaceTexture(type: 'camera' | 'mli' | 'standard'): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // 1. Matte Black Aerospace FR4/Polyimide substrate base
  ctx.fillStyle = '#141418';
  ctx.fillRect(0, 0, size, size);

  // Subtle carbon-fiber / FR4 weave texture
  ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
  for (let y = 0; y < size; y += 4) {
    for (let x = 0; x < size; x += 4) {
      if ((x + y) % 8 === 0) ctx.fillRect(x, y, 2, 2);
    }
  }

  // 2. Corner Rails clearance margins
  const m = 40; // margin from outer edge

  // Helper to draw an authentic solar cell die with 45-degree chamfered corners
  const drawSolarCell = (x: number, y: number, w: number, h: number) => {
    ctx.save();
    const c = 22; // corner chamfer
    ctx.beginPath();
    ctx.moveTo(x + c, y);
    ctx.lineTo(x + w - c, y);
    ctx.lineTo(x + w, y + c);
    ctx.lineTo(x + w, y + h - c);
    ctx.lineTo(x + w - c, y + h);
    ctx.lineTo(x + c, y + h);
    ctx.lineTo(x, y + h - c);
    ctx.lineTo(x, y + c);
    ctx.closePath();
    ctx.clip();

    // Deep space dark blue/violet anti-reflective crystal gradient
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#16223d');
    grad.addColorStop(0.35, '#0e182e');
    grad.addColorStop(0.7, '#091122');
    grad.addColorStop(1, '#050a16');
    ctx.fillStyle = grad;
    ctx.fill();

    // 40 fine horizontal silver collector fingers
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.35)';
    ctx.lineWidth = 1.0;
    const fingers = 44;
    const step = h / fingers;
    for (let i = 1; i < fingers; i++) {
      const fy = y + i * step;
      ctx.beginPath();
      ctx.moveTo(x, fy);
      ctx.lineTo(x + w, fy);
      ctx.stroke();
    }

    // Vertical Silver Conductor Busbar Ribbons
    const b1 = x + w * 0.32;
    const b2 = x + w * 0.68;
    [b1, b2].forEach(bx => {
      const bg = ctx.createLinearGradient(bx - 4, y, bx + 4, y);
      bg.addColorStop(0, '#cbd5e1');
      bg.addColorStop(0.5, '#ffffff');
      bg.addColorStop(1, '#94a3b8');
      ctx.fillStyle = bg;
      ctx.fillRect(bx - 3.5, y, 7, h);

      // Micro solder pads
      ctx.fillStyle = '#f8fafc';
      for (let s = 1; s <= 3; s++) {
        ctx.beginPath();
        ctx.arc(bx, y + (s * h) / 4, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    ctx.restore();

    // Cell die perimeter border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();
  };

  // Layout solar cells based on face type
  if (type === 'camera') {
    // 4 solar cells leaving room for center camera aperture (circle radius ~160px)
    const gap = 16;
    const halfW = (size - m * 2 - gap) / 2;
    const halfH = (size - m * 2 - gap) / 2;

    drawSolarCell(m, m, halfW, halfH); // Top-Left
    drawSolarCell(m + halfW + gap, m, halfW, halfH); // Top-Right
    drawSolarCell(m, m + halfH + gap, halfW, halfH); // Bottom-Left
    drawSolarCell(m + halfW + gap, m + halfH + gap, halfW, halfH); // Bottom-Right

    // Central circular aperture cutout boundary
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 175, 0, Math.PI * 2);
    ctx.fillStyle = '#0a0a0e';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Silver circuit traces routing from cells to PCB center
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    // Trace 1
    ctx.moveTo(m + halfW, m + 40);
    ctx.lineTo(size / 2 - 20, m + 40);
    ctx.lineTo(size / 2 - 20, size / 2 - 190);
    ctx.stroke();
    // Trace 2
    ctx.moveTo(m + halfW + gap, m + 40);
    ctx.lineTo(size / 2 + 20, m + 40);
    ctx.lineTo(size / 2 + 20, size / 2 - 190);
    ctx.stroke();

  } else if (type === 'mli') {
    // Left face with 4 cells and recessed square cutout for gold MLI thermal blanket
    const gap = 16;
    const halfW = (size - m * 2 - gap) / 2;
    const cellH = (size - m * 2 - gap * 2) / 3;

    // Top row 2 cells
    drawSolarCell(m, m, halfW, cellH * 1.3);
    drawSolarCell(m + halfW + gap, m, halfW, cellH * 1.3);

    // Center telemetry silk screen label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px "SF Mono", "Consolas", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CUBESAT 1U', size / 2, m + cellH * 1.45 + 10);
    ctx.font = '14px "SF Mono", "Consolas", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('ORBITRA AETHER-1', size / 2, m + cellH * 1.45 + 32);
    ctx.fillText('SN: 042 · FLIGHT MODEL', size / 2, m + cellH * 1.45 + 50);
    ctx.fillText('NASA / ESA STANDARDS', size / 2, m + cellH * 1.45 + 68);

    // Bottom-center: Square Gold MLI Thermal Cavity
    const mliSize = 220;
    const mliX = (size - mliSize) / 2;
    const mliY = size - m - mliSize - 30;

    // Beveled cavity frame
    ctx.fillStyle = '#050508';
    ctx.fillRect(mliX, mliY, mliSize, mliSize);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 3;
    ctx.strokeRect(mliX, mliY, mliSize, mliSize);

    // Bottom Left & Right small solar cells flanking the MLI cavity
    drawSolarCell(m, mliY, halfW - 40, mliSize);
    drawSolarCell(size - m - (halfW - 40), mliY, halfW - 40, mliSize);

    // Diagnostic ports at bottom edge (USB-C and auxiliary micro-D)
    const portY = size - m + 6;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(size / 2 - 80, portY, 50, 16);
    ctx.fillRect(size / 2 + 30, portY, 50, 16);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.strokeRect(size / 2 - 80, portY, 50, 16);
    ctx.strokeRect(size / 2 + 30, portY, 50, 16);

  } else {
    // Standard solar face: 4 large cells
    const gap = 16;
    const halfW = (size - m * 2 - gap) / 2;
    const halfH = (size - m * 2 - gap) / 2;

    drawSolarCell(m, m, halfW, halfH);
    drawSolarCell(m + halfW + gap, m, halfW, halfH);
    drawSolarCell(m, m + halfH + gap, halfW, halfH);
    drawSolarCell(m + halfW + gap, m + halfH + gap, halfW, halfH);
  }

  // 3. Precision Countersunk Hex Screws at all 4 corners + edge midpoints
  const screwPoints = [
    [m - 12, m - 12],
    [size - m + 12, m - 12],
    [m - 12, size - m + 12],
    [size - m + 12, size - m + 12],
    [size / 2, m - 12],
    [size / 2, size - m + 12],
    [m - 12, size / 2],
    [size - m + 12, size / 2],
  ];

  screwPoints.forEach(([sx, sy]) => {
    // Silver beveled washer ring
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.fillStyle = '#94a3b8';
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner hex socket
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/**
 * Normal/Bump Map for Physical Relief
 */
export function createFaceBumpMap(type: 'camera' | 'mli' | 'standard'): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const m = 20;
  const gap = 8;
  const half = (size - m * 2 - gap) / 2;

  // Raised solar cells
  ctx.fillStyle = '#a8a8a8';
  ctx.fillRect(m, m, half, half);
  ctx.fillRect(m + half + gap, m, half, half);
  ctx.fillRect(m, m + half + gap, half, half);
  ctx.fillRect(m + half + gap, m + half + gap, half, half);

  // Recessed center hole for camera
  if (type === 'camera') {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 88, 0, Math.PI * 2);
    ctx.fillStyle = '#303030';
    ctx.fill();
  }

  // Recessed MLI cavity
  if (type === 'mli') {
    ctx.fillStyle = '#202020';
    ctx.fillRect(size / 2 - 55, size / 2, 110, 110);
  }

  // Screws
  const screwPoints = [
    [m - 6, m - 6],
    [size - m + 6, m - 6],
    [m - 6, size - m + 6],
    [size - m + 6, size - m + 6],
  ];
  screwPoints.forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0e0';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx, sy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#101010';
    ctx.fill();
  });

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Procedural Gold MLI (Multi-Layer Insulation) Thermal Blanket Texture
 */
export function createGoldMliTexture(): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Deep radiant gold metallic base
  ctx.fillStyle = '#d97706';
  ctx.fillRect(0, 0, size, size);

  // Wrinkled foil facets with high specular variation
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 15 + Math.random() * 45;

    const grad = ctx.createRadialGradient(x, y, 1, x, y, r);
    const bright = Math.random() > 0.4 ? 255 : 140;
    grad.addColorStop(0, `rgba(${bright}, ${Math.floor(bright * 0.82)}, ${Math.floor(bright * 0.25)}, 0.5)`);
    grad.addColorStop(1, 'rgba(180, 83, 9, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Creased foil lines
  ctx.strokeStyle = 'rgba(60, 30, 0, 0.45)';
  ctx.lineWidth = 1.2;
  for (let c = 0; c < 100; c++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 240, 180, 0.6)';
  ctx.lineWidth = 1.0;
  for (let c = 0; c < 80; c++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.lineTo(Math.random() * size, Math.random() * size);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Remove Before Flight Ribbon
 */
export function createRbfRibbonTexture(): THREE.CanvasTexture {
  const width = 512;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#dc2626';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#7f1d1d';
  ctx.lineWidth = 4;
  ctx.strokeRect(3, 3, width - 6, height - 6);

  ctx.beginPath();
  ctx.arc(36, height / 2, 16, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(36, height / 2, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#000000';
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "SF Mono", "Consolas", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('REMOVE BEFORE FLIGHT', width / 2 + 25, height / 2);

  return new THREE.CanvasTexture(canvas);
}
