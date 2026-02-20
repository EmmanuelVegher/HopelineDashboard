/**
 * Map Projection Utility
 * 
 * converts Real-world Latitude/Longitude to SVG X/Y coordinates
 * based on the 'nigeria.svg' geoViewBox and viewBox.
 * 
 */
// SVG ViewBox: 0 0 745 600
// Empirical Bounds from Path Data:
const MAP_MIN_X = 0;
const MAP_MIN_Y = 0;

const MAP_WIDTH = 745;
const MAP_HEIGHT = 600;

const MIN_LON = 2.65; // Shift West slightly to include Lagos (3.38E)
const MAX_LAT = 13.9;
const MAX_LON = 14.7;
const MIN_LAT = 4.25;

const LON_RANGE = MAX_LON - MIN_LON;
const LAT_RANGE = MAX_LAT - MIN_LAT;

export const geoToSvg = (lat: number, lon: number): { x: number, y: number } => {
    // 1. Normalize Longitude to 0-1 range (Left to Right)
    const xPct = (lon - MIN_LON) / LON_RANGE;

    // 2. Normalize Latitude to 0-1 range (Top to Bottom, so Max Lat is 0)
    // SVG Y grows downwards, so strict linear interpolation from Top (MaxLat) to Bottom (MinLat)
    const yPct = (MAX_LAT - lat) / LAT_RANGE;

    // 3. Scale to SVG Dimensions and Offset
    // (xPct * Width) + MinX, because the map starts at MinX, not 0
    const x = (xPct * MAP_WIDTH) + MAP_MIN_X;

    // (yPct * Height) + MinY
    const y = (yPct * MAP_HEIGHT) + MAP_MIN_Y;

    return { x, y };
};
