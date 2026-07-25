// Browser geolocation + nearest-county matching
import { COUNTIES, type County } from './data';

export type Located = {
  latitude: number;
  longitude: number;
  county: County;
  accuracyMeters?: number;
};

// Haversine distance in km
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function nearestCounty(lat: number, lon: number): County {
  let best = COUNTIES[0];
  let bestDist = Infinity;
  for (const c of COUNTIES) {
    const d = distanceKm(lat, lon, c.latitude, c.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best;
}

// Returns a promise that resolves with the user's location and nearest county.
// Rejects if geolocation is unavailable or denied.
export function detectLocation(): Promise<Located> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported by this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const county = nearestCounty(latitude, longitude);
        resolve({ latitude, longitude, county, accuracyMeters: accuracy });
      },
      (err) => {
        reject(new Error(err.message || 'Unable to detect your location.'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
    );
  });
}
