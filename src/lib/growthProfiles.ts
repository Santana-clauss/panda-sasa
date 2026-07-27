// Crop-specific growth-stage profiles, expressed as percentages of maturity.
// One profile per crop (and per variety where agronomy differs meaningfully).
// At runtime, start_pct/end_pct are scaled by the chosen variety's maturity_days
// so a 65-day cowpea and a 140-day maize each get correctly proportioned stages.

export type GrowthStagePct = {
  name: string;
  start_pct: number; // 0-100, percentage of total maturity
  end_pct: number; // 0-100
  description: string;
};

export type CropGrowthProfile = {
  crop: string;
  variety?: string; // omit = default for the crop
  maturity_days: number; // reference maturity (matches the crop's default variety)
  stages: GrowthStagePct[];
};

// --- Profiles (agronomically accurate per crop) ---

const MAIZE: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 6, description: 'Seed absorbs water, radicle and coleoptile emerge' },
  { name: 'Seedling', start_pct: 6, end_pct: 18, description: 'Leaves develop, root system establishes' },
  { name: 'Vegetative', start_pct: 18, end_pct: 38, description: 'Rapid stem and leaf growth; stem elongation' },
  { name: 'Tasseling', start_pct: 38, end_pct: 50, description: 'Tassel emerges, pollen shed begins' },
  { name: 'Silking', start_pct: 50, end_pct: 63, description: 'Silks emerge, pollination occurs' },
  { name: 'Grain filling', start_pct: 63, end_pct: 88, description: 'Kernels develop and fill with starch' },
  { name: 'Physiological maturity', start_pct: 88, end_pct: 100, description: 'Black layer forms, grain is dry' },
];

const BEANS: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 7, description: 'Seed imbibes water, radicle emerges' },
  { name: 'Seedling', start_pct: 7, end_pct: 20, description: 'Unifoliate leaves unfold' },
  { name: 'Vegetative', start_pct: 20, end_pct: 40, description: 'Trifoliate leaves, branching begins' },
  { name: 'Flowering', start_pct: 40, end_pct: 60, description: 'Flowers open, pollination' },
  { name: 'Pod fill', start_pct: 60, end_pct: 87, description: 'Pods develop, seeds fill' },
  { name: 'Maturity', start_pct: 87, end_pct: 100, description: 'Pods yellow, ready to harvest' },
];

const SORGHUM: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 6, description: 'Seed sprouts' },
  { name: 'Seedling', start_pct: 6, end_pct: 19, description: 'Establishment, first tillers' },
  { name: 'Vegetative', start_pct: 19, end_pct: 48, description: 'Rapid growth, stem elongation' },
  { name: 'Panicle initiation', start_pct: 48, end_pct: 62, description: 'Flower head forms inside boot' },
  { name: 'Flowering', start_pct: 62, end_pct: 76, description: 'Anthesis, pollen shed' },
  { name: 'Grain fill', start_pct: 76, end_pct: 95, description: 'Grains develop and harden' },
  { name: 'Maturity', start_pct: 95, end_pct: 100, description: 'Ready to harvest' },
];

const MILLETS: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 6, description: 'Seed sprouts' },
  { name: 'Seedling', start_pct: 6, end_pct: 23, description: 'Establishment, tillering' },
  { name: 'Vegetative', start_pct: 23, end_pct: 56, description: 'Tillering and stem elongation' },
  { name: 'Flowering', start_pct: 56, end_pct: 75, description: 'Head emergence and anthesis' },
  { name: 'Grain fill', start_pct: 75, end_pct: 94, description: 'Grains develop' },
  { name: 'Maturity', start_pct: 94, end_pct: 100, description: 'Ready to harvest' },
];

const COWPEAS: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 6, description: 'Seed sprouts' },
  { name: 'Seedling', start_pct: 6, end_pct: 20, description: 'Establishment' },
  { name: 'Vegetative', start_pct: 20, end_pct: 50, description: 'Vines spread, foliage develops' },
  { name: 'Flowering', start_pct: 50, end_pct: 71, description: 'Flowers open' },
  { name: 'Pod fill', start_pct: 71, end_pct: 93, description: 'Pods fill' },
  { name: 'Maturity', start_pct: 93, end_pct: 100, description: 'Ready to harvest' },
];

const GREEN_GRAMS: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 6, description: 'Seed sprouts' },
  { name: 'Seedling', start_pct: 6, end_pct: 22, description: 'Establishment' },
  { name: 'Vegetative', start_pct: 22, end_pct: 46, description: 'Growth and branching' },
  { name: 'Flowering', start_pct: 46, end_pct: 69, description: 'Flowers open' },
  { name: 'Pod fill', start_pct: 69, end_pct: 94, description: 'Pods fill' },
  { name: 'Maturity', start_pct: 94, end_pct: 100, description: 'Ready to harvest' },
];

const SWEET_POTATO: GrowthStagePct[] = [
  { name: 'Establishment', start_pct: 0, end_pct: 13, description: 'Vines root and establish' },
  { name: 'Vine growth', start_pct: 13, end_pct: 41, description: 'Rapid vine growth' },
  { name: 'Tuber initiation', start_pct: 41, end_pct: 55, description: 'Tubers begin to form' },
  { name: 'Tuber bulking', start_pct: 55, end_pct: 91, description: 'Tubers enlarge' },
  { name: 'Maturity', start_pct: 91, end_pct: 100, description: 'Ready to harvest' },
];

const POTATO: GrowthStagePct[] = [
  { name: 'Sprouting', start_pct: 0, end_pct: 8, description: 'Seed tubers sprout, first shoots emerge' },
  { name: 'Vegetative', start_pct: 8, end_pct: 30, description: 'Leaves and stems develop, canopy forms' },
  { name: 'Tuber initiation', start_pct: 30, end_pct: 50, description: 'Stolons swell, tubers begin to form' },
  { name: 'Tuber bulking', start_pct: 50, end_pct: 85, description: 'Tubers enlarge and accumulate starch' },
  { name: 'Maturation', start_pct: 85, end_pct: 100, description: 'Vines yellow and senesce, skins set' },
];

const CASSAVA: GrowthStagePct[] = [
  { name: 'Establishment', start_pct: 0, end_pct: 10, description: 'Cuttings sprout and root' },
  { name: 'Vegetative', start_pct: 10, end_pct: 40, description: 'Canopy develops' },
  { name: 'Tuber initiation', start_pct: 40, end_pct: 60, description: 'Tubers form' },
  { name: 'Tuber bulking', start_pct: 60, end_pct: 93, description: 'Tubers enlarge' },
  { name: 'Maturity', start_pct: 93, end_pct: 100, description: 'Ready to harvest' },
];

const GROUNDNUTS: GrowthStagePct[] = [
  { name: 'Germination', start_pct: 0, end_pct: 7, description: 'Seed sprouts' },
  { name: 'Seedling', start_pct: 7, end_pct: 20, description: 'Establishment' },
  { name: 'Vegetative', start_pct: 20, end_pct: 45, description: 'Growth' },
  { name: 'Flowering', start_pct: 45, end_pct: 60, description: 'Flowers open, pegging begins' },
  { name: 'Pod fill', start_pct: 60, end_pct: 90, description: 'Pods develop underground' },
  { name: 'Maturity', start_pct: 90, end_pct: 100, description: 'Ready to harvest' },
];

const TOMATO: GrowthStagePct[] = [
  { name: 'Nursery', start_pct: 0, end_pct: 23, description: 'Seedlings raised in nursery' },
  { name: 'Establishment', start_pct: 23, end_pct: 39, description: 'Transplant recovery' },
  { name: 'Vegetative', start_pct: 39, end_pct: 61, description: 'Rapid growth' },
  { name: 'Flowering', start_pct: 61, end_pct: 78, description: 'Flowers open' },
  { name: 'Fruit set', start_pct: 78, end_pct: 89, description: 'Fruits develop' },
  { name: 'Maturity', start_pct: 89, end_pct: 100, description: 'Fruits ripen' },
];

export const CROP_GROWTH_PROFILES: CropGrowthProfile[] = [
  { crop: 'Maize', maturity_days: 120, stages: MAIZE },
  { crop: 'Beans', maturity_days: 75, stages: BEANS },
  { crop: 'Sorghum', maturity_days: 105, stages: SORGHUM },
  { crop: 'Millets', maturity_days: 80, stages: MILLETS },
  { crop: 'Cowpeas', maturity_days: 70, stages: COWPEAS },
  { crop: 'Green Grams', maturity_days: 65, stages: GREEN_GRAMS },
  { crop: 'Sweet Potato', maturity_days: 110, stages: SWEET_POTATO },
  { crop: 'Potato', maturity_days: 90, stages: POTATO },
  { crop: 'Cassava', maturity_days: 300, stages: CASSAVA },
  { crop: 'Groundnuts', maturity_days: 100, stages: GROUNDNUTS },
  { crop: 'Tomato', maturity_days: 90, stages: TOMATO },
];

// Lookup the growth profile for a crop (and optionally a specific variety).
// Falls back to the crop's default profile if no variety-specific one exists.
export function getGrowthProfile(cropName: string, varietyName?: string): CropGrowthProfile | null {
  const crop = cropName.trim().toLowerCase();
  if (varietyName) {
    const v = varietyName.trim().toLowerCase();
    const exact = CROP_GROWTH_PROFILES.find(
      (p) => p.crop.toLowerCase() === crop && p.variety?.toLowerCase() === v,
    );
    if (exact) return exact;
  }
  return CROP_GROWTH_PROFILES.find((p) => p.crop.toLowerCase() === crop && !p.variety) ?? null;
}

// Convert a percentage-based stage to absolute day range for a given maturity.
export function stageDayRange(stage: GrowthStagePct, maturityDays: number): { startDay: number; endDay: number } {
  return {
    startDay: Math.round((stage.start_pct / 100) * maturityDays),
    endDay: Math.round((stage.end_pct / 100) * maturityDays),
  };
}

// The single source of truth for "what stage is this crop in right now."
export type CurrentStageResult = {
  stageName: string | null;
  stageDescription: string | null;
  stageIndex: number; // -1 if before planting or no stage
  dayInSeason: number; // days since planting start (0+ if planted)
  maturityDays: number;
  isBeforePlanting: boolean;
  isPastHarvest: boolean;
  progressPercent: number; // 0-100
  harvestDate: string; // ISO date
};

export function getCurrentStage(
  plantingStartDate: string,
  cropName: string,
  varietyName: string | null | undefined,
  today: Date = new Date(),
): CurrentStageResult | null {
  const profile = getGrowthProfile(cropName, varietyName ?? undefined);
  if (!profile) return null;

  const planting = new Date(plantingStartDate);
  if (isNaN(planting.getTime())) return null;

  const maturityDays = profile.maturity_days;
  const harvestDate = new Date(planting);
  harvestDate.setDate(harvestDate.getDate() + maturityDays);

  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const plantingMidnight = new Date(planting.getFullYear(), planting.getMonth(), planting.getDate());

  const isBeforePlanting = todayMidnight < plantingMidnight;
  if (isBeforePlanting) {
    return {
      stageName: null,
      stageDescription: null,
      stageIndex: -1,
      dayInSeason: 0,
      maturityDays,
      isBeforePlanting: true,
      isPastHarvest: false,
      progressPercent: 0,
      harvestDate: harvestDate.toISOString().slice(0, 10),
    };
  }

  const dayInSeason = Math.floor((todayMidnight.getTime() - plantingMidnight.getTime()) / 86400000);
  const isPastHarvest = dayInSeason > maturityDays;

  let stageName: string | null = null;
  let stageDescription: string | null = null;
  let stageIndex = -1;

  for (let i = 0; i < profile.stages.length; i++) {
    const { startDay, endDay } = stageDayRange(profile.stages[i], maturityDays);
    if (dayInSeason >= startDay && dayInSeason <= endDay) {
      stageName = profile.stages[i].name;
      stageDescription = profile.stages[i].description;
      stageIndex = i;
      break;
    }
  }

  // If past the last stage's end day but not flagged past harvest (rounding), clamp to last stage.
  if (!stageName && !isPastHarvest) {
    const last = profile.stages[profile.stages.length - 1];
    stageName = last.name;
    stageDescription = last.description;
    stageIndex = profile.stages.length - 1;
  }

  const progressPercent = Math.max(0, Math.min(100, (dayInSeason / maturityDays) * 100));

  return {
    stageName,
    stageDescription,
    stageIndex,
    dayInSeason,
    maturityDays,
    isBeforePlanting: false,
    isPastHarvest,
    progressPercent,
    harvestDate: harvestDate.toISOString().slice(0, 10),
  };
}
