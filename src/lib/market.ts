// /**
//  * MARKET DATA SOURCES — Smart Companion Farming Marketplace
//  * -----------------------------------------------------------------------
//  * Panda Sasa's marketplace connects three things around the farmer's
//  * actual farm data (crop suitability, county, season):
//  *   1. Crop Buyers        — verified buyers looking for specific crops
//  *   2. Input Suppliers     — seed / fertilizer / agrochemical / equipment /
//  *                            irrigation providers matched to what Panda
//  *                            Sasa recommends the farmer grow
//  *   3. Market Trends        — REAL WFP Food Prices for Kenya data (HDX),
//  *                            fetched client-side through a multi-proxy
//  *                            fallback chain (no single free CORS proxy is
//  *                            reliable alone). Real periodic survey data
//  *                            (updates ~monthly), not live — shown as such.
//  *
//  * Buyers + suppliers are HARDCODED for now (MOCK_OFFERS). Swap this list
//  * + fetchMarketOffers's body for a real API later — the function
//  * signature and MarketOffer shape won't need to change.
//  */

// export type MarketOffer = {
//   id: string;
//   type: 'buyer' | 'supplier';
//   name: string;
//   category: 'buyer' | 'seed supplier' | 'fertilizer' | 'agrochemical' | 'equipment' | 'irrigation';
//   location: string;
//   county: string;
//   product: string;
//   description: string;
//   price?: number;
//   currency?: string;
//   unit?: string;
//   needed?: string;
//   period?: string;
//   verified: boolean;
//   contactPerson: string;
//   contactPhone: string;
//   tags: string[];
//   distanceKm?: number;
//   // Kept from the prior buyer-only model — still needed for the existing
//   // deadline pill and "recently posted" sort. Optional so supplier
//   // listings (which usually don't have a hard deadline) can omit it.
//   deadline?: string; // ISO date
//   postedAt: string; // ISO date
// };

// export type PricePoint = { date: string; price: number };

// export type CropDemandTrend = {
//   crop: string;
//   demand: 'rising' | 'high' | 'stable' | 'falling';
//   note: string;
//   guidance: 'sell' | 'hold' | 'watch' | 'unknown';
//   guidanceNote: string;
//   unit?: string;
//   currency?: string;
//   currentPrice?: number;
//   pctChangeVsAvg?: number;
//   asOf?: string;
//   history?: PricePoint[];
// };

// // ---------------------------------------------------------------------
// // Hardcoded buyers + suppliers
// // ---------------------------------------------------------------------

// const MOCK_OFFERS: MarketOffer[] = [
//   // ---- Crop buyers -----------------------------------------------------
//   {
//     id: 'b1', type: 'buyer', name: 'Wafula Cereals Ltd', category: 'buyer',
//     location: 'Eldoret Branch', county: 'Uasin Gishu', product: 'Maize',
//     description: 'Bulk maize buyer supplying regional millers.',
//     price: 3800, currency: 'KES', unit: '90kg bag', needed: '500 Bags', period: 'Immediate',
//     deadline: '2026-08-15', postedAt: '2026-07-24', verified: true,
//     contactPerson: 'James Wafula', contactPhone: '+254 712 345 001', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 12,
//   },
//   {
//     id: 'b2', type: 'buyer', name: 'Prime Millers Co.', category: 'buyer',
//     location: 'Nairobi Central', county: 'Nairobi', product: 'Sorghum',
//     description: 'Contract milling partner sourcing sorghum for flour production.',
//     price: 4200, currency: 'KES', unit: '90kg bag', needed: '200 Bags', period: 'Sept 2026',
//     deadline: '2026-09-10', postedAt: '2026-07-20', verified: true,
//     contactPerson: 'Grace Mwangi', contactPhone: '+254 722 456 002', tags: ['Contract farming'], distanceKm: 48,
//   },
//   {
//     id: 'b3', type: 'buyer', name: 'Rift Valley Grain Traders', category: 'buyer',
//     location: 'Nakuru Town', county: 'Nakuru', product: 'Maize',
//     description: 'Regional grain trader with immediate collection capacity.',
//     price: 3950, currency: 'KES', unit: '90kg bag', needed: '350 Bags', period: 'Immediate',
//     deadline: '2026-08-05', postedAt: '2026-07-27', verified: true,
//     contactPerson: 'Peter Kiptoo', contactPhone: '+254 733 567 003', tags: ['Bulk order'], distanceKm: 6,
//   },
//   {
//     id: 'b4', type: 'buyer', name: 'Mombasa Agro Exports', category: 'buyer',
//     location: 'Mombasa Port', county: 'Kilifi', product: 'Cashew Nuts',
//     description: 'Export-grade cashew buyer shipping to Middle East markets.',
//     price: 9500, currency: 'KES', unit: '50kg bag', needed: '100 Bags', period: 'Oct 2026',
//     deadline: '2026-10-01', postedAt: '2026-07-18', verified: false,
//     contactPerson: 'Halima Said', contactPhone: '+254 701 678 004', tags: ['Export grade', 'Quality check required'], distanceKm: 90,
//   },
//   {
//     id: 'b5', type: 'buyer', name: 'Kisumu Rice Millers', category: 'buyer',
//     location: 'Kisumu Central', county: 'Kisumu', product: 'Rice',
//     description: 'Local rice miller buying paddy directly from Nyanza farmers.',
//     price: 5600, currency: 'KES', unit: '50kg bag', needed: '600 Bags', period: 'Immediate',
//     deadline: '2026-08-12', postedAt: '2026-07-25', verified: true,
//     contactPerson: 'Otieno Ochieng', contactPhone: '+254 745 789 005', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 15,
//   },
//   {
//     id: 'b6', type: 'buyer', name: 'Meru Dairy Cooperative', category: 'buyer',
//     location: 'Meru Town', county: 'Meru', product: 'Beans',
//     description: 'Cooperative sourcing beans for member households and resale.',
//     price: 8200, currency: 'KES', unit: '90kg bag', needed: '150 Bags', period: 'Aug 2026',
//     deadline: '2026-08-20', postedAt: '2026-07-22', verified: true,
//     contactPerson: 'Ann Kinya', contactPhone: '+254 756 890 006', tags: ['Contract farming'], distanceKm: 22,
//   },
//   {
//     id: 'b7', type: 'buyer', name: 'Machakos Fresh Produce', category: 'buyer',
//     location: 'Machakos Market', county: 'Machakos', product: 'Tomatoes',
//     description: 'Wholesale market vendor needing weekly tomato supply.',
//     price: 2100, currency: 'KES', unit: 'crate (64kg)', needed: '80 Crates', period: 'Immediate',
//     deadline: '2026-08-03', postedAt: '2026-07-28', verified: false,
//     contactPerson: 'Musyoka Kioko', contactPhone: '+254 720 901 007', tags: ['Perishable — quick pickup'], distanceKm: 9,
//   },
//   {
//     id: 'b8', type: 'buyer', name: 'Kiambu Fresh Greens', category: 'buyer',
//     location: 'Kiambu Town', county: 'Kiambu', product: 'Cabbage',
//     description: 'Supermarket supplier looking for a standing weekly cabbage contract.',
//     price: 45, currency: 'KES', unit: 'head', needed: '400 Heads', period: 'Immediate',
//     deadline: '2026-08-06', postedAt: '2026-07-26', verified: true,
//     contactPerson: 'Naomi Wairimu', contactPhone: '+254 733 012 008', tags: ['Weekly supply contract'], distanceKm: 18,
//   },
//   {
//     id: 'b9', type: 'buyer', name: 'Bungoma Millers Union', category: 'buyer',
//     location: 'Bungoma Town', county: 'Bungoma', product: 'Maize',
//     description: 'Millers union running a contract-farming maize intake programme.',
//     price: 3700, currency: 'KES', unit: '90kg bag', needed: '700 Bags', period: 'Sept 2026',
//     deadline: '2026-09-15', postedAt: '2026-07-15', verified: true,
//     contactPerson: 'Wanjala Simiyu', contactPhone: '+254 711 123 009', tags: ['Bulk order', 'Contract farming'], distanceKm: 34,
//   },
//   {
//     id: 'b10', type: 'buyer', name: 'Kericho Highland Produce', category: 'buyer',
//     location: 'Kericho Town', county: 'Kericho', product: 'Potatoes',
//     description: 'Highland produce trader supplying Nairobi and Nakuru markets.',
//     price: 2600, currency: 'KES', unit: '110kg bag', needed: '250 Bags', period: 'Immediate',
//     deadline: '2026-08-09', postedAt: '2026-07-23', verified: true,
//     contactPerson: 'Kiplagat Rono', contactPhone: '+254 741 234 010', tags: ['Bulk order'], distanceKm: 27,
//   },
//   {
//     id: 'b11', type: 'buyer', name: 'Narok Grain Cooperative', category: 'buyer',
//     location: 'Narok Town', county: 'Narok', product: 'Wheat',
//     description: 'Cooperative aggregating wheat for large-scale milling contracts.',
//     price: 4400, currency: 'KES', unit: '90kg bag', needed: '300 Bags', period: 'Oct 2026',
//     deadline: '2026-10-05', postedAt: '2026-07-19', verified: true,
//     contactPerson: 'Sironka Ntutu', contactPhone: '+254 702 345 011', tags: ['Contract farming'], distanceKm: 55,
//   },
//   {
//     id: 'b12', type: 'buyer', name: 'Homa Bay Fisheries & Agro', category: 'buyer',
//     location: 'Homa Bay Town', county: 'Homa Bay', product: 'Sorghum',
//     description: 'New agro-trading desk sourcing sorghum for local brewing partners.',
//     price: 4000, currency: 'KES', unit: '90kg bag', needed: '120 Bags', period: 'Immediate',
//     deadline: '2026-08-08', postedAt: '2026-07-27', verified: false,
//     contactPerson: 'Achieng Odera', contactPhone: '+254 719 456 012', tags: ['New buyer'], distanceKm: 40,
//   },
//   {
//     id: 'b13', type: 'buyer', name: 'Kajiado Livestock & Grain', category: 'buyer',
//     location: 'Kajiado Town', county: 'Kajiado', product: 'Beans',
//     description: 'Small-scale-friendly buyer accepting mixed-grade bean deliveries.',
//     price: 8500, currency: 'KES', unit: '90kg bag', needed: '90 Bags', period: 'Aug 2026',
//     deadline: '2026-08-25', postedAt: '2026-07-21', verified: true,
//     contactPerson: 'Nashipai Sankale', contactPhone: '+254 723 567 013', tags: ['Small-scale friendly'], distanceKm: 31,
//   },
//   {
//     id: 'b14', type: 'buyer', name: 'Kakamega Sugar & Grain Co.', category: 'buyer',
//     location: 'Kakamega Town', county: 'Kakamega', product: 'Maize',
//     description: 'Diversified grain trader with same-day cash payment.',
//     price: 3850, currency: 'KES', unit: '90kg bag', needed: '450 Bags', period: 'Immediate',
//     deadline: '2026-08-11', postedAt: '2026-07-26', verified: true,
//     contactPerson: 'Shilibwa Wekesa', contactPhone: '+254 715 678 014', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 20,
//   },
//   {
//     id: 'b15', type: 'buyer', name: 'Taita Fresh Produce Exporters', category: 'buyer',
//     location: 'Voi Town', county: 'Taita Taveta', product: 'Tomatoes',
//     description: 'Exporter sourcing export-grade tomatoes for regional distribution.',
//     price: 2300, currency: 'KES', unit: 'crate (64kg)', needed: '60 Crates', period: 'Immediate',
//     deadline: '2026-08-04', postedAt: '2026-07-28', verified: false,
//     contactPerson: 'Mwakio Ngala', contactPhone: '+254 708 789 015', tags: ['Perishable — quick pickup', 'Export grade'], distanceKm: 63,
//   },

//   // ---- Input suppliers ---------------------------------------------------
//   {
//     id: 's1', type: 'supplier', name: 'Kenya Seed Company', category: 'seed supplier',
//     location: 'Eldoret Branch', county: 'Uasin Gishu', product: 'Certified Maize Seeds (H629)',
//     description: 'Certified hybrid maize seed suited to highland and medium-altitude zones.',
//     price: 350, currency: 'KES', unit: '2kg packet',
//     postedAt: '2026-07-20', verified: true,
//     contactPerson: 'Kenya Seed Sales Desk', contactPhone: '+254 700 111 101', tags: ['Certified', 'In stock'], distanceKm: 12,
//   },
//   {
//     id: 's2', type: 'supplier', name: 'Simlaw Seeds Kenya', category: 'seed supplier',
//     location: 'Nakuru Agro Center', county: 'Nakuru', product: 'Rosecoco Bean Seeds',
//     description: 'High-germination bean seed variety popular across the Rift Valley.',
//     price: 280, currency: 'KES', unit: '2kg packet',
//     postedAt: '2026-07-19', verified: true,
//     contactPerson: 'Simlaw Nakuru Outlet', contactPhone: '+254 700 111 102', tags: ['Certified', 'In stock'], distanceKm: 6,
//   },
//   {
//     id: 's3', type: 'supplier', name: 'MEA Fertilizers Ltd', category: 'fertilizer',
//     location: 'Nakuru Depot', county: 'Nakuru', product: 'DAP Fertilizer (Planting)',
//     description: 'Diammonium phosphate for planting-stage application on cereals.',
//     price: 4200, currency: 'KES', unit: '50kg bag',
//     postedAt: '2026-07-21', verified: true,
//     contactPerson: 'MEA Nakuru Depot', contactPhone: '+254 700 111 103', tags: ['In stock', 'Bulk discount'], distanceKm: 6,
//   },
//   {
//     id: 's4', type: 'supplier', name: 'Yara East Africa', category: 'fertilizer',
//     location: 'Eldoret Depot', county: 'Uasin Gishu', product: 'CAN Fertilizer (Top Dressing)',
//     description: 'Calcium ammonium nitrate for top-dressing maize and wheat.',
//     price: 3900, currency: 'KES', unit: '50kg bag',
//     postedAt: '2026-07-23', verified: true,
//     contactPerson: 'Yara Eldoret Desk', contactPhone: '+254 700 111 104', tags: ['In stock', 'Delivery available'], distanceKm: 12,
//   },
//   {
//     id: 's5', type: 'supplier', name: 'Juanco Agrovet', category: 'agrochemical',
//     location: 'Kakamega Town', county: 'Kakamega', product: 'Maize Pre-Emergent Herbicide',
//     description: 'Broad-spectrum pre-emergent herbicide for early weed control in maize.',
//     price: 1450, currency: 'KES', unit: '1 litre',
//     postedAt: '2026-07-24', verified: true,
//     contactPerson: 'Juanco Agrovet Desk', contactPhone: '+254 700 111 105', tags: ['In stock'], distanceKm: 20,
//   },
//   {
//     id: 's6', type: 'supplier', name: 'Elgon Kenya Agrochemicals', category: 'agrochemical',
//     location: 'Meru Town', county: 'Meru', product: 'Bean Fungicide Spray',
//     description: 'Fungicide targeting common bean rust and blight in humid conditions.',
//     price: 980, currency: 'KES', unit: '1 litre',
//     postedAt: '2026-07-18', verified: false,
//     contactPerson: 'Elgon Kenya Meru Branch', contactPhone: '+254 700 111 106', tags: ['In stock'], distanceKm: 22,
//   },
//   {
//     id: 's7', type: 'supplier', name: 'Davis & Shirtliff', category: 'irrigation',
//     location: 'Nairobi Industrial Area', county: 'Nairobi', product: 'Drip Irrigation Kit (1 Acre)',
//     description: 'Complete drip kit — tubing, emitters, filters — sized for a 1-acre plot.',
//     price: 45000, currency: 'KES', unit: 'kit',
//     postedAt: '2026-07-17', verified: true,
//     contactPerson: 'D&S Sales Team', contactPhone: '+254 700 111 107', tags: ['Warranty included', 'Delivery available'], distanceKm: 48,
//   },
//   {
//     id: 's8', type: 'supplier', name: 'Amiran Kenya', category: 'irrigation',
//     location: 'Nairobi Showroom', county: 'Nairobi', product: 'Greenhouse Drip System',
//     description: 'Precision drip system designed for greenhouse tomato and vegetable production.',
//     price: 62000, currency: 'KES', unit: 'system',
//     postedAt: '2026-07-16', verified: true,
//     contactPerson: 'Amiran Sales Desk', contactPhone: '+254 700 111 108', tags: ['Warranty included'], distanceKm: 48,
//   },
//   {
//     id: 's9', type: 'supplier', name: 'Kentrac Equipment', category: 'equipment',
//     location: 'Nakuru Showroom', county: 'Nakuru', product: '2-Wheel Walking Tractor',
//     description: 'Compact walking tractor suited to small and medium-scale farms.',
//     price: 185000, currency: 'KES', unit: 'unit',
//     postedAt: '2026-07-14', verified: true,
//     contactPerson: 'Kentrac Nakuru Branch', contactPhone: '+254 700 111 109', tags: ['Warranty included', 'Financing available'], distanceKm: 6,
//   },
//   {
//     id: 's10', type: 'supplier', name: 'RUMA Implements', category: 'equipment',
//     location: 'Kisumu Branch', county: 'Kisumu', product: 'Ox-Drawn Plough',
//     description: 'Durable animal-drawn plough for smallholder land preparation.',
//     price: 15500, currency: 'KES', unit: 'unit',
//     postedAt: '2026-07-15', verified: true,
//     contactPerson: 'RUMA Kisumu Desk', contactPhone: '+254 700 111 110', tags: ['In stock'], distanceKm: 15,
//   },
// ];

// type MarketOffersParams = {
//   county?: string;
//   crops?: string[];
//   type?: MarketOffer['type'];
// };

// // `type` genuinely separates Buyers from Suppliers, so it filters
// // (excludes). `crops` filters too — that's the whole point of "My
// // Crops" vs "All Buyers". `county` only affects ORDER, never exclusion —
// // a buyer/supplier in a neighboring county is still a real option, and
// // hiding them was the bug that made tabs look empty with sparse mock data.
// export async function fetchMarketOffers({ county, crops, type }: MarketOffersParams): Promise<MarketOffer[]> {
//   let results = MOCK_OFFERS;

//   if (type) {
//     results = results.filter((o) => o.type === type);
//   }

//   if (crops && crops.length > 0) {
//     const cropTerms = crops.map((c) => c.toLowerCase());
//     // Substring match so it also catches supplier products like
//     // "Certified Maize Seeds (H629)" against the crop name "Maize".
//     results = results.filter((o) => cropTerms.some((term) => o.product.toLowerCase().includes(term)));
//   }

//   return [...results].sort((a, b) => {
//     if (county) {
//       const aLocal = a.county.toLowerCase() === county.toLowerCase() ? 0 : 1;
//       const bLocal = b.county.toLowerCase() === county.toLowerCase() ? 0 : 1;
//       if (aLocal !== bLocal) return aLocal - bLocal; // same-county offers float to the top
//     }
//     return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
//   });
// }

// // ---------------------------------------------------------------------
// // Real WFP price data, fetched client-side (no backend involved)
// // — unchanged from the previous version, still real, still resilient.
// // ---------------------------------------------------------------------

// const WFP_CSV_URL =
//   'https://data.humdata.org/dataset/e0d3fba6-f9a2-45d7-b949-140c455197ff/resource/517ee1bf-2437-4f8c-aa1b-cb9925b9d437/download/wfp_food_prices_ken.csv';

// // No single free CORS proxy is reliable enough alone — AllOrigins rate-
// // limits at ~20 req/min, CorsProxy.io's free tier is localhost-only,
// // others cap differently. Try each in order; use the first that returns
// // real CSV content, and cache the result for the session.
// const CORS_PROXIES: Array<(url: string) => string> = [
//   (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
//   (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
//   (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
//   (url) => `https://cors.x2u.in/${url}`,
// ];

// type PriceRow = {
//   date: string;
//   admin2: string;
//   commodity: string;
//   unit: string;
//   pricetype: string;
//   currency: string;
//   price: number;
// };

// type PriceTrend = {
//   commodity: string;
//   unit: string;
//   currency: string;
//   currentPrice: number;
//   priceDate: string;
//   pctChange: number;
//   pctChangeVsAvg: number;
//   history: PricePoint[];
//   source: string;
// };

// // Handles quoted CSV fields (some commodity/market names contain commas),
// // which a naive split(',') would silently mis-parse.
// function splitCsvLine(line: string): string[] {
//   const out: string[] = [];
//   let cur = '';
//   let inQuotes = false;
//   for (let i = 0; i < line.length; i++) {
//     const ch = line[i];
//     if (ch === '"') {
//       inQuotes = !inQuotes;
//     } else if (ch === ',' && !inQuotes) {
//       out.push(cur);
//       cur = '';
//     } else {
//       cur += ch;
//     }
//   }
//   out.push(cur);
//   return out;
// }

// // Row 0 = headers, Row 1 = HXL tags — skip both. Column order per WFP's
// // standard export: date, admin1, admin2, market, lat, lon, category,
// // commodity, unit, priceflag, pricetype, currency, price, usdprice.
// function parseCsv(text: string): PriceRow[] {
//   const lines = text.split('\n').filter(Boolean);
//   const rows: PriceRow[] = [];
//   for (let i = 2; i < lines.length; i++) {
//     const cols = splitCsvLine(lines[i]);
//     if (cols.length < 13) continue;
//     const [date, , admin2, , , , , commodity, unit, , pricetype, currency, price] = cols;
//     const value = parseFloat(price);
//     if (!date || !commodity || Number.isNaN(value)) continue;
//     rows.push({
//       date,
//       admin2: (admin2 ?? '').replace(/^"|"$/g, '').trim(),
//       commodity: (commodity ?? '').replace(/^"|"$/g, '').trim(),
//       unit: (unit ?? '').replace(/^"|"$/g, '').trim(),
//       pricetype: (pricetype ?? '').replace(/^"|"$/g, '').trim(),
//       currency: (currency ?? '').replace(/^"|"$/g, '').trim(),
//       price: value,
//     });
//   }
//   return rows;
// }

// // Cheap sanity check so a rate-limited or dead proxy's HTML error page
// // isn't silently "parsed" into zero valid rows with no clue why.
// function looksLikeCsv(text: string): boolean {
//   const firstLine = text.split('\n')[0] ?? '';
//   return firstLine.toLowerCase().includes('date') && firstLine.includes(',') && !text.trim().startsWith('<');
// }

// async function fetchViaProxies(targetUrl: string): Promise<string> {
//   const errors: string[] = [];
//   for (const buildProxyUrl of CORS_PROXIES) {
//     const proxyUrl = buildProxyUrl(targetUrl);
//     try {
//       const controller = new AbortController();
//       const timeout = setTimeout(() => controller.abort(), 15000);
//       const res = await fetch(proxyUrl, { signal: controller.signal });
//       clearTimeout(timeout);
//       if (!res.ok) {
//         errors.push(`${proxyUrl} -> HTTP ${res.status}`);
//         continue;
//       }
//       const text = await res.text();
//       if (!looksLikeCsv(text)) {
//         errors.push(`${proxyUrl} -> response wasn't CSV-shaped (likely an error/rate-limit page)`);
//         continue;
//       }
//       console.info(`[market] CSV fetched successfully via: ${proxyUrl}`);
//       return text;
//     } catch (err) {
//       errors.push(`${proxyUrl} -> ${err instanceof Error ? err.message : 'unknown error'}`);
//     }
//   }
//   console.error('[market] All CORS proxies failed:', errors);
//   throw new Error('All CORS proxies failed to fetch WFP data');
// }

// // Cache the parsed CSV for the lifetime of this module instance.
// let csvCachePromise: Promise<PriceRow[]> | null = null;

// async function fetchRawPriceRows(): Promise<PriceRow[]> {
//   if (csvCachePromise) return csvCachePromise;
//   csvCachePromise = fetchViaProxies(WFP_CSV_URL)
//     .then((text) => {
//       const rows = parseCsv(text);
//       if (rows.length === 0) {
//         console.warn('[market] Parsed 0 rows from WFP CSV even though a proxy responded — check parseCsv column mapping.');
//       } else {
//         console.info(
//           `[market] Loaded ${rows.length} WFP price rows. Distinct commodities:`,
//           Array.from(new Set(rows.map((r) => r.commodity))).sort(),
//         );
//       }
//       return rows;
//     })
//     .catch((err) => {
//       console.error('[market] Failed to fetch/parse WFP CSV via all proxies:', err);
//       csvCachePromise = null; // allow retry on next call
//       return [];
//     });
//   return csvCachePromise;
// }

// const LOOKBACK_MONTHS = 6;

// function buildTrends(rows: PriceRow[], county?: string): PriceTrend[] {
//   const cutoff = new Date();
//   cutoff.setMonth(cutoff.getMonth() - LOOKBACK_MONTHS);

//   const recentRetail = rows.filter((r) => r.pricetype === 'Retail' && new Date(r.date) >= cutoff);

//   let filtered = county
//     ? recentRetail.filter((r) => r.admin2.toLowerCase() === county.toLowerCase())
//     : recentRetail;

//   if (county && filtered.length === 0) {
//     console.warn(
//       `[market] No WFP price rows matched county "${county}". Falling back to nationwide data. ` +
//       `admin2 values actually present in the last ${LOOKBACK_MONTHS}mo:`,
//       Array.from(new Set(recentRetail.map((r) => r.admin2))).slice(0, 20),
//     );
//     filtered = recentRetail;
//   }

//   const byCommodity = new Map<string, PriceRow[]>();
//   filtered.forEach((r) => {
//     const list = byCommodity.get(r.commodity) ?? [];
//     list.push(r);
//     byCommodity.set(r.commodity, list);
//   });

//   return Array.from(byCommodity.entries()).map(([commodity, entries]) => {
//     entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
//     const latest = entries[entries.length - 1];
//     const prior = entries[entries.length - 2] ?? latest;
//     const avg = entries.reduce((sum, e) => sum + e.price, 0) / entries.length;

//     const pctChange = prior.price > 0 ? ((latest.price - prior.price) / prior.price) * 100 : 0;
//     const pctChangeVsAvg = avg > 0 ? ((latest.price - avg) / avg) * 100 : 0;

//     return {
//       commodity,
//       unit: latest.unit,
//       currency: latest.currency,
//       currentPrice: latest.price,
//       priceDate: latest.date,
//       pctChange: Math.round(pctChange * 10) / 10,
//       pctChangeVsAvg: Math.round(pctChangeVsAvg * 10) / 10,
//       history: entries.map((e) => ({ date: e.date, price: e.price })),
//       source: 'WFP Food Prices (HDX)',
//     };
//   });
// }

// async function fetchPriceTrends(county: string): Promise<PriceTrend[]> {
//   const rows = await fetchRawPriceRows();
//   return buildTrends(rows, county);
// }

// // WFP's commodity field is often qualified — "Maize (white)", "Beans
// // (dry)", "Rice (imported)", "Potatoes (Irish)", "Wheat (white)", etc. —
// // so a plain substring match against our app crop names silently misses
// // real data without this alias table.
// const CROP_ALIASES: Record<string, string[]> = {
//   maize: ['maize'],
//   beans: ['beans'],
//   rice: ['rice'],
//   sorghum: ['sorghum'],
//   wheat: ['wheat'],
//   potatoes: ['potatoes', 'potato'],
//   cabbage: ['cabbage'],
//   tomatoes: ['tomato'],
//   'cashew nuts': ['cashew'],
// };

// function fetchPriceSignal(crop: string, trends: PriceTrend[]): PriceTrend | null {
//   const key = crop.toLowerCase();
//   const aliases = CROP_ALIASES[key] ?? [key];
//   return (
//     trends.find((t) => {
//       const commodity = t.commodity.toLowerCase();
//       return aliases.some((alias) => commodity.includes(alias) || alias.includes(commodity));
//     }) ?? null
//   );
// }

// function classifyDemand(pctChange: number, pctChangeVsAvg: number): CropDemandTrend['demand'] {
//   if (pctChange > 3 || pctChangeVsAvg > 8) return 'rising';
//   if (pctChange < -3 || pctChangeVsAvg < -8) return 'falling';
//   if (Math.abs(pctChangeVsAvg) <= 3) return 'stable';
//   return 'high';
// }

// // Plain-language, rule-based read — not a forecast, an honest restatement
// // of "is this price unusually high or low right now" with a caveat.
// function buildGuidance(pctChangeVsAvg: number): { guidance: CropDemandTrend['guidance']; guidanceNote: string } {
//   if (pctChangeVsAvg >= 8) {
//     return {
//       guidance: 'sell',
//       guidanceNote: `Current price is ${pctChangeVsAvg}% above its ${LOOKBACK_MONTHS}-month average — a stronger-than-usual window to sell if your harvest is ready.`,
//     };
//   }
//   if (pctChangeVsAvg <= -8) {
//     return {
//       guidance: 'hold',
//       guidanceNote: `Current price is ${Math.abs(pctChangeVsAvg)}% below its ${LOOKBACK_MONTHS}-month average — if you're able to store your harvest, prices have room to recover.`,
//     };
//   }
//   return {
//     guidance: 'watch',
//     guidanceNote: `Current price is close to its ${LOOKBACK_MONTHS}-month average — no strong signal to rush a sale or wait.`,
//   };
// }

// export async function fetchCropDemandTrends(county: string): Promise<CropDemandTrend[]> {
//   const priceTrends = await fetchPriceTrends(county);

//   // Only crop BUYER products are real crop names ("Maize", "Beans") —
//   // supplier products ("Certified Maize Seeds (H629)") aren't commodities
//   // WFP tracks prices for, so they're excluded from this set.
//   const offerCrops = new Set(
//     MOCK_OFFERS.filter((o) => o.type === 'buyer').map((o) => o.product),
//   );
//   const crops = new Set([...offerCrops, ...priceTrends.map((p) => p.commodity)]);

//   if (crops.size === 0) {
//     console.warn('[market] fetchCropDemandTrends produced zero crops — no WFP price trends available.');
//     return [];
//   }

//   const trends = Array.from(crops).map((crop) => {
//     const price = fetchPriceSignal(crop, priceTrends);

//     if (!price) {
//       return {
//         crop,
//         demand: 'stable',
//         note: 'No recent WFP price survey data found for this crop in this window.',
//         guidance: 'unknown',
//         guidanceNote: 'Not enough market price data to suggest a selling window yet.',
//       } as CropDemandTrend;
//     }

//     const demand = classifyDemand(price.pctChange, price.pctChangeVsAvg);
//     const { guidance, guidanceNote } = buildGuidance(price.pctChangeVsAvg);
//     const direction = price.pctChange >= 0 ? 'up' : 'down';

//     return {
//       crop,
//       demand,
//       note: `Retail price ${direction} ${Math.abs(price.pctChange)}% since the last survey (${price.source}).`,
//       guidance,
//       guidanceNote,
//       unit: price.unit,
//       currency: price.currency,
//       currentPrice: price.currentPrice,
//       pctChangeVsAvg: price.pctChangeVsAvg,
//       asOf: price.priceDate,
//       history: price.history,
//     } as CropDemandTrend;
//   });

//   return trends.sort((a, b) => a.crop.localeCompare(b.crop));
// }
/**
 * MARKET DATA SOURCES — Smart Companion Farming Marketplace
 * -----------------------------------------------------------------------
 * Panda Sasa's marketplace connects three things around the farmer's
 * actual farm data (crop suitability, county, season):
 *   1. Crop Buyers          — verified buyers looking for specific crops
 *   2. Agriculture Products — seed / fertilizer / agrochemical / equipment /
 *                             irrigation providers matched to what Panda
 *                             Sasa recommends the farmer grow
 *   3. Market Trends        — REAL WFP Food Prices for Kenya data (HDX),
 *                             fetched client-side through a multi-proxy
 *                             fallback chain (no single free CORS proxy is
 *                             reliable alone). Real periodic survey data
 *                             (updates ~monthly), not live — shown as such.
 *
 * Buyers + agriculture products are HARDCODED for now (MOCK_OFFERS). Swap
 * this list + fetchMarketOffers's body for a real API later — the function
 * signature and MarketOffer shape won't need to change.
 *
 * FARMER-FACING TEXT: fetchCropDemandTrends returns one plain-language
 * `explanation` sentence per crop instead of raw percentages — no charts,
 * no "% vs 6-month average" math on screen. The real price number and the
 * percentage math still happen here, they just don't get displayed raw.
 */

export type MarketOffer = {
  id: string;
  type: 'buyer' | 'supplier';
  name: string;
  category: 'buyer' | 'seed supplier' | 'fertilizer' | 'agrochemical' | 'equipment' | 'irrigation';
  location: string;
  county: string;
  product: string;
  description: string;
  price?: number;
  currency?: string;
  unit?: string;
  needed?: string;
  period?: string;
  verified: boolean;
  contactPerson: string;
  contactPhone: string;
  tags: string[];
  distanceKm?: number;
  deadline?: string; // ISO date
  postedAt: string; // ISO date
};

export type CropDemandTrend = {
  crop: string;
  demand: 'rising' | 'high' | 'stable' | 'falling';
  guidance: 'sell' | 'hold' | 'watch' | 'unknown';
  explanation: string; // one plain-language sentence — no percentages/charts
  unit?: string;
  currency?: string;
  currentPrice?: number;
  asOf?: string;
};

// ---------------------------------------------------------------------
// Hardcoded buyers + agriculture products
// ---------------------------------------------------------------------

const MOCK_OFFERS: MarketOffer[] = [
  // ---- Crop buyers -----------------------------------------------------
  {
    id: 'b1', type: 'buyer', name: 'Wafula Cereals Ltd', category: 'buyer',
    location: 'Eldoret Branch', county: 'Uasin Gishu', product: 'Maize',
    description: 'Bulk maize buyer supplying regional millers.',
    price: 3800, currency: 'KES', unit: '90kg bag', needed: '500 Bags', period: 'Immediate',
    deadline: '2026-08-15', postedAt: '2026-07-24', verified: true,
    contactPerson: 'James Wafula', contactPhone: '+254 712 345 001', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 12,
  },
  {
    id: 'b2', type: 'buyer', name: 'Prime Millers Co.', category: 'buyer',
    location: 'Nairobi Central', county: 'Nairobi', product: 'Sorghum',
    description: 'Contract milling partner sourcing sorghum for flour production.',
    price: 4200, currency: 'KES', unit: '90kg bag', needed: '200 Bags', period: 'Sept 2026',
    deadline: '2026-09-10', postedAt: '2026-07-20', verified: true,
    contactPerson: 'Grace Mwangi', contactPhone: '+254 722 456 002', tags: ['Contract farming'], distanceKm: 48,
  },
  {
    id: 'b3', type: 'buyer', name: 'Rift Valley Grain Traders', category: 'buyer',
    location: 'Nakuru Town', county: 'Nakuru', product: 'Maize',
    description: 'Regional grain trader with immediate collection capacity.',
    price: 3950, currency: 'KES', unit: '90kg bag', needed: '350 Bags', period: 'Immediate',
    deadline: '2026-08-05', postedAt: '2026-07-27', verified: true,
    contactPerson: 'Peter Kiptoo', contactPhone: '+254 733 567 003', tags: ['Bulk order'], distanceKm: 6,
  },
  {
    id: 'b4', type: 'buyer', name: 'Mombasa Agro Exports', category: 'buyer',
    location: 'Mombasa Port', county: 'Kilifi', product: 'Cashew Nuts',
    description: 'Export-grade cashew buyer shipping to Middle East markets.',
    price: 9500, currency: 'KES', unit: '50kg bag', needed: '100 Bags', period: 'Oct 2026',
    deadline: '2026-10-01', postedAt: '2026-07-18', verified: false,
    contactPerson: 'Halima Said', contactPhone: '+254 701 678 004', tags: ['Export grade', 'Quality check required'], distanceKm: 90,
  },
  {
    id: 'b5', type: 'buyer', name: 'Kisumu Rice Millers', category: 'buyer',
    location: 'Kisumu Central', county: 'Kisumu', product: 'Rice',
    description: 'Local rice miller buying paddy directly from Nyanza farmers.',
    price: 5600, currency: 'KES', unit: '50kg bag', needed: '600 Bags', period: 'Immediate',
    deadline: '2026-08-12', postedAt: '2026-07-25', verified: true,
    contactPerson: 'Otieno Ochieng', contactPhone: '+254 745 789 005', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 15,
  },
  {
    id: 'b6', type: 'buyer', name: 'Meru Dairy Cooperative', category: 'buyer',
    location: 'Meru Town', county: 'Meru', product: 'Beans',
    description: 'Cooperative sourcing beans for member households and resale.',
    price: 8200, currency: 'KES', unit: '90kg bag', needed: '150 Bags', period: 'Aug 2026',
    deadline: '2026-08-20', postedAt: '2026-07-22', verified: true,
    contactPerson: 'Ann Kinya', contactPhone: '+254 756 890 006', tags: ['Contract farming'], distanceKm: 22,
  },
  {
    id: 'b7', type: 'buyer', name: 'Machakos Fresh Produce', category: 'buyer',
    location: 'Machakos Market', county: 'Machakos', product: 'Tomatoes',
    description: 'Wholesale market vendor needing weekly tomato supply.',
    price: 2100, currency: 'KES', unit: 'crate (64kg)', needed: '80 Crates', period: 'Immediate',
    deadline: '2026-08-03', postedAt: '2026-07-28', verified: false,
    contactPerson: 'Musyoka Kioko', contactPhone: '+254 720 901 007', tags: ['Perishable — quick pickup'], distanceKm: 9,
  },
  {
    id: 'b8', type: 'buyer', name: 'Kiambu Fresh Greens', category: 'buyer',
    location: 'Kiambu Town', county: 'Kiambu', product: 'Cabbage',
    description: 'Supermarket supplier looking for a standing weekly cabbage contract.',
    price: 45, currency: 'KES', unit: 'head', needed: '400 Heads', period: 'Immediate',
    deadline: '2026-08-06', postedAt: '2026-07-26', verified: true,
    contactPerson: 'Naomi Wairimu', contactPhone: '+254 733 012 008', tags: ['Weekly supply contract'], distanceKm: 18,
  },
  {
    id: 'b9', type: 'buyer', name: 'Bungoma Millers Union', category: 'buyer',
    location: 'Bungoma Town', county: 'Bungoma', product: 'Maize',
    description: 'Millers union running a contract-farming maize intake programme.',
    price: 3700, currency: 'KES', unit: '90kg bag', needed: '700 Bags', period: 'Sept 2026',
    deadline: '2026-09-15', postedAt: '2026-07-15', verified: true,
    contactPerson: 'Wanjala Simiyu', contactPhone: '+254 711 123 009', tags: ['Bulk order', 'Contract farming'], distanceKm: 34,
  },
  {
    id: 'b10', type: 'buyer', name: 'Kericho Highland Produce', category: 'buyer',
    location: 'Kericho Town', county: 'Kericho', product: 'Potatoes',
    description: 'Highland produce trader supplying Nairobi and Nakuru markets.',
    price: 2600, currency: 'KES', unit: '110kg bag', needed: '250 Bags', period: 'Immediate',
    deadline: '2026-08-09', postedAt: '2026-07-23', verified: true,
    contactPerson: 'Kiplagat Rono', contactPhone: '+254 741 234 010', tags: ['Bulk order'], distanceKm: 27,
  },
  {
    id: 'b11', type: 'buyer', name: 'Narok Grain Cooperative', category: 'buyer',
    location: 'Narok Town', county: 'Narok', product: 'Wheat',
    description: 'Cooperative aggregating wheat for large-scale milling contracts.',
    price: 4400, currency: 'KES', unit: '90kg bag', needed: '300 Bags', period: 'Oct 2026',
    deadline: '2026-10-05', postedAt: '2026-07-19', verified: true,
    contactPerson: 'Sironka Ntutu', contactPhone: '+254 702 345 011', tags: ['Contract farming'], distanceKm: 55,
  },
  {
    id: 'b12', type: 'buyer', name: 'Homa Bay Fisheries & Agro', category: 'buyer',
    location: 'Homa Bay Town', county: 'Homa Bay', product: 'Sorghum',
    description: 'New agro-trading desk sourcing sorghum for local brewing partners.',
    price: 4000, currency: 'KES', unit: '90kg bag', needed: '120 Bags', period: 'Immediate',
    deadline: '2026-08-08', postedAt: '2026-07-27', verified: false,
    contactPerson: 'Achieng Odera', contactPhone: '+254 719 456 012', tags: ['New buyer'], distanceKm: 40,
  },
  {
    id: 'b13', type: 'buyer', name: 'Kajiado Livestock & Grain', category: 'buyer',
    location: 'Kajiado Town', county: 'Kajiado', product: 'Beans',
    description: 'Small-scale-friendly buyer accepting mixed-grade bean deliveries.',
    price: 8500, currency: 'KES', unit: '90kg bag', needed: '90 Bags', period: 'Aug 2026',
    deadline: '2026-08-25', postedAt: '2026-07-21', verified: true,
    contactPerson: 'Nashipai Sankale', contactPhone: '+254 723 567 013', tags: ['Small-scale friendly'], distanceKm: 31,
  },
  {
    id: 'b14', type: 'buyer', name: 'Kakamega Sugar & Grain Co.', category: 'buyer',
    location: 'Kakamega Town', county: 'Kakamega', product: 'Maize',
    description: 'Diversified grain trader with same-day cash payment.',
    price: 3850, currency: 'KES', unit: '90kg bag', needed: '450 Bags', period: 'Immediate',
    deadline: '2026-08-11', postedAt: '2026-07-26', verified: true,
    contactPerson: 'Shilibwa Wekesa', contactPhone: '+254 715 678 014', tags: ['Bulk order', 'Cash on delivery'], distanceKm: 20,
  },
  {
    id: 'b15', type: 'buyer', name: 'Taita Fresh Produce Exporters', category: 'buyer',
    location: 'Voi Town', county: 'Taita Taveta', product: 'Tomatoes',
    description: 'Exporter sourcing export-grade tomatoes for regional distribution.',
    price: 2300, currency: 'KES', unit: 'crate (64kg)', needed: '60 Crates', period: 'Immediate',
    deadline: '2026-08-04', postedAt: '2026-07-28', verified: false,
    contactPerson: 'Mwakio Ngala', contactPhone: '+254 708 789 015', tags: ['Perishable — quick pickup', 'Export grade'], distanceKm: 63,
  },

  // ---- Agriculture products (seeds, fertilizer, agrochemicals, equipment, irrigation) ------
  {
    id: 's1', type: 'supplier', name: 'Kenya Seed Company', category: 'seed supplier',
    location: 'Eldoret Branch', county: 'Uasin Gishu', product: 'Certified Maize Seeds (H629)',
    description: 'Certified hybrid maize seed suited to highland and medium-altitude zones.',
    price: 350, currency: 'KES', unit: '2kg packet',
    postedAt: '2026-07-20', verified: true,
    contactPerson: 'Kenya Seed Sales Desk', contactPhone: '+254 700 111 101', tags: ['Certified', 'In stock'], distanceKm: 12,
  },
  {
    id: 's2', type: 'supplier', name: 'Simlaw Seeds Kenya', category: 'seed supplier',
    location: 'Nakuru Agro Center', county: 'Nakuru', product: 'Rosecoco Bean Seeds',
    description: 'High-germination bean seed variety popular across the Rift Valley.',
    price: 280, currency: 'KES', unit: '2kg packet',
    postedAt: '2026-07-19', verified: true,
    contactPerson: 'Simlaw Nakuru Outlet', contactPhone: '+254 700 111 102', tags: ['Certified', 'In stock'], distanceKm: 6,
  },
  {
    id: 's3', type: 'supplier', name: 'MEA Fertilizers Ltd', category: 'fertilizer',
    location: 'Nakuru Depot', county: 'Nakuru', product: 'DAP Fertilizer (Planting)',
    description: 'Diammonium phosphate for planting-stage application on cereals.',
    price: 4200, currency: 'KES', unit: '50kg bag',
    postedAt: '2026-07-21', verified: true,
    contactPerson: 'MEA Nakuru Depot', contactPhone: '+254 700 111 103', tags: ['In stock', 'Bulk discount'], distanceKm: 6,
  },
  {
    id: 's4', type: 'supplier', name: 'Yara East Africa', category: 'fertilizer',
    location: 'Eldoret Depot', county: 'Uasin Gishu', product: 'CAN Fertilizer (Top Dressing)',
    description: 'Calcium ammonium nitrate for top-dressing maize and wheat.',
    price: 3900, currency: 'KES', unit: '50kg bag',
    postedAt: '2026-07-23', verified: true,
    contactPerson: 'Yara Eldoret Desk', contactPhone: '+254 700 111 104', tags: ['In stock', 'Delivery available'], distanceKm: 12,
  },
  {
    id: 's5', type: 'supplier', name: 'Juanco Agrovet', category: 'agrochemical',
    location: 'Kakamega Town', county: 'Kakamega', product: 'Maize Pre-Emergent Herbicide',
    description: 'Broad-spectrum pre-emergent herbicide for early weed control in maize.',
    price: 1450, currency: 'KES', unit: '1 litre',
    postedAt: '2026-07-24', verified: true,
    contactPerson: 'Juanco Agrovet Desk', contactPhone: '+254 700 111 105', tags: ['In stock'], distanceKm: 20,
  },
  {
    id: 's6', type: 'supplier', name: 'Elgon Kenya Agrochemicals', category: 'agrochemical',
    location: 'Meru Town', county: 'Meru', product: 'Bean Fungicide Spray',
    description: 'Fungicide targeting common bean rust and blight in humid conditions.',
    price: 980, currency: 'KES', unit: '1 litre',
    postedAt: '2026-07-18', verified: false,
    contactPerson: 'Elgon Kenya Meru Branch', contactPhone: '+254 700 111 106', tags: ['In stock'], distanceKm: 22,
  },
  {
    id: 's7', type: 'supplier', name: 'Davis & Shirtliff', category: 'irrigation',
    location: 'Nairobi Industrial Area', county: 'Nairobi', product: 'Drip Irrigation Kit (1 Acre)',
    description: 'Complete drip kit — tubing, emitters, filters — sized for a 1-acre plot.',
    price: 45000, currency: 'KES', unit: 'kit',
    postedAt: '2026-07-17', verified: true,
    contactPerson: 'D&S Sales Team', contactPhone: '+254 700 111 107', tags: ['Warranty included', 'Delivery available'], distanceKm: 48,
  },
  {
    id: 's8', type: 'supplier', name: 'Amiran Kenya', category: 'irrigation',
    location: 'Nairobi Showroom', county: 'Nairobi', product: 'Greenhouse Drip System',
    description: 'Precision drip system designed for greenhouse tomato and vegetable production.',
    price: 62000, currency: 'KES', unit: 'system',
    postedAt: '2026-07-16', verified: true,
    contactPerson: 'Amiran Sales Desk', contactPhone: '+254 700 111 108', tags: ['Warranty included'], distanceKm: 48,
  },
  {
    id: 's9', type: 'supplier', name: 'Kentrac Equipment', category: 'equipment',
    location: 'Nakuru Showroom', county: 'Nakuru', product: '2-Wheel Walking Tractor',
    description: 'Compact walking tractor suited to small and medium-scale farms.',
    price: 185000, currency: 'KES', unit: 'unit',
    postedAt: '2026-07-14', verified: true,
    contactPerson: 'Kentrac Nakuru Branch', contactPhone: '+254 700 111 109', tags: ['Warranty included', 'Financing available'], distanceKm: 6,
  },
  {
    id: 's10', type: 'supplier', name: 'RUMA Implements', category: 'equipment',
    location: 'Kisumu Branch', county: 'Kisumu', product: 'Ox-Drawn Plough',
    description: 'Durable animal-drawn plough for smallholder land preparation.',
    price: 15500, currency: 'KES', unit: 'unit',
    postedAt: '2026-07-15', verified: true,
    contactPerson: 'RUMA Kisumu Desk', contactPhone: '+254 700 111 110', tags: ['In stock'], distanceKm: 15,
  },
];

type MarketOffersParams = {
  county?: string;
  crops?: string[];
  type?: MarketOffer['type'];
};

// `type` genuinely separates Buyers from Agriculture Products, so it
// filters (excludes). `crops` filters too — that's the whole point of "My
// Crops" vs "All Buyers". `county` only affects ORDER, never exclusion —
// a buyer/product in a neighboring county is still a real option.
export async function fetchMarketOffers({ county, crops, type }: MarketOffersParams): Promise<MarketOffer[]> {
  let results = MOCK_OFFERS;

  if (type) {
    results = results.filter((o) => o.type === type);
  }

  if (crops && crops.length > 0) {
    const cropTerms = crops.map((c) => c.toLowerCase());
    // Substring match so it also catches product names like
    // "Certified Maize Seeds (H629)" against the crop name "Maize".
    results = results.filter((o) => cropTerms.some((term) => o.product.toLowerCase().includes(term)));
  }

  return [...results].sort((a, b) => {
    if (county) {
      const aLocal = a.county.toLowerCase() === county.toLowerCase() ? 0 : 1;
      const bLocal = b.county.toLowerCase() === county.toLowerCase() ? 0 : 1;
      if (aLocal !== bLocal) return aLocal - bLocal; // same-county offers float to the top
    }
    return new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime();
  });
}

// ---------------------------------------------------------------------
// Real WFP price data, fetched client-side (no backend involved)
// ---------------------------------------------------------------------

const WFP_CSV_URL =
  'https://data.humdata.org/dataset/e0d3fba6-f9a2-45d7-b949-140c455197ff/resource/517ee1bf-2437-4f8c-aa1b-cb9925b9d437/download/wfp_food_prices_ken.csv';

// No single free CORS proxy is reliable enough alone — AllOrigins rate-
// limits at ~20 req/min, CorsProxy.io's free tier is localhost-only,
// others cap differently. Try each in order; use the first that returns
// real CSV content, and cache the result for the session.
const CORS_PROXIES: Array<(url: string) => string> = [
  (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  (url) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
  (url) => `https://cors.x2u.in/${url}`,
];

type PriceRow = {
  date: string;
  admin2: string;
  commodity: string;
  unit: string;
  pricetype: string;
  currency: string;
  price: number;
};

type PriceTrend = {
  commodity: string;
  unit: string;
  currency: string;
  currentPrice: number;
  priceDate: string;
  pctChange: number;
  pctChangeVsAvg: number;
  source: string;
};

// Handles quoted CSV fields (some commodity/market names contain commas),
// which a naive split(',') would silently mis-parse.
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// Row 0 = headers, Row 1 = HXL tags — skip both. Column order per WFP's
// standard export: date, admin1, admin2, market, lat, lon, category,
// commodity, unit, priceflag, pricetype, currency, price, usdprice.
function parseCsv(text: string): PriceRow[] {
  const lines = text.split('\n').filter(Boolean);
  const rows: PriceRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 13) continue;
    const [date, , admin2, , , , , commodity, unit, , pricetype, currency, price] = cols;
    const value = parseFloat(price);
    if (!date || !commodity || Number.isNaN(value)) continue;
    rows.push({
      date,
      admin2: (admin2 ?? '').replace(/^"|"$/g, '').trim(),
      commodity: (commodity ?? '').replace(/^"|"$/g, '').trim(),
      unit: (unit ?? '').replace(/^"|"$/g, '').trim(),
      pricetype: (pricetype ?? '').replace(/^"|"$/g, '').trim(),
      currency: (currency ?? '').replace(/^"|"$/g, '').trim(),
      price: value,
    });
  }
  return rows;
}

// Cheap sanity check so a rate-limited or dead proxy's HTML error page
// isn't silently "parsed" into zero valid rows with no clue why.
function looksLikeCsv(text: string): boolean {
  const firstLine = text.split('\n')[0] ?? '';
  return firstLine.toLowerCase().includes('date') && firstLine.includes(',') && !text.trim().startsWith('<');
}

async function fetchViaProxies(targetUrl: string): Promise<string> {
  const errors: string[] = [];
  for (const buildProxyUrl of CORS_PROXIES) {
    const proxyUrl = buildProxyUrl(targetUrl);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(proxyUrl, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) {
        errors.push(`${proxyUrl} -> HTTP ${res.status}`);
        continue;
      }
      const text = await res.text();
      if (!looksLikeCsv(text)) {
        errors.push(`${proxyUrl} -> response wasn't CSV-shaped (likely an error/rate-limit page)`);
        continue;
      }
      console.info(`[market] CSV fetched successfully via: ${proxyUrl}`);
      return text;
    } catch (err) {
      errors.push(`${proxyUrl} -> ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }
  console.error('[market] All CORS proxies failed:', errors);
  throw new Error('All CORS proxies failed to fetch WFP data');
}

// Cache the parsed CSV for the lifetime of this module instance.
let csvCachePromise: Promise<PriceRow[]> | null = null;

async function fetchRawPriceRows(): Promise<PriceRow[]> {
  if (csvCachePromise) return csvCachePromise;
  csvCachePromise = fetchViaProxies(WFP_CSV_URL)
    .then((text) => {
      const rows = parseCsv(text);
      if (rows.length === 0) {
        console.warn('[market] Parsed 0 rows from WFP CSV even though a proxy responded — check parseCsv column mapping.');
      } else {
        console.info(
          `[market] Loaded ${rows.length} WFP price rows. Distinct commodities:`,
          Array.from(new Set(rows.map((r) => r.commodity))).sort(),
        );
      }
      return rows;
    })
    .catch((err) => {
      console.error('[market] Failed to fetch/parse WFP CSV via all proxies:', err);
      csvCachePromise = null; // allow retry on next call
      return [];
    });
  return csvCachePromise;
}

const LOOKBACK_MONTHS = 6;

function buildTrends(rows: PriceRow[], county?: string): PriceTrend[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - LOOKBACK_MONTHS);

  const recentRetail = rows.filter((r) => r.pricetype === 'Retail' && new Date(r.date) >= cutoff);

  let filtered = county
    ? recentRetail.filter((r) => r.admin2.toLowerCase() === county.toLowerCase())
    : recentRetail;

  if (county && filtered.length === 0) {
    console.warn(
      `[market] No WFP price rows matched county "${county}". Falling back to nationwide data. ` +
      `admin2 values actually present in the last ${LOOKBACK_MONTHS}mo:`,
      Array.from(new Set(recentRetail.map((r) => r.admin2))).slice(0, 20),
    );
    filtered = recentRetail;
  }

  const byCommodity = new Map<string, PriceRow[]>();
  filtered.forEach((r) => {
    const list = byCommodity.get(r.commodity) ?? [];
    list.push(r);
    byCommodity.set(r.commodity, list);
  });

  return Array.from(byCommodity.entries()).map(([commodity, entries]) => {
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const latest = entries[entries.length - 1];
    const prior = entries[entries.length - 2] ?? latest;
    const avg = entries.reduce((sum, e) => sum + e.price, 0) / entries.length;

    const pctChange = prior.price > 0 ? ((latest.price - prior.price) / prior.price) * 100 : 0;
    const pctChangeVsAvg = avg > 0 ? ((latest.price - avg) / avg) * 100 : 0;

    return {
      commodity,
      unit: latest.unit,
      currency: latest.currency,
      currentPrice: latest.price,
      priceDate: latest.date,
      pctChange: Math.round(pctChange * 10) / 10,
      pctChangeVsAvg: Math.round(pctChangeVsAvg * 10) / 10,
      source: 'WFP Food Prices (HDX)',
    };
  });
}

async function fetchPriceTrends(county: string): Promise<PriceTrend[]> {
  const rows = await fetchRawPriceRows();
  return buildTrends(rows, county);
}

// WFP's commodity field is often qualified — "Maize (white)", "Beans
// (dry)", "Rice (imported)", "Potatoes (Irish)", "Wheat (white)", etc. —
// so a plain substring match against our app crop names silently misses
// real data without this alias table.
const CROP_ALIASES: Record<string, string[]> = {
  maize: ['maize'],
  beans: ['beans'],
  rice: ['rice'],
  sorghum: ['sorghum'],
  wheat: ['wheat'],
  potatoes: ['potatoes', 'potato'],
  cabbage: ['cabbage'],
  tomatoes: ['tomato'],
  'cashew nuts': ['cashew'],
};

function fetchPriceSignal(crop: string, trends: PriceTrend[]): PriceTrend | null {
  const key = crop.toLowerCase();
  const aliases = CROP_ALIASES[key] ?? [key];
  return (
    trends.find((t) => {
      const commodity = t.commodity.toLowerCase();
      return aliases.some((alias) => commodity.includes(alias) || alias.includes(commodity));
    }) ?? null
  );
}

function classifyDemand(pctChange: number, pctChangeVsAvg: number): CropDemandTrend['demand'] {
  if (pctChange > 3 || pctChangeVsAvg > 8) return 'rising';
  if (pctChange < -3 || pctChangeVsAvg < -8) return 'falling';
  if (Math.abs(pctChangeVsAvg) <= 3) return 'stable';
  return 'high';
}

// Plain-language read of "is this price unusually high or low right now" —
// no percentages or "month" math surfaced to the farmer, that stays here
// as the input, not the output.
function buildGuidance(pctChangeVsAvg: number): { guidance: CropDemandTrend['guidance']; phrase: string } {
  if (pctChangeVsAvg >= 8) {
    return {
      guidance: 'sell',
      phrase: 'higher than usual right now — a good time to sell if your harvest is ready',
    };
  }
  if (pctChangeVsAvg <= -8) {
    return {
      guidance: 'hold',
      phrase: 'lower than usual right now — if you can store your harvest, waiting a bit may pay off',
    };
  }
  return {
    guidance: 'watch',
    phrase: 'about the same as usual — no strong reason to rush or wait',
  };
}

export async function fetchCropDemandTrends(county: string): Promise<CropDemandTrend[]> {
  const priceTrends = await fetchPriceTrends(county);

  // Only crop BUYER products are real crop names ("Maize", "Beans") —
  // agriculture product names ("Certified Maize Seeds (H629)") aren't
  // commodities WFP tracks prices for, so they're excluded from this set.
  const offerCrops = new Set(
    MOCK_OFFERS.filter((o) => o.type === 'buyer').map((o) => o.product),
  );
  const crops = new Set([...offerCrops, ...priceTrends.map((p) => p.commodity)]);

  if (crops.size === 0) {
    console.warn('[market] fetchCropDemandTrends produced zero crops — no WFP price trends available.');
    return [];
  }

  const trends = Array.from(crops).map((crop) => {
    const price = fetchPriceSignal(crop, priceTrends);

    if (!price) {
      return {
        crop,
        demand: 'stable',
        guidance: 'unknown',
        explanation: `We don't have enough recent price information for ${crop} yet.`,
      } as CropDemandTrend;
    }

    const demand = classifyDemand(price.pctChange, price.pctChangeVsAvg);
    const { guidance, phrase } = buildGuidance(price.pctChangeVsAvg);

    return {
      crop,
      demand,
      guidance,
      explanation: `${crop} prices are ${phrase}.`,
      unit: price.unit,
      currency: price.currency,
      currentPrice: price.currentPrice,
      asOf: price.priceDate,
    } as CropDemandTrend;
  });

  return trends.sort((a, b) => a.crop.localeCompare(b.crop));
}