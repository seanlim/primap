// Mapbox configuration
// Set NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local
export const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

// Singapore center coordinates
export const DEFAULT_CENTER: [number, number] = [103.8198, 1.3521]
export const DEFAULT_ZOOM = 11

// Map style
export const MAP_STYLE = 'mapbox://styles/mapbox/outdoors-v12'
