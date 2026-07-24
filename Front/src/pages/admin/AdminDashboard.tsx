import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  adminApi,
  ApiError,
  type IncidentsStats,
  type ParticipationsStats,
} from '../../api';

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [incidents, setIncidents] = useState<IncidentsStats | null>(null);
  const [participations, setParticipations] = useState<ParticipationsStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // télécharge l'archive du client Java
  const handleDownloadJava = async () => {
    setDownloadError(null);
    setDownloading(true);
    try {
      const blob = await adminApi.telechargerAppJava();
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = 'PetitsSecretsVoisins.zip';
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : t('admin.javaDownloadError'));
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [i, p] = await Promise.all([
          adminApi.statsIncidents(),
          adminApi.statsParticipations(),
        ]);
        setIncidents(i);
        setParticipations(p);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('admin.loadError'));
      }
    })();
  }, [t]);

  return (
    <div className="space-y-6">
      {error && <p className="bg-orange-100 text-orange-1 font-semibold px-5 py-3 rounded-xl">{error}</p>}

      {/* Téléchargement du client Java de bureau (admin) */}
      <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">{t('admin.javaTitle')}</h3>
          <p className="text-gray-500 text-sm">{t('admin.javaHint')}</p>
          {downloadError && <p className="text-orange-1 font-medium mt-1">{downloadError}</p>}
        </div>
        <button
          onClick={handleDownloadJava}
          disabled={downloading}
          className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          {downloading ? t('admin.javaDownloading') : t('admin.javaDownloadBtn')}
        </button>
      </div>

      {/* Cartes résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        <BigStat value={incidents?.total} label={t('admin.statIncidents')} color="text-orange-1" />
        <BigStat value={participations?.totalEvenements} label={t('admin.statEvents')} color="text-blue-1" />
        <BigStat value={participations?.participations.confirmed} label={t('admin.statConfirmedParticipations')} color="text-green-600" />
        <BigStat value={participations?.participations.interested} label={t('admin.statInterested')} color="text-purple-600" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Incidents par statut */}
        <Card title={t('admin.incidentsByStatus')}>
          <BarList data={incidents?.parStatut} color="bg-orange-1" noDataLabel={t('admin.noData')} />
        </Card>
        {/* Incidents par gravité */}
        <Card title={t('admin.incidentsBySeverity')}>
          <BarList data={incidents?.parGravite} color="bg-red-500" noDataLabel={t('admin.noData')} />
        </Card>
        {/* Incidents par type */}
        <Card title={t('admin.incidentsByType')}>
          <BarList data={incidents?.parType} color="bg-blue-1" noDataLabel={t('admin.noData')} />
        </Card>
        {/* Participations */}
        <Card title={t('admin.eventParticipations')}>
          <BarList
            data={
              participations
                ? {
                    [t('admin.confirmed')]: participations.participations.confirmed,
                    [t('admin.interested')]: participations.participations.interested,
                    [t('admin.declined')]: participations.participations.declined,
                  }
                : undefined
            }
            color="bg-green-500"
            noDataLabel={t('admin.noData')}
          />
        </Card>
      </div>
    </div>
  );
}

function BigStat({ value, label, color }: { value?: number; label: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
      <span className={`block text-4xl font-bold ${color}`}>{value ?? '…'}</span>
      <span className="text-sm font-medium text-gray-500">{label}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function BarList({
  data,
  color,
  noDataLabel,
}: {
  data?: Record<string, number>;
  color: string;
  noDataLabel: string;
}) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-gray-400">{noDataLabel}</p>;
  }
  const max = Math.max(...Object.values(data), 1);
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([label, value]) => (
        <div key={label}>
          <div className="flex justify-between text-sm font-semibold mb-1">
            <span className="capitalize">{label}</span>
            <span>{value}</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
