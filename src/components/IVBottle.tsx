import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { PatientStatus } from '../types';

interface IVBottleProps {
  remainingPercentage?: number | null;
  currentVolume: number | null;
  initialVolume: number;
  dripRate?: number | null;
  status?: PatientStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

function IVBottleComponent({
  remainingPercentage,
  currentVolume,
  initialVolume,
  dripRate = 0,
  status,
  size = 'lg',
}: IVBottleProps) {
  // Treat initial volume as safeInitialVol (minimum 10 mL to avoid div by zero)
  const safeInitialVol =
    typeof initialVolume === 'number' && !isNaN(initialVolume) && initialVolume > 0
      ? initialVolume
      : 500;

  // Validate currentVolume: missing, null, or invalid values must show "No Data"
  const isVolumeValid =
    currentVolume !== null &&
    currentVolume !== undefined &&
    !isNaN(Number(currentVolume)) &&
    Number(currentVolume) >= 0;

  const isPercentageValid =
    remainingPercentage !== null &&
    remainingPercentage !== undefined &&
    !isNaN(Number(remainingPercentage));

  const isNoData =
    (status === 'NO_DATA' && !isVolumeValid && !isPercentageValid) ||
    (!isVolumeValid && !isPercentageValid);

  const safeCurrentVol = isVolumeValid ? Number(currentVolume) : null;

  // Calculate percentage: volumePercentage = (currentVolume / initialVolume) * 100
  // Clamped between 0 and 100: Math.max(0, Math.min(100, volumePercentage))
  let volumePercentage: number | null = null;
  if (!isNoData) {
    if (safeCurrentVol !== null) {
      volumePercentage = Math.max(0, Math.min(100, (safeCurrentVol / safeInitialVol) * 100));
    } else if (remainingPercentage !== null && remainingPercentage !== undefined && !isNaN(Number(remainingPercentage))) {
      volumePercentage = Math.max(0, Math.min(100, Number(remainingPercentage)));
    }
  }

  const pct = volumePercentage !== null ? Math.round(volumePercentage * 10) / 10 : 0;
  const safeDripRate = typeof dripRate === 'number' && !isNaN(dripRate) ? Math.max(0, dripRate) : 0;

  // Formatted volume string using the exact currentVolume from Firebase
  const displayCurrentVolume =
    isNoData || safeCurrentVol === null
      ? '—'
      : safeCurrentVol < 10 && safeCurrentVol > 0
      ? safeCurrentVol.toFixed(1)
      : `${Math.round(safeCurrentVol)}`;

  // Clinical color hierarchy based on remaining percentage & status
  let fluidTheme = {
    top: '#10b981', // emerald-500
    bottom: '#047857', // emerald-700
    wave: '#34d399',
    marker: '#059669',
    text: 'text-emerald-700',
    bgLight: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    badgeBg: '#ecfdf5',
    badgeBorder: '#6ee7b7',
    badgeText: '#065f46',
    badgeSub: '#047857',
  };

  const isStopped = status === 'MONITORING_STOPPED' || status === 'STOPPED';

  if (isNoData || isStopped) {
    fluidTheme = {
      top: '#94a3b8',
      bottom: '#64748b',
      wave: '#cbd5e1',
      marker: '#64748b',
      text: 'text-slate-500',
      bgLight: 'bg-slate-100 border-slate-300 text-slate-600',
      badgeBg: '#f8fafc',
      badgeBorder: '#cbd5e1',
      badgeText: '#475569',
      badgeSub: '#64748b',
    };
  } else if (pct < 10 || status === 'CRITICAL_VOLUME') {
    fluidTheme = {
      top: '#f43f5e', // rose-500
      bottom: '#be123c', // rose-700
      wave: '#fb7185',
      marker: '#e11d48',
      text: 'text-rose-700',
      bgLight: 'bg-rose-50 border-rose-300 text-rose-800 animate-pulse',
      badgeBg: '#fff1f2',
      badgeBorder: '#fda4af',
      badgeText: '#9f1239',
      badgeSub: '#be123c',
    };
  } else if (pct <= 20 || status === 'LOW_VOLUME') {
    fluidTheme = {
      top: '#f59e0b', // amber-500
      bottom: '#b45309', // amber-700
      wave: '#fcd34d',
      marker: '#d97706',
      text: 'text-amber-700',
      bgLight: 'bg-amber-50 border-amber-300 text-amber-800',
      badgeBg: '#fffbeb',
      badgeBorder: '#fcd34d',
      badgeText: '#92400e',
      badgeSub: '#b45309',
    };
  }

  const dimensions = {
    sm: { width: 170, height: 250 },
    md: { width: 220, height: 320 },
    lg: { width: 270, height: 390 },
  }[size];

  // SVG coordinate geometry: ViewBox 0 0 240 370
  // Usable interior chamber coordinates:
  // 100% capacity (initialVolume mL): y = 52 (top shoulder)
  // 0% capacity (0 mL / empty): y = 280 (bottom base above neck)
  // Total usable chamber height = 228 px
  const CHAMBER_TOP_Y = 52;
  const CHAMBER_BOTTOM_Y = 280;
  const CHAMBER_HEIGHT = CHAMBER_BOTTOM_Y - CHAMBER_TOP_Y; // 228 px

  // Exact vertical position of the fluid surface (meniscus)
  const fluidY =
    isNoData || volumePercentage === null || pct <= 0
      ? CHAMBER_BOTTOM_Y
      : CHAMBER_BOTTOM_Y - (pct / 100) * CHAMBER_HEIGHT;

  // Drip rate animation duration (seconds per droplet)
  const dripIntervalSec = !isStopped && safeDripRate > 0 ? Math.max(0.4, Math.min(4, 60 / safeDripRate)) : 0;

  // Volumetric ruler graduation steps adapted to container size (memoized)
  const graduationMarks = useMemo(() => {
    const majorStep =
      safeInitialVol <= 100
        ? 20
        : safeInitialVol <= 250
        ? 50
        : safeInitialVol <= 500
        ? 100
        : safeInitialVol <= 1000
        ? 200
        : 250;

    const minorStep = majorStep / 2;
    const marks: { y: number; vol: number; isMajor: boolean }[] = [];
    for (let v = 0; v <= safeInitialVol; v += minorStep) {
      const fraction = v / safeInitialVol;
      const y = CHAMBER_BOTTOM_Y - fraction * CHAMBER_HEIGHT;
      const isMajor = v % majorStep === 0 || v === safeInitialVol || v === 0;
      marks.push({ y, vol: Math.round(v), isMajor });
    }
    return marks;
  }, [safeInitialVol]);

  // Floating tag Y position clamped inside viewable canvas
  const tagY = Math.max(48, Math.min(256, fluidY - 11));

  return (
    <div className="flex flex-col items-center justify-center p-1 select-none w-full">
      <div className="relative flex items-center justify-center">
        <svg
          width={dimensions.width}
          height={dimensions.height}
          viewBox="0 0 240 370"
          className="drop-shadow-md overflow-visible max-w-full h-auto"
        >
          <defs>
            {/* Fluid fill gradient */}
            <linearGradient id={`iv-fluid-grad-${size}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fluidTheme.top} stopOpacity="0.88" />
              <stop offset="100%" stopColor={fluidTheme.bottom} stopOpacity="0.96" />
            </linearGradient>

            {/* Translucent glass reflection */}
            <linearGradient id={`glass-reflection-${size}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="25%" stopColor="#ffffff" stopOpacity="0.08" />
              <stop offset="75%" stopColor="#ffffff" stopOpacity="0.0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.35" />
            </linearGradient>

            {/* Accurate inner bottle clipping path (covers container interior chamber) */}
            <clipPath id={`bottle-clip-${size}`}>
              <path d="M 94,40 C 72,40 52,50 52,62 L 52,266 C 52,278 74,286 98,286 L 122,286 C 146,286 168,278 168,266 L 168,62 C 168,50 148,40 126,40 Z" />
            </clipPath>
          </defs>

          {/* Top Hanger Loop & IV Pole Hook */}
          <path
            d="M 96,14 C 96,7 124,7 124,14 L 124,30 L 96,30 Z"
            fill="none"
            stroke="#64748b"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <circle cx="110" cy="13" r="4.5" fill="#e2e8f0" stroke="#475569" strokeWidth="2" />

          {/* Top Base Cap Band */}
          <rect x="92" y="30" width="36" height="10" rx="2.5" fill="#64748b" stroke="#475569" strokeWidth="1" />

          {/* Bottle Outer Glass Outline & Background */}
          <path
            d="M 94,40 C 72,40 52,50 52,62 L 52,266 C 52,278 74,286 98,286 L 122,286 C 146,286 168,278 168,266 L 168,62 C 168,50 148,40 126,40 Z"
            fill="#f8fafc"
            stroke="#94a3b8"
            strokeWidth="2.5"
          />

          {/* Inner Liquid Body (Clipped strictly inside bottle shape) */}
          <g clipPath={`url(#bottle-clip-${size})`}>
            {/* Animated Liquid Fill Rect - Fills from fluidY down to bottom of bottle */}
            {!isNoData && pct > 0 && (
              <motion.rect
                x="48"
                y={fluidY}
                width="124"
                height={Math.max(0, 290 - fluidY)}
                fill={`url(#iv-fluid-grad-${size})`}
                initial={false}
                animate={{ y: fluidY, height: Math.max(0, 290 - fluidY) }}
                transition={{ type: 'spring', damping: 24, stiffness: 65 }}
              />
            )}

            {/* Meniscus Wave & Liquid Surface Reflection */}
            {!isNoData && pct > 0 && pct < 100 && (
              <motion.path
                d={`M 50,${fluidY} Q 80,${fluidY - 3} 110,${fluidY} T 170,${fluidY} L 170,${fluidY + 6} L 50,${fluidY + 6} Z`}
                fill="#ffffff"
                opacity="0.45"
                animate={{ y: [0, -1.5, 0] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              />
            )}

            {/* Micro Rising Bubbles when infusion is flowing */}
            {!isNoData && safeDripRate > 0 && pct > 5 && (
              <>
                <motion.circle
                  cx="85"
                  r="2.5"
                  fill="#ffffff"
                  opacity="0.6"
                  animate={{ cy: [270, fluidY + 8], opacity: [0.6, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeOut' }}
                />
                <motion.circle
                  cx="135"
                  r="3.5"
                  fill="#ffffff"
                  opacity="0.5"
                  animate={{ cy: [270, fluidY + 12], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 2.4, delay: 0.8, ease: 'easeOut' }}
                />
              </>
            )}

            {/* Glass Surface Sheen & Highlights */}
            <rect x="52" y="40" width="116" height="246" fill={`url(#glass-reflection-${size})`} />
          </g>

          {/* Volumetric Graduation Scale Marks (Directly mapped to volume) */}
          <g>
            {/* Scale Header 'mL' */}
            <text
              x="42"
              y="48"
              fontSize="8"
              fontWeight="800"
              fill="#64748b"
              textAnchor="end"
              fontFamily="sans-serif"
            >
              mL
            </text>

            {graduationMarks.map((tick) => (
              <g key={`tick-${tick.vol}-${tick.y}`}>
                {/* Left Tick Line into bottle */}
                <line
                  x1="44"
                  y1={tick.y}
                  x2={tick.isMajor ? "64" : "56"}
                  y2={tick.y}
                  stroke={tick.isMajor ? "#334155" : "#64748b"}
                  strokeWidth={tick.isMajor ? "1.8" : "1.0"}
                  opacity={tick.isMajor ? "0.9" : "0.55"}
                />

                {/* Major Volumetric Number on Left */}
                {tick.isMajor && (
                  <text
                    x="40"
                    y={tick.y + 3}
                    fontSize="8.5"
                    fontWeight="700"
                    fill="#1e293b"
                    textAnchor="end"
                    fontFamily="sans-serif"
                  >
                    {tick.vol}
                  </text>
                )}

                {/* Right Symmetrical Tick Line */}
                <line
                  x1={tick.isMajor ? "156" : "164"}
                  y1={tick.y}
                  x2="176"
                  y2={tick.y}
                  stroke={tick.isMajor ? "#334155" : "#64748b"}
                  strokeWidth={tick.isMajor ? "1.8" : "1.0"}
                  opacity={tick.isMajor ? "0.9" : "0.55"}
                />
              </g>
            ))}
          </g>

          {/* Real-Time Surface Level Marker & Pointer */}
          {!isNoData && pct > 0 && (
            <g>
              {/* Full-width dashed line tracking fluid meniscus */}
              <motion.line
                x1="52"
                y1={fluidY}
                x2="182"
                y2={fluidY}
                stroke={fluidTheme.marker}
                strokeWidth="2"
                strokeDasharray="4 2"
                opacity="0.9"
                animate={{ y1: fluidY, y2: fluidY }}
                transition={{ type: 'spring', damping: 24, stiffness: 65 }}
              />

              {/* Arrow pointing at exact fluid level */}
              <motion.polygon
                points={`182,${fluidY} 188,${fluidY - 4.5} 188,${fluidY + 4.5}`}
                fill={fluidTheme.marker}
                animate={{
                  points: `182,${fluidY} 188,${fluidY - 4.5} 188,${fluidY + 4.5}`,
                }}
                transition={{ type: 'spring', damping: 24, stiffness: 65 }}
              />

              {/* Floating Level Readout Badge on the right */}
              <motion.g
                animate={{ y: tagY }}
                transition={{ type: 'spring', damping: 24, stiffness: 65 }}
              >
                <rect
                  x="188"
                  y="0"
                  width="48"
                  height="22"
                  rx="4"
                  fill={fluidTheme.badgeBg}
                  stroke={fluidTheme.badgeBorder}
                  strokeWidth="1.2"
                  filter="drop-shadow(0 1px 3px rgb(0 0 0 / 0.12))"
                />
                <text
                  x="212"
                  y="9.5"
                  fontSize="8.5"
                  fontWeight="800"
                  fill={fluidTheme.badgeText}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {displayCurrentVolume} mL
                </text>
                <text
                  x="212"
                  y="18"
                  fontSize="7.5"
                  fontWeight="700"
                  fill={fluidTheme.badgeSub}
                  textAnchor="middle"
                  fontFamily="sans-serif"
                >
                  {Math.round(pct)}%
                </text>
              </motion.g>
            </g>
          )}

          {/* Bottom Neck Collar & Rubber Stopper */}
          <rect x="94" y="286" width="32" height="10" rx="2" fill="#475569" stroke="#334155" strokeWidth="1" />

          {/* Transparent Drip Chamber */}
          <rect
            x="98"
            y="296"
            width="24"
            height="36"
            rx="4"
            fill="#f8fafc"
            stroke="#64748b"
            strokeWidth="1.5"
            opacity="0.95"
          />
          {/* Fluid in drip chamber reservoir */}
          <rect x="99" y="320" width="22" height="11" fill={fluidTheme.bottom} opacity="0.9" rx="2" />

          {/* Internal Dropper Nozzle */}
          <path d="M 106,296 L 114,296 L 111,303 L 109,303 Z" fill="#334155" />

          {/* Animated Falling Droplet */}
          {!isNoData && dripIntervalSec > 0 && (
            <motion.circle
              cx="110"
              cy="304"
              r="2.5"
              fill={fluidTheme.top}
              animate={{ cy: [304, 321], scale: [0.8, 1, 0.4], opacity: [1, 1, 0] }}
              transition={{ repeat: Infinity, duration: dripIntervalSec, ease: 'easeIn' }}
            />
          )}

          {/* Infusion Tube Line going down */}
          <path
            d="M 110,332 L 110,356 C 110,360 113,364 117,364"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* High-Contrast Clinical Summary Readout */}
      <div className="mt-3 text-center">
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border shadow-2xs ${fluidTheme.bgLight}`}
        >
          {isNoData ? (
            'No Data'
          ) : (
            <>
              <span>{displayCurrentVolume} mL</span>
              <span className="opacity-60 font-normal">/ {safeInitialVol} mL</span>
              <span className="font-extrabold ml-1">({Math.round(pct)}%)</span>
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export const IVBottle = React.memo(IVBottleComponent);
