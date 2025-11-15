import { COLORS } from '../config/constants';

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * Converts hex color to RGB components
 * @param hex Hex color string (e.g., "#ff1744")
 * @returns RGB components
 */
function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

/**
 * Converts RGB components to hex color
 * @param r Red component (0-255)
 * @param g Green component (0-255)
 * @param b Blue component (0-255)
 * @returns Hex color string
 */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Interpolates between two colors based on a ratio
 * @param color1 Starting hex color
 * @param color2 Ending hex color
 * @param ratio Interpolation ratio (0-1)
 * @returns Interpolated hex color
 */
export function interpolateColor(color1: string, color2: string, ratio: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  const r = rgb1.r + (rgb2.r - rgb1.r) * ratio;
  const g = rgb1.g + (rgb2.g - rgb1.g) * ratio;
  const b = rgb1.b + (rgb2.b - rgb1.b) * ratio;

  return rgbToHex(r, g, b);
}

/**
 * Gets heatmap color for a given score (0-100)
 * Uses continuous gradient: Red (0) → Amber (50) → Green (100)
 * @param score Score value (0-100)
 * @returns Hex color for the score
 */
export function getHeatmapColor(score: number): string {
  // Clamp score to 0-100 range
  const clampedScore = Math.max(0, Math.min(100, score));

  if (clampedScore < 50) {
    // Red to Amber gradient (0-50)
    const ratio = clampedScore / 50;
    return interpolateColor(COLORS.RED_100, COLORS.AMBER_75, ratio);
  } else {
    // Amber to Green gradient (50-100)
    const ratio = (clampedScore - 50) / 50;
    return interpolateColor(COLORS.AMBER_75, COLORS.GREEN_100, ratio);
  }
}

/**
 * Gets text color for optimal contrast on a given background
 * @param backgroundColor Hex background color
 * @returns Either light or dark text color
 */
export function getContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);

  // Calculate relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;

  // Return dark text for light backgrounds, light text for dark backgrounds
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/**
 * Gets color class name based on score range
 * Useful for CSS classes if needed
 * @param score Score value (0-100)
 * @returns Color class name
 */
export function getScoreColorClass(score: number): string {
  if (score >= 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}