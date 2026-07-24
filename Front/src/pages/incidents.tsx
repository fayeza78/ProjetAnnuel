import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ExclamationTriangleFill } from 'react-bootstrap-icons';
import { incidentApi, signalementApi, ApiError, type Incident, type Signalement } from '../api';
import { dateLocale } from '../i18n/config';

type Gravite = '' | 'faible' | 'moyenne' | 'haute' | 'critique';
type CibleType = 'message' | 'service' | 'evenement' | 'user';
type RecentItem = Incident | Signalement;

const isSignalement = (item: RecentItem): item is Signalement => 'cible_type' in item;

function Incidents() {
  const { t } = useTranslation();
  const [type, setType] = useState<'incident' | 'signalement'>('incident');

  // Champs incident (POST /incidents)
  const [description, setDescription] = useState('');
  const [gravite, setGravite] = useState<Gravite>('');

  // Champs signalement (POST /signalements) — ressource distincte côté API
  const [cibleType, setCibleType] = useState<CibleType>('message');
  const [cibleId, setCibleId] = useState('');
  const [motif, setMotif] = useState('');

  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentItem[]>([]);

  const GRAVITE_LABELS: Record<string, string> = {
    faible: t('incidents.graviteFaible'),
    moyenne: t('incidents.graviteMoyenne'),
    haute: t('incidents.graviteHaute'),
    critique: t('incidents.graviteCritique'),
  };

  const CIBLE_TYPE_LABELS: Record<CibleType, string> = {
    message: t('incidents.cibleTypeMessage'),
    service: t('incidents.cibleTypeService'),
    evenement: t('incidents.cibleTypeEvenement'),
    user: t('incidents.cibleTypeUser'),
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (type === 'incident') {
      if (!description.trim()) {
        setError(t('incidents.descriptionRequired'));
        return;
      }

      setCreating(true);
      try {
        const created = await incidentApi.create({
          description: description.trim(),
          type: 'incident',
          ...(gravite ? { gravite } : {}),
        });
        setRecent((prev) => [created, ...prev]);
        setDescription('');
        setGravite('');
        setNotice(t('incidents.createSuccess'));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('incidents.createError'));
      } finally {
        setCreating(false);
      }
      return;
    }

    if (!cibleId.trim()) {
      setError(t('incidents.cibleIdRequired'));
      return;
    }

    setCreating(true);
    try {
      const created = await signalementApi.create({
        cible_type: cibleType,
        cible_id: cibleId.trim(),
        ...(motif.trim() ? { motif: motif.trim() } : {}),
      });
      setRecent((prev) => [created, ...prev]);
      setCibleId('');
      setMotif('');
      setNotice(t('incidents.signalementCreateSuccess'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('incidents.signalementCreateError'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex items-center gap-4 px-5 md:px-10 py-6">
          <ExclamationTriangleFill size={36} className="text-orange-1 shrink-0" />
          <div>
            <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('incidents.title')}</h1>
            <p className="text-gray-500 mt-1">{t('incidents.subtitle')}</p>
          </div>
        </div>

        {notice && (
          <p className="bg-green-100 text-green-700 font-semibold mb-4 px-5 py-3 rounded-xl">
            {notice}
          </p>
        )}
        {error && (
          <p className="bg-orange-100 text-orange-1 font-semibold mb-4 px-5 py-3 rounded-xl">
            {error}
          </p>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg p-6 mb-8 flex flex-col gap-4"
        >
          <div>
            <label className="block font-bold mb-1">{t('incidents.typeLabel')}</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'incident' | 'signalement')}
              className="border rounded-xl p-3"
            >
              <option value="incident">{t('incidents.typeIncident')}</option>
              <option value="signalement">{t('incidents.typeSignalement')}</option>
            </select>
          </div>

          {type === 'incident' ? (
            <>
              <div>
                <label className="block font-bold mb-1">{t('incidents.descriptionLabel')}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  maxLength={1000}
                  className="w-full border rounded-xl p-3"
                  placeholder={t('incidents.descriptionPlaceholder')}
                />
              </div>

              <div>
                <label className="block font-bold mb-1">{t('incidents.graviteLabel')}</label>
                <select
                  value={gravite}
                  onChange={(e) => setGravite(e.target.value as Gravite)}
                  className="border rounded-xl p-3"
                >
                  <option value="">{t('incidents.graviteNone')}</option>
                  <option value="faible">{t('incidents.graviteFaible')}</option>
                  <option value="moyenne">{t('incidents.graviteMoyenne')}</option>
                  <option value="haute">{t('incidents.graviteHaute')}</option>
                  <option value="critique">{t('incidents.graviteCritique')}</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block font-bold mb-1">{t('incidents.cibleTypeLabel')}</label>
                  <select
                    value={cibleType}
                    onChange={(e) => setCibleType(e.target.value as CibleType)}
                    className="border rounded-xl p-3"
                  >
                    <option value="message">{t('incidents.cibleTypeMessage')}</option>
                    <option value="service">{t('incidents.cibleTypeService')}</option>
                    <option value="evenement">{t('incidents.cibleTypeEvenement')}</option>
                    <option value="user">{t('incidents.cibleTypeUser')}</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[10rem]">
                  <label className="block font-bold mb-1">{t('incidents.cibleIdLabel')}</label>
                  <input
                    type="text"
                    value={cibleId}
                    onChange={(e) => setCibleId(e.target.value)}
                    required
                    maxLength={100}
                    className="w-full border rounded-xl p-3"
                    placeholder={t('incidents.cibleIdPlaceholder')}
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">{t('incidents.motifLabel')}</label>
                <textarea
                  value={motif}
                  onChange={(e) => setMotif(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  className="w-full border rounded-xl p-3"
                  placeholder={t('incidents.motifPlaceholder')}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={creating || (type === 'incident' ? !description.trim() : !cibleId.trim())}
            className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed self-start"
          >
            {creating
              ? t('incidents.submitting')
              : type === 'incident'
                ? t('incidents.submitButton')
                : t('incidents.signalementSubmitButton')}
          </button>
        </form>

        {recent.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold mb-1">{t('incidents.recentTitle')}</h2>
            <p className="text-sm text-gray-500 mb-4">{t('incidents.recentHint')}</p>
            <div className="flex flex-col gap-3">
              {recent.map((item) =>
                isSignalement(item) ? (
                  <div
                    key={`signalement-${item.id_signalement ?? item.id}`}
                    className="border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {CIBLE_TYPE_LABELS[item.cible_type as CibleType] ?? item.cible_type} #{item.cible_id}
                      </p>
                      {item.motif && <p className="text-sm text-gray-500 truncate">{item.motif}</p>}
                      {item.createdAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleString(dateLocale())}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold">
                        {t('incidents.statusOuvert')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div
                    key={`incident-${item.id_incident}`}
                    className="border rounded-xl p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{item.description}</p>
                      {item.createdAt && (
                        <p className="text-xs text-gray-400">
                          {new Date(item.createdAt).toLocaleString(dateLocale())}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {item.gravite && (
                        <span className="bg-orange-100 text-orange-1 px-3 py-1 rounded-full text-sm font-bold">
                          {GRAVITE_LABELS[item.gravite] ?? item.gravite}
                        </span>
                      )}
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-sm font-bold">
                        {t('incidents.statusOuvert')}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Incidents;
