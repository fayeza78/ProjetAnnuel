import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, ApiError, type Signalement } from '../../api';

const STATUT_STYLE: Record<string, string> = {
  ouvert: 'bg-orange-100 text-orange-1',
  traite: 'bg-green-100 text-green-700',
  rejete: 'bg-gray-100 text-gray-500',
};

export default function AdminSignalements() {
  const { t } = useTranslation();
  const STATUT_LABELS: Record<string, string> = {
    ouvert: t('admin.statutOuvert'),
    traite: t('admin.statutTraite'),
    rejete: t('admin.statutRejete'),
  };
  const [items, setItems] = useState<Signalement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const idOf = (s: Signalement) => s.id_signalement ?? s.id ?? 0;

  const load = async () => {
    try {
      setItems(await adminApi.signalements());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.loadError'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const traiter = async (s: Signalement, statut: 'traite' | 'rejete') => {
    setError(null);
    try {
      await adminApi.traiterSignalement(idOf(s), statut);
      setItems((prev) => prev.map((x) => (idOf(x) === idOf(s) ? { ...x, statut } : x)));
      setNotice(t('admin.signalementUpdated'));
      setTimeout(() => setNotice(null), 2500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">{t('admin.signalementsTitle', { count: items.length })}</h2>

      {notice && <p className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-xl mb-3">{notice}</p>}
      {error && <p className="bg-orange-100 text-orange-1 font-semibold px-4 py-2 rounded-xl mb-3">{error}</p>}

      {items.length === 0 && <p className="text-gray-400 py-6 text-center">{t('admin.noSignalement')}</p>}

      <div className="space-y-3">
        {items.map((s) => (
          <div key={idOf(s)} className="border rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-blue-50 text-blue-1 px-3 py-1 rounded-full text-sm font-bold">
                  {s.cible_type} #{s.cible_id}
                </span>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${STATUT_STYLE[s.statut ?? 'ouvert'] ?? ''}`}>
                  {STATUT_LABELS[s.statut ?? 'ouvert'] ?? s.statut}
                </span>
              </div>
              <p className="text-gray-600 truncate">{s.motif || t('admin.noMotif')}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => traiter(s, 'traite')}
                className="bg-green-600 text-white px-4 py-2 rounded-full font-bold text-sm hover:opacity-90"
              >
                {t('admin.treatButton')}
              </button>
              <button
                onClick={() => traiter(s, 'rejete')}
                className="bg-gray-200 text-gray-600 px-4 py-2 rounded-full font-bold text-sm hover:bg-gray-300"
              >
                {t('admin.rejectButton')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
