// Browser geolocation + Nominatim reverse geocoding + nearest-county matching
import { COUNTIES, type County } from './data';

export type Located = {
  latitude: number;
  longitude: number;
  county: County;
  accuracyMeters?: number;
  subCounty?: string;
  ward?: string;
  village?: string;
  displayName?: string;
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

type NominatimResponse = {
  address: {
    county?: string;
    state?: string;
    suburb?: string;
    town?: string;
    village?: string;
    city?: string;
    city_district?: string;
    neighbourhood?: string;
    road?: string;
  };
  display_name: string;
};

export async function reverseGeocode(lat: number, lon: number): Promise<{
  subCounty?: string;
  ward?: string;
  village?: string;
  displayName?: string;
}> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&accept-language=en`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'Accept-Language': 'en',
      },
    });
    if (!res.ok) return {};
    const data: NominatimResponse = await res.json();
    const addr = data.address ?? {};
    return {
      subCounty: addr.county || addr.state || addr.city_district || addr.suburb || undefined,
      ward: addr.town || addr.city || addr.neighbourhood || undefined,
      village: addr.village || undefined,
      displayName: data.display_name ?? undefined,
    };
  } catch {
    return {};
  }
}

// Returns a promise that resolves with the user's location and nearest county.
// Rejects if geolocation is unavailable or denied.
export async function detectLocation(): Promise<Located> {
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by this browser.');
  }

  const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 600000,
    });
  });

  const { latitude, longitude, accuracy } = pos.coords;
  const county = nearestCounty(latitude, longitude);
  const geocoded = await reverseGeocode(latitude, longitude);

  return {
    latitude,
    longitude,
    county,
    accuracyMeters: accuracy,
    ...geocoded,
  };
}
