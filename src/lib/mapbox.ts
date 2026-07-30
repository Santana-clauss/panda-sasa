// Mapbox GL JS configuration & initialization helper
// Uses satellite-streets style with Kenya-centric defaults

import mapboxgl from 'mapbox-gl';

// Token from environment — set VITE_MAPBOX_TOKEN in .env
export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

// Kenya center coordinates (roughly Nairobi)
export const KENYA_CENTER: [number, number] = [37.9, 0.02];
export const KENYA_ZOOM = 5.8;

// Kenya bounding box [sw_lng, sw_lat, ne_lng, ne_lat]
export const KENYA_BOUNDS: mapboxgl.LngLatBoundsLike = [
  [33.9, -4.7],  // Southwest
  [41.9, 5.5],   // Northeast
];

// Rainfall zone color palette
export const RAINFALL_COLORS = {
  High: '#2563eb',    // blue-600
  Medium: '#16a34a',  // green-600
  Low: '#d97706',     // amber-600
} as const;

/**
 * Create a Mapbox GL map instance inside a container element.
 * Returns the map instance (caller should store it in a ref).
 */
export function createMap(container: HTMLElement): mapboxgl.Map {
  mapboxgl.accessToken = MAPBOX_TOKEN;

  const map = new mapboxgl.Map({
    container,
    style: 'mapbox://styles/mapbox/satellite-streets-v12',
    center: KENYA_CENTER,
    zoom: KENYA_ZOOM,
    maxBounds: [
      [30, -8],   // padded SW
      [45, 8],    // padded NE
    ],
    attributionControl: false,
  });

  // Add navigation controls (zoom +/- and compass)
  map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

  // Add scale bar
  map.addControl(new mapboxgl.ScaleControl({ maxWidth: 120 }), 'bottom-left');

  // Add attribution in compact mode
  map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');

  return map;
}

/**
 * Add the user's GPS location as a pulsing dot on the map.
 */
export function addUserLocationMarker(
  map: mapboxgl.Map,
  lat: number,
  lon: number,
): mapboxgl.Marker {
  // Create a pulsing dot element
  const el = document.createElement('div');
  el.className = 'user-location-marker';
  el.innerHTML = `
    <div style="
      width: 16px; height: 16px; border-radius: 50%;
      background: #3b82f6; border: 3px solid white;
      box-shadow: 0 0 0 0 rgba(59,130,246,0.4);
      animation: pulse-ring 2s ease-out infinite;
    "></div>
  `;

  const marker = new mapboxgl.Marker({ element: el })
    .setLngLat([lon, lat])
    .addTo(map);

  return marker;
}
