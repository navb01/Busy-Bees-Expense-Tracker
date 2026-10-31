import React, { useId } from 'react';
import { LogoVariant } from '../types';

export interface BusyBeesLogoProps {
  /**
   * Logo design concept:
   * - 'swoosh' (Option 1 — Primary Default): Golden honeybee swooping through the loop of a bold Indian Rupee (₹) sign with a golden motion trail.
   * - 'monogram' (Option 2 — Preserved Secondary): Minimalist geometric Bee + ₹ negative-space hexagonal honeycomb crest.
   * - 'mascot' (Option 3 — Preserved Secondary): 3D-styled friendly bee mascot zooming around a gleaming gold Rupee (₹) coin.
   */
  variant?: LogoVariant;
  /**
   * Pixel diameter or preset size token.
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'splash' | number;
  /**
   * Whether the bee, wings, and golden trail animate.
   * Per user preference: true on Splash & Welcome screens, false (static) in the Top Header, Drawer, and PDF Report.
   */
  animated?: boolean;
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'splash', number> = {
  xs: 28,
  sm: 36,
  md: 42,
  lg: 56,
  xl: 80,
  splash: 232,
};

export const BusyBeesLogo: React.FC<BusyBeesLogoProps> = ({
  variant = 'swoosh',
  size = 'md',
  animated = false,
  className = '',
  title = 'Busy Bees Expense Tracker',
}) => {
  const uid = useId().replace(/:/g, '');
  const px = typeof size === 'number' ? size : SIZE_MAP[size] || 42;

  return (
    <div
      style={{ width: px, height: px }}
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${className}`}
      role="img"
      aria-label={title}
      title={title}
    >
      {variant === 'swoosh' && <SwooshRupeeBeeSvg uid={uid} animated={animated} />}
      {variant === 'monogram' && <MonogramHoneycombRupeeSvg uid={uid} animated={animated} />}
      {variant === 'mascot' && <MascotGoldCoinRupeeSvg uid={uid} animated={animated} />}
    </div>
  );
};

/**
 * CONCEPT 1 (Primary Default — Option 1):
 * Golden honeybee dynamically swooping/weaving through the curved loop of a bold Indian Rupee (₹) symbol
 * with a shimmering golden flight trail on a Royal Blue (#2357A4) medallion.
 */
const SwooshRupeeBeeSvg: React.FC<{ uid: string; animated: boolean }> = ({ uid, animated }) => {
  const bgGradId = `bb-swoosh-bg-${uid}`;
  const rimGradId = `bb-swoosh-rim-${uid}`;
  const goldGradId = `bb-swoosh-gold-${uid}`;
  const wingGradId = `bb-swoosh-wing-${uid}`;
  const trailGradId = `bb-swoosh-trail-${uid}`;
  const shadowId = `bb-swoosh-shadow-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Rich Royal Blue Medallion Gradient */}
        <radialGradient id={bgGradId} cx="32%" cy="26%" r="76%">
          <stop offset="0%" stopColor="#2B6CB0" />
          <stop offset="55%" stopColor="#2357A4" />
          <stop offset="100%" stopColor="#15376B" />
        </radialGradient>

        {/* Warm Honey-Gold Metallic Rim Accent */}
        <linearGradient id={rimGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Golden Bee Body Gradient */}
        <linearGradient id={goldGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>

        {/* Translucent Pearlescent Wing Gradient */}
        <linearGradient id={wingGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.96" />
          <stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.78" />
        </linearGradient>

        {/* Swooping Flight Trail Gradient */}
        <linearGradient id={trailGradId} x1="12%" y1="78%" x2="86%" y2="24%">
          <stop offset="0%" stopColor="#FDE047" stopOpacity="0.15" />
          <stop offset="45%" stopColor="#FBBF24" stopOpacity="0.92" />
          <stop offset="100%" stopColor="#FEF08A" stopOpacity="1" />
        </linearGradient>

        <filter id={shadowId} x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="#091936" floodOpacity="0.38" />
        </filter>
      </defs>

      {/* Outer Medallion Base */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill={`url(#${bgGradId})`}
        stroke={`url(#${rimGradId})`}
        strokeWidth="3.8"
      />

      {/* Subtle Inner Ring for Emblem Depth */}
      <circle
        cx="50"
        cy="50"
        r="41.5"
        fill="none"
        stroke="#93C5FD"
        strokeOpacity="0.22"
        strokeWidth="1"
      />

      {/* Subtle Honeycomb Geometry in Upper-Left Background */}
      <g stroke="#60A5FA" strokeOpacity="0.14" strokeWidth="1" fill="none">
        <polygon points="24,24 29,21 34,24 34,30 29,33 24,30" />
        <polygon points="34,24 39,21 44,24 44,30 39,33 34,30" />
        <polygon points="29,33 34,30 39,33 39,39 34,42 29,39" />
      </g>

      {/* BACK LAYER OF SWOOPING TRAIL: Sweeps from bottom-left behind the ₹ stem */}
      <path
        d="M 16 68 C 22 76, 38 72, 48 55"
        fill="none"
        stroke={`url(#${trailGradId})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        className={animated ? 'animate-bb-trail' : ''}
      />

      {/* BOLD INDIAN RUPEE (₹) SYMBOL — Centered slightly left to frame the swooping bee */}
      <g filter={`url(#${shadowId})`}>
        {/* Top Horizontal Bar of ₹ */}
        <path
          d="M 25 27 H 63"
          stroke="#FFFFFF"
          strokeWidth="6.8"
          strokeLinecap="round"
        />
        {/* Second Horizontal Bar of ₹ */}
        <path
          d="M 25 39.5 H 60"
          stroke="#FFFFFF"
          strokeWidth="5.8"
          strokeLinecap="round"
        />
        {/* Curved Right Loop & Diagonal Leg of ₹ (Open on the left like authentic ₹) */}
        <path
          d="M 38 27 H 44.5 C 54.8 27, 59.5 32.8, 59.5 40 C 59.5 47.4, 54.2 52.8, 43.5 52.8 H 33.5 L 59.5 77.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="6.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* FRONT LAYER OF SWOOPING GOLDEN TRAIL: Threads THROUGH the ₹ loop toward the Bee */}
      <path
        d="M 44 51 C 50 43, 55 37, 65 35"
        fill="none"
        stroke="#FDE047"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
      {/* Secondary Dashed Motion Arc */}
      <path
        d="M 20 71 C 32 76, 48 54, 63 36"
        fill="none"
        stroke="#FEF08A"
        strokeWidth="1.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity="0.85"
      />

      {/* Overlap Clip of ₹ Top Bar so the Bee & Trail truly weave INSIDE the ₹ aperture */}
      <path
        d="M 45 27 H 61"
        stroke="#FFFFFF"
        strokeWidth="6.8"
        strokeLinecap="round"
      />

      {/* ANIMATED / HERO HONEYBEE SWOOPING OUT OF THE RUPEE LOOP (Top-Right Quadrant) */}
      <g className={animated ? 'animate-bb-bee-swoop' : ''} filter={`url(#${shadowId})`}>
        {/* Translucent Left/Back Wing */}
        <g className={animated ? 'animate-bb-wing-left' : ''}>
          <ellipse
            cx="61"
            cy="24.5"
            rx="6.2"
            ry="10.5"
            transform="rotate(-28 61 24.5)"
            fill={`url(#${wingGradId})`}
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
          <path
            d="M 60 21 Q 62 25 63 30"
            stroke="#93C5FD"
            strokeWidth="0.9"
            fill="none"
          />
        </g>

        {/* Translucent Right/Front Wing */}
        <g className={animated ? 'animate-bb-wing-right' : ''}>
          <ellipse
            cx="68.5"
            cy="26"
            rx="5.5"
            ry="9.5"
            transform="rotate(18 68.5 26)"
            fill={`url(#${wingGradId})`}
            stroke="#FFFFFF"
            strokeWidth="1.1"
          />
        </g>

        {/* Bee Stinger */}
        <path
          d="M 55.5 39.5 L 51.2 42.2 L 56.8 36.8 Z"
          fill="#1E293B"
        />

        {/* Golden Bee Abdomen & Thorax (Tilted upward along the swoop angle -24deg) */}
        <g transform="rotate(-24 67 35)">
          {/* Golden Body Base */}
          <ellipse
            cx="66"
            cy="35"
            rx="11.5"
            ry="7.6"
            fill={`url(#${goldGradId})`}
            stroke="#1E293B"
            strokeWidth="1.8"
          />

          {/* Iconic Espresso/Navy Bee Stripes (Clipped cleanly to body contour) */}
          <path
            d="M 60.5 28.2 Q 62 35 60.5 41.8"
            stroke="#0F172A"
            strokeWidth="3.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 66.2 27.6 Q 67.8 35 66.2 42.4"
            stroke="#0F172A"
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 71.8 28.8 Q 73 35 71.8 41.2"
            stroke="#0F172A"
            strokeWidth="2.8"
            strokeLinecap="round"
            fill="none"
          />

          {/* Cute Bee Eye & Friendly Head Highlight */}
          <circle cx="74.6" cy="33.2" r="1.6" fill="#0F172A" />
          <circle cx="75.1" cy="32.7" r="0.65" fill="#FFFFFF" />

          {/* Perky Antennae */}
          <path
            d="M 75.5 30.2 Q 78.5 25.5 81.5 26.2"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="81.7" cy="26.2" r="1.3" fill="#FDE047" />
          <path
            d="M 76.8 32 Q 80.5 28.5 83 30"
            fill="none"
            stroke="#FEF08A"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="83.1" cy="30" r="1.2" fill="#FDE047" />
        </g>
      </g>

      {/* Golden Sparkle Stars Accentuating Clarity & Prosperity */}
      <g className={animated ? 'animate-bb-sparkle' : ''}>
        <path
          d="M 81 18 L 82.4 21.6 L 86 23 L 82.4 24.4 L 81 28 L 79.6 24.4 L 76 23 L 79.6 21.6 Z"
          fill="#FEF08A"
        />
      </g>
      <circle cx="21" cy="63" r="2" fill="#FDE047" opacity="0.9" />
      <circle cx="75" cy="68" r="2.2" fill="#FBBF24" opacity="0.85" />
    </svg>
  );
};

/**
 * CONCEPT 2 (Preserved Option 2):
 * Minimalist geometric Bee + ₹ negative-space hexagonal honeycomb monogram crest.
 */
const MonogramHoneycombRupeeSvg: React.FC<{ uid: string; animated: boolean }> = ({
  uid,
  animated,
}) => {
  const hexBgId = `bb-mono-bg-${uid}`;
  const hexGoldId = `bb-mono-gold-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={hexBgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1E3A8A" />
          <stop offset="55%" stopColor="#2357A4" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
        <linearGradient id={hexGoldId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </linearGradient>
      </defs>

      {/* Outer Geometric Hexagon Crest */}
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill={`url(#${hexBgId})`}
        stroke={`url(#${hexGoldId})`}
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* Inner Precision Hexagon Frame */}
      <polygon
        points="50,11 84,30.5 84,69.5 50,89 16,69.5 16,30.5"
        fill="none"
        stroke="#60A5FA"
        strokeOpacity="0.28"
        strokeWidth="1.2"
      />

      {/* Symmetrical Geometric Bee Wings (Negative Space Upper Arch) */}
      <g className={animated ? 'animate-bb-bee-swoop' : ''}>
        <path
          d="M 48 30 C 34 20, 21 26, 23 37 C 24.5 44, 36 44, 46 39 Z"
          fill="#93C5FD"
          fillOpacity="0.25"
          stroke="#FDE047"
          strokeWidth="2.2"
        />
        <path
          d="M 52 30 C 66 20, 79 26, 77 37 C 75.5 44, 64 44, 54 39 Z"
          fill="#93C5FD"
          fillOpacity="0.25"
          stroke="#FDE047"
          strokeWidth="2.2"
        />

        {/* Bee Antennae Crown */}
        <path
          d="M 45 22 L 40 15 M 55 22 L 60 15"
          stroke="#FDE047"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="40" cy="15" r="2" fill="#FEF08A" />
        <circle cx="60" cy="15" r="2" fill="#FEF08A" />
      </g>

      {/* Geometric Indian Rupee (₹) Integrated with Bee Thorax Stripes */}
      <g>
        {/* Top ₹ Bar = First Golden Bee Stripe */}
        <path
          d="M 31 32 H 69"
          stroke={`url(#${hexGoldId})`}
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Middle ₹ Bar = Second Golden Bee Stripe */}
        <path
          d="M 31 43.5 H 66"
          stroke={`url(#${hexGoldId})`}
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        {/* ₹ Curved Right Loop + Diagonal Leg in Crisp White (Open on the left) */}
        <path
          d="M 43 32 H 50 C 59 32, 64 37.2, 64 43.5 C 64 49.8, 59 55, 49 55 H 38.5 L 64 78"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Lower Bee Abdomen Chevron Stripes Flanking the ₹ Leg */}
        <path
          d="M 35 64 L 50 72 L 65 64"
          fill="none"
          stroke={`url(#${hexGoldId})`}
          strokeWidth="3.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 41 74 L 50 80 L 59 74"
          fill="none"
          stroke="#FDE047"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

/**
 * CONCEPT 3 (Preserved Option 3):
 * 3D-styled friendly mascot bee zooming around a gleaming gold Indian Rupee (₹) coin.
 */
const MascotGoldCoinRupeeSvg: React.FC<{ uid: string; animated: boolean }> = ({
  uid,
  animated,
}) => {
  const skyBgId = `bb-mascot-bg-${uid}`;
  const coinRimId = `bb-mascot-coin-rim-${uid}`;
  const coinFaceId = `bb-mascot-coin-face-${uid}`;
  const beeBodyId = `bb-mascot-bee-${uid}`;

  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id={skyBgId} cx="35%" cy="25%" r="75%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#2357A4" />
          <stop offset="100%" stopColor="#172554" />
        </radialGradient>

        <linearGradient id={coinRimId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>

        <radialGradient id={coinFaceId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="45%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </radialGradient>

        <radialGradient id={beeBodyId} cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="60%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#B45309" />
        </radialGradient>
      </defs>

      {/* Rounded Royal Blue Squircle/Circle Backdrop */}
      <circle
        cx="50"
        cy="50"
        r="47"
        fill={`url(#${skyBgId})`}
        stroke="#60A5FA"
        strokeOpacity="0.4"
        strokeWidth="2.5"
      />

      {/* 3D Gold Rupee Coin in Lower-Left Center */}
      <g transform="translate(-5, 6)">
        {/* 3D Coin Edge Thickness */}
        <circle cx="48" cy="53" r="27" fill="#92400E" />
        {/* Outer Gold Coin Rim */}
        <circle
          cx="46"
          cy="50"
          r="27"
          fill={`url(#${coinRimId})`}
          stroke="#FEF08A"
          strokeWidth="1.5"
        />
        {/* Inner Recessed Gold Coin Face */}
        <circle
          cx="46"
          cy="50"
          r="21.5"
          fill={`url(#${coinFaceId})`}
          stroke="#B45309"
          strokeWidth="1.2"
        />
        {/* Embossed Royal Blue & White ₹ Symbol on the Gold Coin (Open on the left) */}
        <g transform="translate(1, 0)">
          <path
            d="M 35 37 H 56 M 35 44 H 54 M 42 37 H 46.5 C 52 37, 55 40.2, 55 44 C 55 47.8, 52 51, 45.5 51 H 39.5 L 55 64.5"
            fill="none"
            stroke="#1E3A8A"
            strokeWidth="4.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 34.5 36.2 H 55.5 M 34.5 43.2 H 53.5 M 41.5 36.2 H 46 C 51.5 36.2, 54.5 39.4, 54.5 43.2 C 54.5 47, 51.5 50.2, 45 50.2 H 39 L 54.5 63.7"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>

      {/* Orbiting Motion Ring Around the Gold Coin */}
      <path
        d="M 16 66 C 12 42, 36 18, 66 24"
        fill="none"
        stroke="#FEF08A"
        strokeWidth="2.5"
        strokeDasharray="4 4"
        strokeLinecap="round"
        className={animated ? 'animate-bb-trail' : ''}
      />

      {/* 3D Mascot Chubby Bee Zooming Above the Coin */}
      <g className={animated ? 'animate-bb-bee-swoop' : ''}>
        {/* Wings */}
        <ellipse
          cx="62"
          cy="19"
          rx="6.5"
          ry="10.5"
          transform="rotate(-22 62 19)"
          fill="#FFFFFF"
          fillOpacity="0.9"
          stroke="#BFDBFE"
          strokeWidth="1.2"
          className={animated ? 'animate-bb-wing-left' : ''}
        />
        <ellipse
          cx="71"
          cy="20"
          rx="6"
          ry="9.5"
          transform="rotate(20 71 20)"
          fill="#FFFFFF"
          fillOpacity="0.92"
          stroke="#BFDBFE"
          strokeWidth="1.2"
          className={animated ? 'animate-bb-wing-right' : ''}
        />

        {/* Chubby 3D Bee Body */}
        <ellipse
          cx="68"
          cy="32"
          rx="14"
          ry="10.5"
          transform="rotate(-12 68 32)"
          fill={`url(#${beeBodyId})`}
          stroke="#0F172A"
          strokeWidth="2"
        />

        {/* Stripes */}
        <path
          d="M 60 23.5 Q 61.5 32 59.5 40.5"
          stroke="#0F172A"
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 66.5 22.2 Q 68 32 66 41.8"
          stroke="#0F172A"
          strokeWidth="3.6"
          strokeLinecap="round"
          fill="none"
        />

        {/* Expressive Mascot Eyes & Smile */}
        <circle cx="75.5" cy="29.5" r="2.3" fill="#0F172A" />
        <circle cx="76.2" cy="28.8" r="0.9" fill="#FFFFFF" />
        <circle cx="74.5" cy="33.2" r="1.6" fill="#F43F5E" opacity="0.65" />
        <path
          d="M 75.5 34.5 Q 78 36 79.5 34"
          fill="none"
          stroke="#0F172A"
          strokeWidth="1.4"
          strokeLinecap="round"
        />

        {/* Antennae */}
        <path
          d="M 74 22 Q 77 16 81 17"
          fill="none"
          stroke="#FEF08A"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="81" cy="17" r="1.7" fill="#FDE047" />
      </g>

      {/* Sparkle Accents */}
      <g className={animated ? 'animate-bb-sparkle' : ''}>
        <path
          d="M 22 24 L 23.2 27.2 L 26.5 28.5 L 23.2 29.8 L 22 33 L 20.8 29.8 L 17.5 28.5 L 20.8 27.2 Z"
          fill="#FEF08A"
        />
      </g>
    </svg>
  );
};
