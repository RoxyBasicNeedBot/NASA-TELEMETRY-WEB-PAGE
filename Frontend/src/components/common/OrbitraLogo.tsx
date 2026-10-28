import React from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'mark' | 'full' | 'compact';
  animated?: boolean;
}

/**
 * Custom Minimal Geometric Insignia — OpenAI / ChatGPT style mathematical torus
 * Interlocking 6-fold orbital ellipses forming a celestial telemetry gyroscope.
 */
export function OrbitraLogo({ size = 24, className = '', variant = 'mark', animated = false }: LogoProps) {
  const mark = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className} ${animated ? 'animate-[spin_20s_linear_infinite]' : ''}`}
    >
      <defs>
        <linearGradient id="orbitraGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <radialGradient id="singularityCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="60%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
      </defs>

      {/* Outer Gyro Ring */}
      <circle
        cx="50"
        cy="50"
        r="44"
        stroke="rgba(255, 255, 255, 0.15)"
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />

      {/* Precision 6-Petal Orbital Gimbal Tracks (ChatGPT / Sacred Geometry Inspiration) */}
      <g stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
        {/* Track 1 (0 deg) */}
        <path
          d="M 50 12 C 68 12, 88 32, 88 50 C 88 68, 68 88, 50 88 C 32 88, 12 68, 12 50 C 12 32, 32 12, 50 12"
          stroke="url(#orbitraGrad)"
          strokeWidth="2"
          opacity="0.85"
        />

        {/* Diagonal Ellipse Alpha (-30 deg) */}
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="18"
          transform="rotate(30 50 50)"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth="1.8"
        />

        {/* Diagonal Ellipse Beta (90 deg) */}
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="18"
          transform="rotate(90 50 50)"
          stroke="rgba(56, 189, 248, 0.85)"
          strokeWidth="1.8"
        />

        {/* Diagonal Ellipse Gamma (150 deg) */}
        <ellipse
          cx="50"
          cy="50"
          rx="40"
          ry="18"
          transform="rotate(150 50 50)"
          stroke="rgba(255, 255, 255, 0.7)"
          strokeWidth="1.8"
        />
      </g>

      {/* Internal High-Precision Telemetry Crosshair Grid */}
      <line x1="50" y1="20" x2="50" y2="28" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="50" y1="72" x2="50" y2="80" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="50" x2="28" y2="50" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="72" y1="50" x2="80" y2="50" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

      {/* Central Singularity Node (Hub Core) */}
      <circle cx="50" cy="50" r="7.5" fill="url(#singularityCore)" stroke="#ffffff" strokeWidth="1.5" />
      <circle cx="50" cy="50" r="2.5" fill="#ffffff" />
    </svg>
  );

  if (variant === 'mark') {
    return mark;
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 select-none font-mono">
        {mark}
        <span className="font-semibold tracking-wider text-xs text-white">ORBITRA</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 select-none font-mono">
      {mark}
      <div className="flex flex-col">
        <span className="font-bold tracking-widest text-xs text-white leading-none">ORBITRA</span>
        <span className="text-[9px] text-zinc-400 tracking-wider mt-0.5 leading-none">AEROSPACE TELEMETRY</span>
      </div>
    </div>
  );
}

/**
 * Custom SVG Icons for Aerospace Status & telemetry metrics
 */
export function GyroIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" strokeDasharray="3 3" opacity="0.4" />
      <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-30 12 12)" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <line x1="12" y1="3" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="21" />
    </svg>
  );
}

export function SatelliteInsignia({ size = 18, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 1U Cubesat outline */}
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" />
      {/* Solar Panel Wings */}
      <path d="M7 10 L2 10 L2 14 L7 14 Z" fill="rgba(56, 189, 248, 0.2)" stroke="currentColor" />
      <path d="M17 10 L22 10 L22 14 L17 14 Z" fill="rgba(56, 189, 248, 0.2)" stroke="currentColor" />
      {/* Panel grid dividers */}
      <line x1="4.5" y1="10" x2="4.5" y2="14" stroke="currentColor" strokeWidth="1" />
      <line x1="19.5" y1="10" x2="19.5" y2="14" stroke="currentColor" strokeWidth="1" />
      {/* Antenna */}
      <line x1="12" y1="7" x2="15" y2="2" stroke="currentColor" />
      <circle cx="15" cy="2" r="1" fill="currentColor" />
      {/* Center optical payload */}
      <circle cx="12" cy="12" r="2" stroke="currentColor" fill="rgba(56, 189, 248, 0.5)" />
    </svg>
  );
}
