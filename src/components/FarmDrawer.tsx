// Farm Drawing Toolbar — allows users to draw farm boundaries on the map
// Uses Mapbox Draw for polygon drawing and Turf.js for area calculation.

import { useState, useCallback } from 'react';
import { PenTool, Trash2, Save, X, MapPin, Ruler } from 'lucide-react';
import { calcAreaHectares, calcAreaAcres, saveFarm, type Farm } from '@/lib/farms';
import { useAuth } from '@/context/AuthContext';
import SignInPromptModal from '@/components/SignInPromptModal';

type DrawMode = 'idle' | 'drawing' | 'editing';

type FarmDrawerProps = {
  drawnPolygon: GeoJSON.Polygon | null;
  drawMode: DrawMode;
  onStartDraw: () => void;
  onCancelDraw: () => void;
  onDeletePolygon: () => void;
  onSaved: (farm: Farm) => void;
  detectedCounty?: string | null;
  detectedSubCounty?: string | null;
};

export default function FarmDrawer({
  drawnPolygon,
  drawMode,
  onStartDraw,
  onCancelDraw,
  onDeletePolygon,
  onSaved,
  detectedCounty,
  detectedSubCounty,
}: FarmDrawerProps) {
  const { isGuest } = useAuth();
  const [name, setName] = useState('My Farm');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSignIn, setShowSignIn] = useState(false);

  const areaHa = drawnPolygon ? calcAreaHectares(drawnPolygon) : 0;
  const areaAc = drawnPolygon ? calcAreaAcres(drawnPolygon) : 0;

  const handleSave = useCallback(async () => {
    if (isGuest) {
      setShowSignIn(true);
      return;
    }
    if (!drawnPolygon) return;

    // Validate polygon
    const coords = drawnPolygon.coordinates[0];
    if (!coords || coords.length < 4) {
      setError('Please draw at least 3 points to form a boundary.');
      return;
    }
    if (areaHa > 500) {
      setError('Farm boundary seems too large (>500 ha). Please redraw.');
      return;
    }
    if (areaHa < 0.01) {
      setError('Farm boundary seems too small. Please redraw.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const farm = await saveFarm(
        name.trim() || 'My Farm',
        drawnPolygon,
        detectedCounty ?? undefined,
        detectedSubCounty ?? undefined,
      );
      onSaved(farm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save farm.');
    } finally {
      setSaving(false);
    }
  }, [drawnPolygon, name, isGuest, areaHa, detectedCounty, detectedSubCounty, onSaved]);

  return (
    <>
      {/* Drawing toolbar panel */}
      <div className="absolute bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-30 bg-surface-container-lowest/95 backdrop-blur-md rounded-2xl shadow-2xl border border-outline-variant/30 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-outline-variant/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PenTool size={16} className="text-primary" />
            <span className="text-sm font-bold text-on-surface">
              {drawMode === 'drawing' ? 'Drawing Farm Boundary' : drawnPolygon ? 'Farm Boundary Ready' : 'Draw Your Farm'}
            </span>
          </div>
          <button
            onClick={onCancelDraw}
            className="w-7 h-7 rounded-full bg-surface-container-high flex items-center justify-center"
          >
            <X size={14} className="text-outline" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          {/* Instructions */}
          {!drawnPolygon && drawMode !== 'drawing' && (
            <div className="text-center py-2">
              <MapPin size={28} className="text-primary mx-auto mb-2 opacity-60" />
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Tap <strong>"Start Drawing"</strong> then tap on the map to place boundary points around your farm.
                Double-tap to finish.
              </p>
            </div>
          )}

          {drawMode === 'drawing' && (
            <div className="bg-primary/10 rounded-xl px-3 py-2">
              <p className="text-xs font-medium text-primary">
                ✏️ Tap on the map to place boundary points. Double-tap to close the polygon.
              </p>
            </div>
          )}

          {/* Area display */}
          {drawnPolygon && (
            <div className="bg-surface-container-high rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Ruler size={14} className="text-primary" />
                <span className="text-xs font-bold text-on-surface">Farm Area</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-lg font-bold text-on-surface">{areaHa.toLocaleString()}</p>
                  <p className="text-[10px] text-on-surface-variant">hectares</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-on-surface">{areaAc.toLocaleString()}</p>
                  <p className="text-[10px] text-on-surface-variant">acres</p>
                </div>
              </div>
            </div>
          )}

          {/* Farm name input */}
          {drawnPolygon && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant mb-1 block">Farm Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-surface-container-high rounded-xl px-3 py-2.5 text-sm text-on-surface border border-outline-variant/30 focus:border-primary focus:outline-none transition-colors"
                placeholder="e.g. Kamau's Shamba"
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="text-xs text-error font-medium">{error}</p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {!drawnPolygon && drawMode !== 'drawing' && (
              <button
                onClick={onStartDraw}
                className="flex-1 bg-primary text-on-primary font-semibold py-2.5 rounded-full text-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
              >
                <PenTool size={14} />
                Start Drawing
              </button>
            )}

            {drawnPolygon && (
              <>
                <button
                  onClick={onDeletePolygon}
                  className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center hover:bg-error/20 transition-colors"
                  title="Delete and redraw"
                >
                  <Trash2 size={16} className="text-error" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 bg-primary text-on-primary font-semibold py-2.5 rounded-full text-sm hover:bg-primary-container transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  <Save size={14} />
                  {saving ? 'Saving…' : 'Save Farm'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {showSignIn && <SignInPromptModal onClose={() => setShowSignIn(false)} />}
    </>
  );
}
