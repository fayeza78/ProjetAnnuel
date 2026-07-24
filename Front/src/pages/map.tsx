import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { quartierApi, ApiError, type Quartier } from '../api';

const defaultCenter: [number, number] = [48.8566, 2.3522];

/** Tente de parser `limite_geo` en liste de points [lat, lng] (GeoJSON, tableau brut, ou WKT). */
function parsePolygon(raw?: string): [number, number][] | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    if (j?.type === 'Polygon' && Array.isArray(j.coordinates?.[0])) {
      return j.coordinates[0].map((c: number[]) => [c[1], c[0]] as [number, number]);
    }
    if (Array.isArray(j) && Array.isArray(j[0])) {
      return (j as number[][]).map((c) => [c[0], c[1]] as [number, number]);
    }
  } catch {
    /* pas du JSON */
  }
  const m = raw.match(/POLYGON\s*\(\((.+?)\)\)/i);
  if (m && m[1]) {
    return m[1].split(',').map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lat, lng] as [number, number];
    });
  }
  return null;
}

type ParsedQuartier = { quartier: Quartier; polygon: [number, number][] | null };

export default function Map() {
  const { t } = useTranslation();
  const [quartiers, setQuartiers] = useState<ParsedQuartier[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await quartierApi.list();
        setQuartiers(list.map((q) => ({ quartier: q, polygon: parsePolygon(q.limite_geo) })));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('map.loadError'));
      }
    })();
  }, [t]);

  const withPolygon = quartiers.filter((q) => q.polygon && q.polygon.length > 0);
  const center = withPolygon[0]?.polygon?.[0] ?? defaultCenter;

  return (
    <div className="w-full flex p-4 flex-1">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('map.title')}</h1>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <Stat value={quartiers.length} label={t('map.statNeighbourhoods')} />
            <Stat value={withPolygon.length} label={t('map.statZones')} />
          </div>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}

        <div className="bg-white rounded-2xl shadow-lg p-5 flex-1 flex flex-col">
          <div className="relative flex-1 min-h-[500px] w-full rounded-2xl overflow-hidden border border-gray-100 isolate">
            <MapContainer center={center} zoom={14} minZoom={11} maxZoom={18} className="h-full w-full">
              <TileLayer
                attribution="© OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {withPolygon.map(({ quartier, polygon }) => (
                <Polygon
                  key={quartier.id_quartier}
                  positions={polygon as [number, number][]}
                  pathOptions={{ color: '#0f766e', fillColor: '#5eead4', fillOpacity: 0.25 }}
                  eventHandlers={{
                    mouseover: (e) => e.target.setStyle({ fillOpacity: 0.45 }),
                    mouseout: (e) => e.target.setStyle({ fillOpacity: 0.25 }),
                  }}
                >
                  <Popup>
                    <div className="min-w-[220px]">
                      <p className="text-lg font-bold text-[#0f766e] mb-1">
                        {quartier.nom_quartier}
                      </p>
                      <p className="text-gray-600 mb-3">
                        {quartier.description ?? t('map.noDescription')}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <StatBadge label={t('map.inhabitants')} value={quartier.stats?.inhabitants_count} />
                        <StatBadge label={t('map.events')} value={quartier.stats?.events_count} />
                        <StatBadge label={t('map.services')} value={quartier.stats?.services_count} />
                        <StatBadge label={t('map.activeVotes')} value={quartier.stats?.active_votes} />
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value?: number }) {
  return (
    <div className="bg-teal-50 rounded-lg px-2 py-1 text-center">
      <span className="block text-lg font-bold text-[#0f766e]">{value ?? 0}</span>
      <span className="text-[11px] text-gray-500">{label}</span>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <span className="block text-3xl font-bold text-blue-1">{value}</span>
      <span className="text-sm font-medium uppercase tracking-wide">{label}</span>
    </div>
  );
}
