// FAO Crop Calendar API client
// API docs: https://api-cropcalendar.apps.fao.org/
// Fetches planting and harvest windows for a crop in a given country/region.

export type CropCalendarEntry = {
  cropName: string;
  plantingStart: string | null;
  plantingEnd: string | null;
  harvestStart: string | null;
  harvestEnd: string | null;
  agroEcologicalZone: string | null;
  source: 'FAO Crop Calendar' | 'KALRO Reference';
};

const FAO_BASE = 'https://api-cropcalendar.apps.fao.org/api';

type FAOCrop = {
  name: string;
  adm0_id?: number;
  adm1_id?: number;
  start_date?: string;
  end_date?: string;
  start_date2?: string;
  end_date2?: string;
  season?: string;
};

type FAOResponse = {
  crops?: FAOCrop[];
};

// Map our crop names to FAO crop calendar search terms
const CROP_SEARCH: Record<string, string> = {
  Maize: 'Maize',
  Beans: 'Beans',
  Sorghum: 'Sorghum',
  Millets: 'Millet',
  Cowpeas: 'Cowpea',
  'Green Grams': 'Mung bean',
  'Sweet Potato': 'Sweet potato',
  Potato: 'Potato',
  Cassava: 'Cassava',
  Groundnuts: 'Groundnut',
  Tomato: 'Tomato',
};

// Kenya ISO 3166-1 numeric code for FAO API
const KENYA_CODE = 114;

export async function fetchCropCalendar(cropName: string, _county?: string): Promise<CropCalendarEntry | null> {
  const searchName = CROP_SEARCH[cropName];
  if (!searchName) return null;

  try {
    const url = `${FAO_BASE}/crops?adm0_id=${KENYA_CODE}&crop=${encodeURIComponent(searchName)}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data: FAOResponse = await res.json();
    const crop = data.crops?.[0];
    if (!crop) return null;

    return {
      cropName,
      plantingStart: crop.start_date ?? null,
      plantingEnd: crop.end_date ?? null,
      harvestStart: crop.start_date2 ?? null,
      harvestEnd: crop.end_date2 ?? null,
      agroEcologicalZone: crop.season ?? null,
      source: 'FAO Crop Calendar',
    };
  } catch {
    return null;
  }
}

// Batch fetch for multiple crops. Returns a map keyed by crop name.
export async function fetchCropCalendars(cropNames: string[], county?: string): Promise<Record<string, CropCalendarEntry>> {
  const results: Record<string, CropCalendarEntry> = {};
  const entries = await Promise.all(
    cropNames.map(async (name) => {
      const entry = await fetchCropCalendar(name, county);
      return [name, entry] as const;
    }),
  );
  for (const [name, entry] of entries) {
    if (entry) results[name] = entry;
  }
  return results;
}
