import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StarFill } from 'react-bootstrap-icons';
import {
  recommendationApi,
  userApi,
  neighbourApi,
  ApiError,
  type Me,
  type Neighbour,
} from '../api';

type Ranked = { id: string; user: Me | null; rank: number };

// note reçue par un voisin (moyenne + nombre)
type NoteVoisin = { moyenne: number | null; nombreDeNotes: number };

function Classement() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Ranked[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [moyennes, setMoyennes] = useState<Record<number, NoteVoisin>>({});
  const [ratingBusyId, setRatingBusyId] = useState<number | null>(null);
  const [rateError, setRateError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      // le classement = les voisins fiables
      const { voisins } = await recommendationApi.voisins();
      const users = await Promise.all(
        voisins.map(async (id, index) => {
          const user = await userApi.get(Number(id)).catch(() => null);
          return { id, user, rank: index + 1 } as Ranked;
        }),
      );
      setRows(users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('classement.loadError'));
    } finally {
      setLoading(false);
    }
  };

  // ma note + la moyenne de chaque voisin
  const chargerNotes = async (liste: Neighbour[]) => {
    const notes = await Promise.all(
      liste.map((n) => userApi.getNote(n.id_user).catch(() => null)),
    );
    const mesNotes: Record<number, number> = {};
    const moyennesVoisins: Record<number, NoteVoisin> = {};
    liste.forEach((n, i) => {
      mesNotes[n.id_user] = notes[i]?.maNote ?? 0;
      moyennesVoisins[n.id_user] = {
        moyenne: notes[i]?.moyenne ?? null,
        nombreDeNotes: notes[i]?.nombreDeNotes ?? 0,
      };
    });
    setRatings(mesNotes);
    setMoyennes(moyennesVoisins);
  };

  useEffect(() => {
    load();
    // les voisins de mon quartier
    neighbourApi
      .list()
      .then((liste) => {
        setNeighbours(liste);
        return chargerNotes(liste);
      })
      .catch(() => undefined);
  }, [t]);

  const handleRate = async (id: number, rating: number) => {
    setRateError(null);
    setRatingBusyId(id);
    try {
      await userApi.noter(id, rating);
      setRatings((prev) => ({ ...prev, [id]: rating }));
      // recharge la moyenne du voisin
      const note = await userApi.getNote(id).catch(() => null);
      if (note)
        setMoyennes((prev) => ({
          ...prev,
          [id]: { moyenne: note.moyenne, nombreDeNotes: note.nombreDeNotes },
        }));
      await load();
    } catch (err) {
      setRateError(err instanceof ApiError ? err.message : t('classement.rateError'));
    } finally {
      setRatingBusyId(null);
    }
  };

  const nameOf = (r: Ranked) =>
    r.user?.email ? r.user.email.split('@')[0] : t('classement.neighbourFallback', { id: r.id });

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('classement.title')}</h1>
          <div className="flex gap-8">
            <div className="text-center">
              <span className="block text-3xl font-bold text-blue-1">{rows.length}</span>
              <span className="text-sm font-medium uppercase tracking-wide">{t('classement.reliableNeighbours')}</span>
            </div>
          </div>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}
        {loading && <p className="font-semibold text-gray-600">{t('classement.loading')}</p>}

        {!loading && rows.length === 0 && (
          <div className="bg-white p-10 rounded-2xl shadow-lg text-center">
            <p className="text-xl font-bold text-gray-700">
              {t('classement.empty')}
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 mb-8">
              {rows.slice(0, 3).map((r) => (
                <div
                  key={r.id}
                  className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center text-center gap-4"
                >
                  <div className="text-5xl font-bold text-orange-1">#{r.rank}</div>
                  <div className="w-20 h-20 rounded-full bg-blue-1 text-white flex items-center justify-center text-3xl font-bold">
                    {nameOf(r).charAt(0).toUpperCase()}
                  </div>
                  <h2 className="text-2xl font-bold">{nameOf(r)}</h2>
                  <span className="bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
                    {t('classement.trustedBadge')}
                  </span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-3xl font-bold mb-6">{t('classement.recommendedNeighbours')}</h2>
              <div className="flex flex-col gap-4">
                {rows.map((r) => (
                  <div
                    key={r.id}
                    className="grid grid-cols-1 xl:grid-cols-3 items-center gap-4 border rounded-2xl p-5"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-2xl font-bold text-orange-1">#{r.rank}</span>
                      <div className="w-12 h-12 rounded-full bg-blue-1 text-white flex items-center justify-center text-xl font-bold">
                        {nameOf(r).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{nameOf(r)}</h3>
                        <p className="text-sm font-semibold text-orange-1">{t('classement.trustedBadge')}</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-bold text-blue-1">
                        {r.user?.ville ?? '—'}
                      </span>
                      <span className="text-sm">{t('classement.city')}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-lg font-bold text-blue-1">
                        {typeof r.user?.quartier === 'string'
                          ? r.user.quartier
                          : r.user?.quartier?.nom_quartier ?? '—'}
                      </span>
                      <span className="text-sm">{t('classement.neighbourhood')}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Noter mes voisins (alimente le score de confiance) ── */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
          <h2 className="text-3xl font-bold mb-2">{t('classement.rateNeighboursTitle')}</h2>
          <p className="text-gray-500 mb-6">{t('classement.rateNeighboursHint')}</p>

          {rateError && <p className="text-orange-1 font-medium mb-4">{rateError}</p>}

          {neighbours.length === 0 ? (
            <p className="text-gray-400">{t('classement.noNeighboursToRate')}</p>
          ) : (
            <div className="flex flex-col gap-3">
              {neighbours.map((n) => {
                const given = ratings[n.id_user] ?? 0;
                const busy = ratingBusyId === n.id_user;
                const moy = moyennes[n.id_user];
                return (
                  <div
                    key={n.id_user}
                    className="flex items-center justify-between gap-4 border rounded-2xl p-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-1 flex items-center justify-center font-bold shrink-0">
                        {n.email.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold truncate">{n.email.split('@')[0]}</p>
                        <p className="text-sm text-gray-500 truncate">{n.quartier ?? n.ville ?? n.email}</p>
                        {moy?.moyenne != null && (
                          <p className="text-xs font-semibold text-orange-1">
                            {t('classement.average', { note: moy.moyenne, nb: moy.nombreDeNotes })}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => handleRate(n.id_user, star)}
                          disabled={busy}
                          className="disabled:opacity-50"
                        >
                          <StarFill
                            size={22}
                            className={star <= given ? 'text-orange-1' : 'text-gray-200 hover:text-orange-1'}
                          />
                        </button>
                      ))}
                      {given > 0 && (
                        <span className="text-xs font-semibold text-green-600 ml-2">
                          {t('classement.rated')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Classement;
