import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { StarFill } from 'react-bootstrap-icons';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import {
  serviceApi,
  eventApi,
  voteApi,
  userApi,
  quartierApi,
  interestsApi,
  recommendationApi,
  ApiError,
  type Evenement,
  type Vote,
  type Quartier,
  type Me,
} from '../api';
import { dateLocale } from '../i18n/config';

type VoisinRecommande = {
  id: string;
  user: Me | null;
  moyenne: number | null;
  nombreDeNotes: number;
  interetsCommuns: string[];
};

const centreParDefaut: [number, number] = [48.8566, 2.3522];

// Lit limite_geo (GeoJSON, tableau brut ou WKT) et renvoie les points [lat, lng].
function lirePolygone(raw?: string): [number, number][] | null {
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
    return m[1].split(',').map((paire) => {
      const [lng, lat] = paire.trim().split(/\s+/).map(Number);
      return [lat, lng] as [number, number];
    });
  }
  return null;
}

type QuartierTrace = { quartier: Quartier; polygone: [number, number][] };

function Home() {
  const { t } = useTranslation();
  const [servicesCount, setServicesCount] = useState(0);
  const [events, setEvents] = useState<Evenement[]>([]);
  const [votes, setVotes] = useState<Vote[]>([]);
  const [points, setPoints] = useState(0);
  const [quartiers, setQuartiers] = useState<QuartierTrace[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [interests, setInterests] = useState<string[]>([]);
  const [neighbourRecs, setNeighbourRecs] = useState<VoisinRecommande[]>([]);
  const [recommendedEventIds, setRecommendedEventIds] = useState<Set<string>>(new Set());
  const [eventInterests, setEventInterests] = useState<Record<number, string[]>>({});

  useEffect(() => {
    (async () => {
      try {
        const [services, evs, vs, pts, qs, myInterests, voisinsRes, evenementsRes] = await Promise.all([
          serviceApi.list().catch(() => []),
          eventApi.list().catch(() => []),
          voteApi.list().catch(() => []),
          userApi.points().catch(() => ({ points: 0 })),
          quartierApi.list().catch(() => []),
          interestsApi.get().catch(() => ({ interests: [] as string[] })),
          recommendationApi.voisins().catch(() => ({ voisins: [] })),
          recommendationApi.evenements().catch(() => ({ evenements: [] })),
        ]);
        setServicesCount(services.length);
        setEvents(evs);
        setVotes(vs);
        setPoints(pts.points);
        // on ne garde que les quartiers dont la limite est exploitable
        setQuartiers(
          qs
            .map((q) => ({ quartier: q, polygone: lirePolygone(q.limite_geo) }))
            .filter((q): q is QuartierTrace => q.polygone !== null && q.polygone.length > 0),
        );

        setInterests(myInterests.interests);
        setRecommendedEventIds(new Set(evenementsRes.evenements));

        // les 3 voisins recommandés pour l'accueil
        const top = voisinsRes.voisins.slice(0, 3);
        const mesInterets = myInterests.interests;
        const resolved = await Promise.all(
          top.map(async (id) => {
            // profil, note et intérêts du voisin
            const [voisin, note, interets] = await Promise.all([
              userApi.get(Number(id)).catch(() => null),
              userApi.getNote(Number(id)).catch(() => null),
              userApi
                .getInterets(Number(id))
                .catch(() => ({ interests: [] as string[] })),
            ]);
            return {
              id,
              user: voisin,
              moyenne: note?.moyenne ?? null,
              nombreDeNotes: note?.nombreDeNotes ?? 0,
              interetsCommuns: interets.interests.filter((i) =>
                mesInterets.includes(i),
              ),
            };
          }),
        );
        setNeighbourRecs(resolved);

        // intérêts des événements du mini calendrier
        const debutJour = new Date();
        debutJour.setHours(0, 0, 0, 0);
        const aVenir = evs
          .filter((e) => !e.date_ || new Date(e.date_) >= debutJour)
          .sort((a, b) => {
            const da = a.date_ ? new Date(a.date_).getTime() : Infinity;
            const db = b.date_ ? new Date(b.date_).getTime() : Infinity;
            return da - db;
          })
          .slice(0, 5);
        const tagsEntries = await Promise.all(
          aVenir.map(async (e): Promise<[number, string[]]> => {
            const detail = await eventApi
              .get(e.id_evenement)
              .then((r) => r.detail)
              .catch(() => null);
            return [e.id_evenement, detail?.tags ?? []];
          }),
        );
        setEventInterests(
          Object.fromEntries(tagsEntries) as Record<number, string[]>,
        );
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : t('common.genericError'),
        );
      }
    })();
  }, [t]);

  const nameOfNeighbour = (r: VoisinRecommande) =>
    r.user?.email ? r.user.email.split('@')[0] : t('classement.neighbourFallback', { id: r.id });

  const fmtDate = (iso?: string) => {
    if (!iso) return { day: '--', month: '' };
    const d = new Date(iso);
    return {
      day: String(d.getDate()),
      month: d.toLocaleDateString(dateLocale(), { month: 'short' }),
    };
  };

  // les événements à venir, du plus proche au plus loin
  const evenementsAVenir = events
    .filter((e) => {
      if (!e.date_) return true;
      const debutJour = new Date();
      debutJour.setHours(0, 0, 0, 0);
      return new Date(e.date_) >= debutJour;
    })
    .sort((a, b) => {
      const da = a.date_ ? new Date(a.date_).getTime() : Infinity;
      const db = b.date_ ? new Date(b.date_).getTime() : Infinity;
      return da - db;
    });

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <div>
            <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('home.title')}</h1>
            <p className="text-gray-500 mt-2 font-medium">
              {t('home.subtitle')}
            </p>
          </div>

          <div className="flex flex-wrap gap-6 md:gap-8">
            <Stat value={servicesCount} label={t('home.statServices')} />
            <Stat value={events.length} label={t('home.statEvents')} />
            <Stat value={points} label={t('home.statPoints')} />
          </div>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}

        <div className="bg-white rounded-2xl shadow-lg p-5 md:p-8 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl md:text-3xl font-bold">{t('home.mapTitle')}</h2>
            <span className="bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
              {t('home.mapBadge')}
            </span>
          </div>
          {quartiers.length === 0 ? (
            <p className="text-gray-500">{t('home.mapHint')}</p>
          ) : (
            <div className="h-[420px] w-full rounded-2xl overflow-hidden border border-gray-100 isolate">
              <MapContainer
                center={quartiers[0]?.polygone[0] ?? centreParDefaut}
                zoom={13}
                minZoom={11}
                maxZoom={18}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="© OpenStreetMap"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {quartiers.map(({ quartier, polygone }) => (
                  <Polygon
                    key={quartier.id_quartier}
                    positions={polygone}
                    pathOptions={{ color: '#0f766e', fillColor: '#5eead4', fillOpacity: 0.25 }}
                  >
                    <Popup>{quartier.nom_quartier}</Popup>
                  </Polygon>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6">{t('home.miniCalendarTitle')}</h2>
            <div className="flex flex-col gap-4">
              {evenementsAVenir.length === 0 && (
                <p className="text-gray-500">{t('home.noEvent')}</p>
              )}
              {evenementsAVenir.slice(0, 5).map((event) => {
                const { day, month } = fmtDate(event.date_);
                const recommande = recommendedEventIds.has(String(event.id_evenement));
                return (
                  <div
                    key={event.id_evenement}
                    className="border rounded-2xl p-4 flex gap-4 items-center"
                  >
                    <div className="bg-blue-1 text-white rounded-2xl p-4 text-center min-w-[80px]">
                      <span className="block text-2xl font-bold">{day}</span>
                      <span className="text-sm">{month}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{event.titre}</h3>
                        {recommande && (
                          <span className="bg-orange-100 text-orange-1 text-xs font-semibold px-3 py-1 rounded-full">
                            {t('home.recommendedForYou')}
                          </span>
                        )}
                      </div>
                      {(eventInterests[event.id_evenement] ?? []).length > 0 ? (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {(eventInterests[event.id_evenement] ?? []).map((i) => (
                            <span
                              key={i}
                              className="bg-blue-50 text-blue-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                            >
                              {i}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600">
                          {event.type ?? t('home.eventFallback')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6">{t('home.votesInProgressTitle')}</h2>
            <div className="flex flex-col gap-4">
              {votes.length === 0 && (
                <p className="text-gray-500">{t('home.noVote')}</p>
              )}
              {votes.slice(0, 5).map((vote) => {
                const total = (vote.options ?? []).reduce(
                  (s, o) => s + o.votesCount,
                  0,
                );
                const top = (vote.options ?? [])
                  .map((o) => o.votesCount)
                  .reduce((a, b) => Math.max(a, b), 0);
                const pct = total > 0 ? Math.round((top / total) * 100) : 0;

                return (
                  <div
                    key={vote.postgres_id}
                    className="border rounded-2xl p-4"
                  >
                    <h3 className="font-bold text-lg mb-3">{vote.question}</h3>
                    <div className="flex justify-between text-sm font-bold mb-2">
                      <span className="text-blue-1">{t('home.leading', { pct })}</span>
                      <span>{t('home.votesTotal', { count: total })}</span>
                    </div>
                    <div className="h-3 w-full bg-orange-1 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-1"
                        style={{ width: pct + '%' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold">{t('home.interestsTitle')}</h2>
              <Link
                to="/profil"
                className="bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold text-sm"
              >
                {t('home.interestsEdit')}
              </Link>
            </div>
            {interests.length === 0 ? (
              <p className="text-gray-500">{t('home.interestsEmpty')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {interests.map((interest) => (
                  <span
                    key={interest}
                    className="bg-blue-50 text-blue-1 px-4 py-2 rounded-full font-semibold"
                  >
                    {interest}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-3xl font-bold">{t('home.neighbourRecsTitle')}</h2>
              <Link
                to="/classement"
                className="bg-blue-1 text-white px-4 py-2 rounded-full font-semibold text-sm"
              >
                {t('home.neighbourRecsSeeAll')}
              </Link>
            </div>
            <p className="text-sm text-gray-500 mb-6">{t('home.neighbourRecsWhy')}</p>
            {neighbourRecs.length === 0 ? (
              <p className="text-gray-500">{t('home.neighbourRecsEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-4">
                {neighbourRecs.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-4 border rounded-2xl p-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-1 text-white flex items-center justify-center text-xl font-bold shrink-0">
                      {nameOfNeighbour(r).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold truncate">{nameOfNeighbour(r)}</h3>
                      <p className="text-sm text-gray-500 truncate">
                        {typeof r.user?.quartier === 'string'
                          ? r.user.quartier
                          : r.user?.quartier?.nom_quartier ?? t('home.neighbourRecsSameArea')}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {r.moyenne != null ? (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-1 text-xs font-semibold px-3 py-1 rounded-full">
                            <StarFill size={11} />
                            {r.moyenne} ·{' '}
                            {t('home.neighbourRecsRatings', { nb: r.nombreDeNotes })}
                          </span>
                        ) : (
                          <span className="inline-block bg-blue-50 text-blue-1 text-xs font-semibold px-3 py-1 rounded-full">
                            {t('home.neighbourRecsSameArea')}
                          </span>
                        )}
                        {r.interetsCommuns.length > 0 && (
                          <span className="inline-block bg-blue-50 text-blue-1 text-xs font-semibold px-3 py-1 rounded-full capitalize">
                            {t('home.neighbourRecsCommon', {
                              list: r.interetsCommuns.slice(0, 3).join(', '),
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <span className="block text-3xl font-bold text-blue-1">{value}</span>
      <span className="text-sm font-medium uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

export default Home;
