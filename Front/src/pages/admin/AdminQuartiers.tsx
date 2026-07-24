import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup, useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import { useTranslation } from 'react-i18next';
import { quartierApi, adminApi, ApiError, type Quartier } from '../../api';

const defaultCenter: [number, number] = [48.8566, 2.3522];

/** Parse `limite_geo` (GeoJSON Polygon, tableau brut ou WKT) en points [lat, lng]. */
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

/** Active les contrôles de dessin Geoman et remonte la géométrie dessinée. */
function GeomanDraw({
  onCreate,
  lang,
}: {
  onCreate: (geometry: unknown) => void;
  lang: 'fr' | 'en';
}) {
  const map = useMap();

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pm = (map as any).pm;
    pm.addControls({
      position: 'topleft',
      drawPolygon: true,
      drawMarker: false,
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawText: false,
      editMode: false,
      dragMode: false,
      cutPolygon: false,
      rotateMode: false,
      removalMode: false,
    });
    pm.setLang(lang);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = (e: any) => {
      const geojson = e.layer.toGeoJSON();
      onCreate(geojson.geometry);
      map.removeLayer(e.layer); // on ré-affiche depuis l'état après sauvegarde
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (map as any).on('pm:create', handler);

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).off('pm:create', handler);
      try {
        pm.removeControls();
      } catch {
        /* noop */
      }
    };
  }, [map, onCreate, lang]);

  return null;
}

export default function AdminQuartiers() {
  const { t, i18n } = useTranslation();
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nom, setNom] = useState('');
  const [drawn, setDrawn] = useState<unknown | null>(null);

  const load = async () => {
    try {
      setQuartiers(await quartierApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.loadError'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const onCreate = useCallback((geometry: unknown) => {
    setDrawn(geometry);
    flash(t('admin.zoneDrawnFlash'));
  }, [t]);

  const save = async () => {
    setError(null);
    if (!nom.trim()) {
      setError(t('admin.nameRequired'));
      return;
    }
    try {
      await adminApi.createQuartier({
        nom_quartier: nom.trim(),
        ...(drawn ? { limite_geo: JSON.stringify(drawn) } : {}),
      });
      setNom('');
      setDrawn(null);
      flash(t('admin.quartierSaved'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.saveError'));
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t('admin.deleteQuartierConfirm'))) return;
    setError(null);
    try {
      await adminApi.deleteQuartier(id);
      flash(t('admin.quartierDeleted'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  const withPolygon = quartiers
    .map((q) => ({ q, polygon: parsePolygon(q.limite_geo) }))
    .filter((x) => x.polygon && x.polygon.length > 0);
  const center = withPolygon[0]?.polygon?.[0] ?? defaultCenter;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-2">{t('admin.quartiersModelingTitle')}</h2>
        <p className="text-gray-500 mb-4">
          {t('admin.quartiersModelingHint')}
        </p>

        {notice && <p className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-xl mb-3">{notice}</p>}
        {error && <p className="bg-orange-100 text-orange-1 font-semibold px-4 py-2 rounded-xl mb-3">{error}</p>}

        <div className="flex flex-wrap gap-4 items-end mb-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block font-bold mb-1">{t('admin.quartierNameLabel')}</label>
            <input
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              className="w-full border rounded-xl p-3"
              placeholder={t('admin.quartierNamePlaceholder')}
            />
          </div>
          <div className="text-sm font-semibold px-3 py-2 rounded-xl bg-gray-50">
            {drawn ? t('admin.zoneDrawn') : t('admin.noZoneDrawn')}
          </div>
          <button onClick={save} className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90">
            {t('admin.saveQuartierButton')}
          </button>
        </div>

        <div className="h-[500px] w-full rounded-2xl overflow-hidden border border-gray-100">
          <MapContainer center={center} zoom={13} minZoom={11} maxZoom={18} className="h-full w-full">
            <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <GeomanDraw onCreate={onCreate} lang={i18n.language.startsWith('en') ? 'en' : 'fr'} />
            {withPolygon.map(({ q, polygon }) => (
              <Polygon
                key={q.id_quartier}
                positions={polygon as [number, number][]}
                pathOptions={{ color: '#0f766e', fillColor: '#5eead4', fillOpacity: 0.25 }}
              >
                <Popup>
                  <strong>{q.nom_quartier}</strong>
                </Popup>
              </Polygon>
            ))}
          </MapContainer>
        </div>
      </div>

      {/* Liste des quartiers */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">{t('admin.quartiersListTitle', { count: quartiers.length })}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {quartiers.map((q) => {
            const hasZone = !!parsePolygon(q.limite_geo);
            return (
              <div key={q.id_quartier} className="border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-bold">{q.nom_quartier}</p>
                  <p className={`text-sm ${hasZone ? 'text-green-600' : 'text-gray-400'}`}>
                    {hasZone ? t('admin.zoneDefined') : t('admin.noZone')}
                  </p>
                </div>
                <button onClick={() => remove(q.id_quartier)} className="text-red-500 font-semibold hover:underline">
                  {t('admin.deleteButton')}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
