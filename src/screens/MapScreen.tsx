import { useEffect, useRef, useState, useCallback } from 'react';
import {
  MapPin, CloudRain, Sprout, X, Droplets, Loader2, Thermometer,
  Layers, LocateFixed, ChevronRight, PenTool, Fence,
} from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { COUNTIES, type County } from '@/lib/data';
import { fetchClimateStats, type ClimateStats } from '@/lib/climate';
import { generateRecommendations, type CropRecommendation } from '@/lib/recommendationEngine';
import { createMap, MAPBOX_TOKEN, KENYA_CENTER, RAINFALL_COLORS, addUserLocationMarker } from '@/lib/mapbox';
import { buildCountyGeoJSON, buildCountyPointsGeoJSON } from '@/lib/kenyaCounties.geojson';
import { detectLocation } from '@/lib/location';
import { useAuth } from '@/context/AuthContext';
import { getUserFarms, type Farm } from '@/lib/farms';
import FarmDrawer from '@/components/FarmDrawer';

// Map style options
const MAP_STYLES = {
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
  terrain: 'mapbox://styles/mapbox/outdoors-v12',
} as const;

type StyleKey = keyof typeof MAP_STYLES;

type DrawMode = 'idle' | 'drawing' | 'editing';

export default function MapScreen() {
  const { isGuest } = useAuth();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const drawPointsRef = useRef<[number, number][]>([]);
  const drawMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const [selected, setSelected] = useState<County | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [currentStyle, setCurrentStyle] = useState<StyleKey>('satellite');
  const [showStylePicker, setShowStylePicker] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Farm drawing state
  const [showDrawPanel, setShowDrawPanel] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('idle');
  const [drawnPolygon, setDrawnPolygon] = useState<GeoJSON.Polygon | null>(null);
  const [savedFarms, setSavedFarms] = useState<Farm[]>([]);
  const [detectedCountyForFarm, setDetectedCountyForFarm] = useState<string | null>(null);

  // Check for Mapbox token
  const hasToken = !!MAPBOX_TOKEN;

  // Initialize map
  useEffect(() => {
    if (!hasToken || !mapContainerRef.current || mapRef.current) return;

    try {
      const map = createMap(mapContainerRef.current);
      mapRef.current = map;

      map.on('load', () => {
        setMapReady(true);
        addCountyLayers(map);
      });

      map.on('error', (e) => {
        console.error('Mapbox error:', e);
        setMapError('Failed to load map. Check your Mapbox token.');
      });

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err) {
      console.error('Map init error:', err);
      setMapError('Failed to initialize map.');
    }
  }, [hasToken]);

  // Add county boundary & label layers
  const addCountyLayers = useCallback((map: mapboxgl.Map) => {
    const countyGeoJSON = buildCountyGeoJSON();
    const pointsGeoJSON = buildCountyPointsGeoJSON();

    // County boundary fill layer
    map.addSource('county-boundaries', {
      type: 'geojson',
      data: countyGeoJSON,
    });

    map.addLayer({
      id: 'county-fill',
      type: 'fill',
      source: 'county-boundaries',
      paint: {
        'fill-color': [
          'match',
          ['get', 'rainfallZone'],
          'High', RAINFALL_COLORS.High,
          'Medium', RAINFALL_COLORS.Medium,
          'Low', RAINFALL_COLORS.Low,
          '#6b7280', // fallback gray
        ],
        'fill-opacity': 0.25,
      },
    });

    map.addLayer({
      id: 'county-outline',
      type: 'line',
      source: 'county-boundaries',
      paint: {
        'line-color': [
          'match',
          ['get', 'rainfallZone'],
          'High', RAINFALL_COLORS.High,
          'Medium', RAINFALL_COLORS.Medium,
          'Low', RAINFALL_COLORS.Low,
          '#6b7280',
        ],
        'line-width': 2,
        'line-opacity': 0.7,
      },
    });

    // Hover highlight
    map.addLayer({
      id: 'county-highlight',
      type: 'fill',
      source: 'county-boundaries',
      paint: {
        'fill-color': '#ffffff',
        'fill-opacity': 0.15,
      },
      filter: ['==', ['get', 'name'], ''],
    });

    // County name labels
    map.addSource('county-points', {
      type: 'geojson',
      data: pointsGeoJSON,
    });

    map.addLayer({
      id: 'county-labels',
      type: 'symbol',
      source: 'county-points',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 12,
        'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        'text-anchor': 'center',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });

    // Click handler — select county
    map.on('click', 'county-fill', (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const name = feature.properties?.name;
      const county = COUNTIES.find((c) => c.name === name);
      if (county) setSelected(county);
    });

    // Cursor pointer on hover
    map.on('mouseenter', 'county-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'county-fill', () => {
      map.getCanvas().style.cursor = '';
      map.setFilter('county-highlight', ['==', ['get', 'name'], '']);
    });

    // Highlight on hover
    map.on('mousemove', 'county-fill', (e) => {
      const name = e.features?.[0]?.properties?.name ?? '';
      map.setFilter('county-highlight', ['==', ['get', 'name'], name]);
    });
  }, []);

  // Load saved farms
  useEffect(() => {
    if (isGuest) return;
    getUserFarms()
      .then(setSavedFarms)
      .catch(() => { /* ignore for guests */ });
  }, [isGuest]);

  // Display saved farm polygons on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || savedFarms.length === 0) return;

    const farmGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: savedFarms.map((f) => ({
        type: 'Feature' as const,
        properties: { name: f.name, area: f.area_hectares },
        geometry: f.boundary,
      })),
    };

    if (map.getSource('saved-farms')) {
      (map.getSource('saved-farms') as mapboxgl.GeoJSONSource).setData(farmGeoJSON);
    } else {
      map.addSource('saved-farms', { type: 'geojson', data: farmGeoJSON });
      map.addLayer({
        id: 'saved-farms-fill',
        type: 'fill',
        source: 'saved-farms',
        paint: { 'fill-color': '#22c55e', 'fill-opacity': 0.3 },
      });
      map.addLayer({
        id: 'saved-farms-outline',
        type: 'line',
        source: 'saved-farms',
        paint: { 'line-color': '#16a34a', 'line-width': 2.5, 'line-dasharray': [2, 1] },
      });
      map.addLayer({
        id: 'saved-farms-labels',
        type: 'symbol',
        source: 'saved-farms',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
        },
        paint: { 'text-color': '#ffffff', 'text-halo-color': '#16a34a', 'text-halo-width': 1.5 },
      });
    }
  }, [savedFarms, mapReady]);

  // Change map style
  const switchStyle = useCallback((style: StyleKey) => {
    const map = mapRef.current;
    if (!map) return;
    setCurrentStyle(style);
    setShowStylePicker(false);
    map.setStyle(MAP_STYLES[style]);
    // Re-add layers after style change
    map.once('style.load', () => {
      addCountyLayers(map);
    });
  }, [addCountyLayers]);

  // Locate user
  const locateUser = useCallback(async () => {
    setLocating(true);
    try {
      const loc = await detectLocation();
      const map = mapRef.current;
      if (!map) return;

      if (userMarkerRef.current) userMarkerRef.current.remove();
      userMarkerRef.current = addUserLocationMarker(map, loc.latitude, loc.longitude);
      setDetectedCountyForFarm(loc.county.name);

      map.flyTo({ center: [loc.longitude, loc.latitude], zoom: 10, duration: 2000 });
    } catch (err) {
      console.error('Location error:', err);
    } finally {
      setLocating(false);
    }
  }, []);

  // ── Farm Drawing Handlers ──────────────────────────────────────────────

  const clearDrawing = useCallback(() => {
    const map = mapRef.current;
    drawPointsRef.current = [];
    drawMarkersRef.current.forEach((m) => m.remove());
    drawMarkersRef.current = [];
    if (map?.getSource('draw-polygon')) {
      (map.getSource('draw-polygon') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection', features: [],
      });
    }
    if (map?.getSource('draw-lines')) {
      (map.getSource('draw-lines') as mapboxgl.GeoJSONSource).setData({
        type: 'FeatureCollection', features: [],
      });
    }
    setDrawnPolygon(null);
  }, []);

  const startDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    clearDrawing();
    setDrawMode('drawing');

    // Add draw sources if needed
    if (!map.getSource('draw-lines')) {
      map.addSource('draw-lines', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'draw-lines-layer',
        type: 'line',
        source: 'draw-lines',
        paint: { 'line-color': '#f59e0b', 'line-width': 2, 'line-dasharray': [3, 2] },
      });
    }
    if (!map.getSource('draw-polygon')) {
      map.addSource('draw-polygon', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'draw-polygon-fill',
        type: 'fill',
        source: 'draw-polygon',
        paint: { 'fill-color': '#f59e0b', 'fill-opacity': 0.2 },
      });
    }

    map.getCanvas().style.cursor = 'crosshair';

    const onClick = (e: mapboxgl.MapMouseEvent) => {
      const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      drawPointsRef.current.push(lngLat);

      // Add vertex marker
      const el = document.createElement('div');
      el.style.cssText = 'width:10px;height:10px;border-radius:50%;background:#f59e0b;border:2px solid white;cursor:pointer;';
      const marker = new mapboxgl.Marker({ element: el }).setLngLat(lngLat).addTo(map);
      drawMarkersRef.current.push(marker);

      // Update line
      const pts = drawPointsRef.current;
      if (pts.length >= 2) {
        (map.getSource('draw-lines') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: [...pts, pts[0]] },
        });
      }
      if (pts.length >= 3) {
        (map.getSource('draw-polygon') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] },
        });
      }
    };

    const onDblClick = (e: mapboxgl.MapMouseEvent) => {
      e.preventDefault();
      const pts = drawPointsRef.current;
      if (pts.length >= 3) {
        const polygon: GeoJSON.Polygon = {
          type: 'Polygon',
          coordinates: [[...pts, pts[0]]],
        };
        setDrawnPolygon(polygon);
        setDrawMode('editing');
      }
      map.getCanvas().style.cursor = '';
      map.off('click', onClick);
      map.off('dblclick', onDblClick);
    };

    map.on('click', onClick);
    map.on('dblclick', onDblClick);

    // Store cleanup refs
    (map as any).__drawClickHandler = onClick;
    (map as any).__drawDblClickHandler = onDblClick;
  }, [clearDrawing]);

  const cancelDrawing = useCallback(() => {
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = '';
      if ((map as any).__drawClickHandler) {
        map.off('click', (map as any).__drawClickHandler);
        map.off('dblclick', (map as any).__drawDblClickHandler);
      }
    }
    clearDrawing();
    setDrawMode('idle');
    setShowDrawPanel(false);
  }, [clearDrawing]);

  const handleFarmSaved = useCallback((farm: Farm) => {
    setSavedFarms((prev) => [farm, ...prev]);
    cancelDrawing();
  }, [cancelDrawing]);

  // Fallback: No Mapbox token — show the old card grid
  if (!hasToken) {
    return <FallbackCardGrid selected={selected} setSelected={setSelected} />;
  }

  return (
    <div className="space-y-0 -mx-4 -mt-4 md:-mx-8 md:-mt-8">
      {/* Map container — full width, fills screen */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 80px)' }}>
        {/* Map */}
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Map loading overlay */}
        {!mapReady && !mapError && (
          <div className="absolute inset-0 bg-surface/90 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={32} className="text-primary animate-spin" />
              <p className="text-sm font-medium text-on-surface-variant">Loading satellite map…</p>
            </div>
          </div>
        )}

        {/* Map error */}
        {mapError && (
          <div className="absolute inset-0 bg-surface/90 flex items-center justify-center z-10">
            <div className="text-center px-8">
              <MapPin size={40} className="text-error mx-auto mb-3" />
              <p className="text-sm font-semibold text-error">{mapError}</p>
              <p className="text-xs text-on-surface-variant mt-2">
                Add <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">VITE_MAPBOX_TOKEN</code> to your <code className="bg-surface-container-high px-1.5 py-0.5 rounded text-xs">.env</code> file.
              </p>
            </div>
          </div>
        )}

        {/* Map Controls Overlay */}
        {mapReady && (
          <>
            {/* Legend */}
            <div className="absolute top-4 left-4 z-20 bg-surface-container-lowest/90 backdrop-blur-md rounded-2xl p-3 shadow-lg border border-outline-variant/30">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Rainfall Zones</p>
              <div className="space-y-1.5">
                {(['High', 'Medium', 'Low'] as const).map((zone) => (
                  <div key={zone} className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm border border-white/30"
                      style={{ backgroundColor: RAINFALL_COLORS[zone] }}
                    />
                    <span className="text-[11px] font-medium text-on-surface">{zone}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Style picker */}
            <div className="absolute top-4 right-16 z-20">
              <button
                onClick={() => setShowStylePicker(!showStylePicker)}
                className="bg-surface-container-lowest/90 backdrop-blur-md rounded-xl p-2.5 shadow-lg border border-outline-variant/30 hover:bg-surface-container-high transition-colors"
                title="Map style"
              >
                <Layers size={18} className="text-on-surface" />
              </button>
              {showStylePicker && (
                <div className="absolute right-0 top-12 bg-surface-container-lowest/95 backdrop-blur-md rounded-xl shadow-lg border border-outline-variant/30 overflow-hidden min-w-[140px]">
                  {(Object.keys(MAP_STYLES) as StyleKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => switchStyle(key)}
                      className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                        currentStyle === key
                          ? 'bg-primary/10 text-primary'
                          : 'text-on-surface hover:bg-surface-container-high'
                      }`}
                    >
                      {key === 'satellite' ? '🛰️ Satellite' : key === 'streets' ? '🗺️ Streets' : '⛰️ Terrain'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right side buttons: Locate + Draw Farm */}
            <div className="absolute bottom-6 right-4 z-20 flex flex-col gap-3">
              {/* Draw farm FAB */}
              {!showDrawPanel && (
                <button
                  onClick={() => setShowDrawPanel(true)}
                  className="bg-surface-container-lowest/90 backdrop-blur-md text-primary rounded-full p-3.5 shadow-lg hover:bg-primary hover:text-on-primary transition-colors border border-outline-variant/30"
                  title="Draw farm boundary"
                >
                  <Fence size={20} />
                </button>
              )}
              {/* Locate me */}
              <button
                onClick={locateUser}
                disabled={locating}
                className="bg-primary text-on-primary rounded-full p-3.5 shadow-lg hover:bg-primary-container transition-colors disabled:opacity-60"
                title="Find my location"
              >
                {locating ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <LocateFixed size={20} />
                )}
              </button>
            </div>

            {/* County info hint */}
            {!showDrawPanel && (
              <div className="absolute bottom-6 left-4 z-20 bg-surface-container-lowest/90 backdrop-blur-md rounded-xl px-4 py-2.5 shadow-lg border border-outline-variant/30">
                <p className="text-[11px] font-medium text-on-surface-variant">
                  <MapPin size={12} className="inline mr-1 text-primary" />
                  Tap a county zone to explore climate data & crop recommendations
                </p>
              </div>
            )}

            {/* Farm count badge */}
            {savedFarms.length > 0 && !showDrawPanel && (
              <div className="absolute top-16 left-4 z-20 bg-green-600/90 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg">
                <p className="text-[11px] font-medium text-white flex items-center gap-1.5">
                  <Fence size={12} />
                  {savedFarms.length} saved farm{savedFarms.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Farm drawing toolbar */}
      {showDrawPanel && (
        <FarmDrawer
          drawnPolygon={drawnPolygon}
          drawMode={drawMode}
          onStartDraw={startDrawing}
          onCancelDraw={cancelDrawing}
          onDeletePolygon={() => { clearDrawing(); setDrawMode('idle'); }}
          onSaved={handleFarmSaved}
          detectedCounty={detectedCountyForFarm}
        />
      )}

      {/* County detail drawer */}
      {selected && <CountyDrawer county={selected} onClose={() => setSelected(null)} />}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
          70% { box-shadow: 0 0 0 12px rgba(59,130,246,0); }
          100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Fallback Card Grid (when no Mapbox token)
   ═══════════════════════════════════════════════════════════════════════════ */

function FallbackCardGrid({
  selected,
  setSelected,
}: {
  selected: County | null;
  setSelected: (c: County | null) => void;
}) {
  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Kenya Agro-Ecological Zones</h1>
        <p className="text-on-primary/80 text-sm mt-1.5 font-medium">
          Tap any county to explore live climate data, rainfall windows, and optimal crop varieties
        </p>
        <p className="text-on-primary/60 text-xs mt-2">
          💡 Add a <code className="bg-white/20 px-1.5 py-0.5 rounded">VITE_MAPBOX_TOKEN</code> to your .env file to enable the interactive satellite map.
        </p>
      </header>

      <div>
        <p className="text-sm font-semibold text-on-surface-variant mb-4 px-1">
          Showing {COUNTIES.length} Kenya Counties & Agricultural Zones
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COUNTIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c)}
              className="w-full bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/50 flex items-center gap-4 text-left hover:border-primary hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MapPin size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface text-base">{c.name}</p>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">{c.agroEcologicalZone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">{c.rainfallZone}</p>
                <p className="text-[11px] text-outline font-medium mt-1">{c.annualRainfallMm}mm/yr</p>
              </div>
              <ChevronRight size={18} className="text-outline group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {selected && <CountyDrawer county={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   County Detail Drawer (shared between map and fallback views)
   ═══════════════════════════════════════════════════════════════════════════ */

function CountyDrawer({ county, onClose }: { county: County; onClose: () => void }) {
  const [climate, setClimate] = useState<ClimateStats | null>(null);
  const [climateLoading, setClimateLoading] = useState(false);
  const [recs, setRecs] = useState<CropRecommendation[]>([]);

  // Fetch live climate & recommendation data for this county
  useEffect(() => {
    setClimateLoading(true);
    Promise.all([
      fetchClimateStats(county.latitude, county.longitude).catch(() => null),
      generateRecommendations({ lat: county.latitude, lon: county.longitude, countyName: county.name }).catch(() => null),
    ])
      .then(([climateRes, recsRes]) => {
        setClimate(climateRes);
        if (recsRes) setRecs(recsRes.recommendations);
      })
      .finally(() => setClimateLoading(false));
  }, [county.name, county.latitude, county.longitude]);

  const isLive = climate?.source === 'Open-Meteo Climate Archive';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-surface-container-lowest w-full max-w-lg sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up border border-outline-variant/40">
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{county.name}</h2>
            <p className="text-sm text-on-surface-variant">{county.region} Region</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
            <X size={18} className="text-outline" />
          </button>
        </div>

        {/* Data source badge */}
        <div className="flex items-center gap-2 mb-4">
          {climateLoading ? (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-outline/10 text-outline flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Loading live climate…
            </span>
          ) : isLive ? (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              🟢 Live Climate Data (5-year average)
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-outline/10 text-outline">
              🟡 Estimated Climate Data
            </span>
          )}
        </div>

        {/* Zone info — with live data overlay */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <InfoBox icon={MapPin} label="Agro-Ecological Zone" value={county.agroEcologicalZone} />
          <InfoBox
            icon={CloudRain}
            label="Annual Rainfall"
            value={climate
              ? `${climate.rainfallZone} (${climate.annualRainfallMm}mm)`
              : `${county.rainfallZone} (${county.annualRainfallMm}mm)`}
            badge={isLive ? 'Live' : undefined}
          />
          <InfoBox
            icon={Droplets}
            label="Long Rains"
            value={climate
              ? `${climate.longRainsStart}–${climate.longRainsEnd}`
              : `${county.longRainsStart}–${county.longRainsEnd}`}
            badge={isLive ? 'Live' : undefined}
          />
          <InfoBox
            icon={Droplets}
            label="Short Rains"
            value={climate
              ? `${climate.shortRainsStart}–${climate.shortRainsEnd}`
              : `${county.shortRainsStart}–${county.shortRainsEnd}`}
            badge={isLive ? 'Live' : undefined}
          />
        </div>

        {/* Live temperature and elevation */}
        {climate && (climate.avgTempMin > 0 || climate.elevation != null) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {climate.avgTempMin > 0 && (
              <InfoBox
                icon={Thermometer}
                label="Avg Temperature"
                value={`${climate.avgTempMin.toFixed(0)}–${climate.avgTempMax.toFixed(0)}°C`}
                badge={isLive ? 'Live' : undefined}
              />
            )}
            {climate.elevation != null && (
              <InfoBox
                icon={MapPin}
                label="Elevation"
                value={`${Math.round(climate.elevation)}m above sea level`}
                badge={isLive ? 'Live' : undefined}
              />
            )}
          </div>
        )}

        {/* Monthly rainfall chart (live data) */}
        {climate && isLive && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <CloudRain size={15} className="text-primary" /> Monthly Rainfall Pattern
            </h3>
            <div className="flex items-end gap-1 h-24 bg-surface-container-high rounded-xl p-3">
              {climate.monthlyRainfall.map((mm, i) => {
                const maxMm = Math.max(...climate.monthlyRainfall, 1);
                const height = Math.max(4, (mm / maxMm) * 100);
                const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-primary/70 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${months[i]}: ${mm.toFixed(0)}mm`}
                    />
                    <span className="text-[8px] text-outline">{months[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub-counties */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-on-surface mb-2">Sub-Counties</h3>
          <div className="flex flex-wrap gap-1.5">
            {county.subCounties.map((s) => (
              <span key={s} className="text-xs bg-surface-container-high px-2.5 py-1 rounded-full text-on-surface-variant">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Suitable crops */}
        <div>
          <h3 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
            <Sprout size={15} className="text-primary" /> Suitable Crops (Live & Cached Analysis)
          </h3>
          <div className="space-y-2">
            {recs.slice(0, 6).map((r) => (
              <div key={r.crop.name} className="bg-surface-container-high rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{r.crop.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-on-surface">{r.crop.name}</p>
                    <span className="text-xs font-bold text-primary">{r.score}%</span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-1">{r.explanations[0]}</p>
                  <div className="h-1 bg-surface-container rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.score >= 70 ? 'bg-primary' : r.score >= 50 ? 'bg-tertiary' : 'bg-error'}`}
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended varieties for top crop */}
        {recs[0] && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-on-surface mb-2">
              Top Pick: {recs[0].crop.name} ({recs[0].recommendedVariety})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {recs[0].crop.varieties.map((v) => (
                <span key={v.name} className="text-xs bg-surface-container-high px-2.5 py-1 rounded-full text-on-surface-variant">
                  {v.name} · {v.maturityDays}d ({v.type})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   InfoBox Component
   ═══════════════════════════════════════════════════════════════════════════ */

function InfoBox({ icon: Icon, label, value, badge }: { icon: typeof MapPin; label: string; value: string; badge?: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-outline mb-1">
        <Icon size={13} />
        <span className="text-[11px]">{label}</span>
        {badge && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
