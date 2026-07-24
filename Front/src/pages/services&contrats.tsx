import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  serviceApi,
  contratApi,
  ApiError,
  type ServiceDetail,
  type Contrat,
  type ContratAuditEntry,
  type EffectueDemande,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { dateLocale } from '../i18n/config';
import SignatureModal from '../components/services/SignatureModal';

type PriceFilter = 'tous' | 'gratuits' | 'payants';
type Tab = 'services' | 'contrats';

interface ContratWithService extends Contrat {
  id_service: number;
  serviceLabel: string;
  serviceStatut: string;
}

interface SigningModal {
  open: boolean;
  contratId: string;
  pdfUrl: string;
}

interface HistoryModal {
  open: boolean;
  entries: ContratAuditEntry[];
}

const STATUT_COLORS: Record<Contrat['status'], string> = {
  pending: 'bg-orange-1',
  partially_signed: 'bg-yellow-500',
  signed: 'bg-green-600',
  archived: 'bg-gray-600',
};

const ACTION_KEYS: Record<string, string> = {
  created: 'contrats.actionCreated',
  signed: 'contrats.actionSigned',
  archived: 'contrats.actionArchived',
};

const PRICE_FILTER_KEYS: Record<PriceFilter, string> = {
  tous: 'services.filterAll',
  gratuits: 'services.filterFree',
  payants: 'services.filterPaid',
};

function ServiceContrats() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const STATUT_LABELS: Record<Contrat['status'], string> = {
    pending: t('contrats.statusPending'),
    partially_signed: t('contrats.statusPartiallySigned'),
    signed: t('contrats.statusSigned'),
    archived: t('contrats.statusArchived'),
  };
  const myId = user ? String(user.id_user) : '';

  const [tab, setTab] = useState<Tab>('services');
  const [services, setServices] = useState<ServiceDetail[]>([]);
  const [contrats, setContrats] = useState<ContratWithService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<PriceFilter>('tous');
  const [showForm, setShowForm] = useState(false);
  const [signingModal, setSigningModal] = useState<SigningModal>({
    open: false,
    contratId: '',
    pdfUrl: '',
  });
  const [showArchived, setShowArchived] = useState(false);
  const [historyModal, setHistoryModal] = useState<HistoryModal>({
    open: false,
    entries: [],
  });
  const [editingServiceId, setEditingServiceId] = useState<number | null>(null);

  // Formulaire de création/édition
  const [type, setType] = useState('offre');
  const [categorie, setCategorie] = useState('');
  const [prix, setPrix] = useState('0');

  // Terminaison de service
  const [showTerminateModal, setShowTerminateModal] = useState<number | null>(
    null,
  );
  const [selectedDemandeur, setSelectedDemandeur] = useState<number | null>(
    null,
  );
  const [demandes, setDemandes] = useState<EffectueDemande[] | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await serviceApi.list();

      // la liste ne charge pas les relations, on récupère chaque fiche complète
      const details = await Promise.all(
        list.map((s) => serviceApi.get(s.id_service).catch(() => null)),
      );
      const svc = details.filter((d): d is ServiceDetail => d !== null);
      setServices(svc);

      // pas de liste des contrats côté API, on les trouve via chaque service
      const full = await Promise.all(
        svc
          .filter((s) => s.contrat)
          .map((s) =>
            contratApi
              .get(s.contrat!.id_contrat)
              .then(
                (c): ContratWithService => ({
                  ...c,
                  id_service: s.id_service,
                  serviceLabel: s.categorie ?? s.type,
                  serviceStatut: s.statut,
                }),
              )
              .catch(() => null),
          ),
      );
      setContrats(full.filter((c): c is ContratWithService => c !== null));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('services.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    try {
      if (editingServiceId) {
        // Le type n'est pas modifiable après création (non accepté par l'API).
        await serviceApi.update(editingServiceId, {
          categorie: categorie || undefined,
          prix: Number(prix) || 0,
        });
        setNotice(t('services.serviceUpdated'));
        setEditingServiceId(null);
      } else {
        await serviceApi.create({
          type,
          categorie: categorie || undefined,
          prix: Number(prix) || 0,
        });
        setNotice(t('services.serviceCreated'));
      }
      setShowForm(false);
      setCategorie('');
      setPrix('0');
      setType('offre');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('services.createError'));
    }
  };

  const handleDemander = async (id: number) => {
    setError(null);
    setNotice(null);
    try {
      await serviceApi.demander(id);
      setNotice(t('services.requestSent'));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('services.requestError'),
      );
    }
  };

  const handleAnnulerDemande = async (id: number) => {
    setError(null);
    setNotice(null);
    try {
      await serviceApi.annulerDemande(id);
      setNotice(t('services.requestWithdrawn'));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('services.withdrawError'),
      );
    }
  };

  const handleDelete = async (id: number) => {
    setError(null);
    setNotice(null);
    try {
      await serviceApi.delete(id);
      setNotice(t('services.serviceDeleted'));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('services.deleteError'),
      );
    }
  };

  const handleTerminate = async () => {
    if (!showTerminateModal || !selectedDemandeur) return;
    setError(null);
    setNotice(null);
    try {
      await serviceApi.terminer(showTerminateModal, selectedDemandeur);
      setNotice(t('services.serviceFinished'));
      setShowTerminateModal(null);
      setSelectedDemandeur(null);
      setDemandes(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('services.finishError'),
      );
    }
  };

  // ouvre le modal de signature
  const handleSignerClick = (contratId: string, pdfUrl: string) => {
    setSigningModal({ open: true, contratId, pdfUrl });
  };

  // Telecharge le PDF : on passe par un blob pour forcer l'enregistrement du fichier.
  const handleDownloadPdf = async (pdfUrl: string) => {
    try {
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = pdfUrl.split('/').pop() ?? 'contrat.pdf';
      lien.click();
      URL.revokeObjectURL(lien.href);
    } catch {
      setError(t('contrats.downloadError'));
    }
  };

  // signe le contrat avec le tracé renvoyé par le modal
  const handleSign = async (contratId: string, dataUrl: string) => {
    setError(null);
    setNotice(null);
    try {
      await contratApi.signer(contratId, dataUrl);
      setNotice(t('contrats.contratSigned'));
      setSigningModal({ open: false, contratId: '', pdfUrl: '' });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('contrats.signError'));
    }
  };

  const handleArchiver = async (id: string) => {
    if (!confirm(t('contrats.archiveConfirm'))) return;
    setError(null);
    setNotice(null);
    try {
      await contratApi.archiver(id);
      setNotice(t('contrats.contratArchived'));
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('contrats.archiveError'),
      );
    }
  };

  const handleShowHistory = async (contratId: string) => {
    setError(null);
    try {
      const { auditTrail } = await contratApi.audit(contratId);
      setHistoryModal({ open: true, entries: auditTrail });
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('contrats.historyError'),
      );
    }
  };

  const handleOpenTerminateModal = async (serviceId: number) => {
    try {
      const demandesData = await serviceApi.getDemandes(serviceId);
      setDemandes(demandesData);
      setShowTerminateModal(serviceId);
      setSelectedDemandeur(
        demandesData.length > 0 ? demandesData[0].id_user : null,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('services.getDemandesError'),
      );
    }
  };

  const handleEditService = (service: ServiceDetail) => {
    setType(service.type);
    setCategorie(service.categorie || '');
    setPrix(String(service.prix ?? 0));
    setEditingServiceId(service.id_service);
    setShowForm(true);
  };

  const visible = services.filter((s) => {
    // un service termine par son prestataire sort de la liste, l'echange a eu lieu
    if (s.statut === 'termine') return false;
    const p = s.prix ?? 0;
    if (filter === 'gratuits') return p === 0;
    if (filter === 'payants') return p > 0;
    return true;
  });

  const servicesPayants = visible.filter((s) => (s.prix ?? 0) > 0).length;
  const contratsSignes = contrats.filter(
    (c) => c.status === 'signed' || c.status === 'archived',
  ).length;

  // un contrat signé et terminé (ou archivé) est masqué par défaut
  const contratClos = (c: ContratWithService) =>
    c.status === 'archived' ||
    (c.status === 'signed' && c.serviceStatut === 'termine');

  const contratsVisibles = showArchived
    ? contrats
    : contrats.filter((c) => !contratClos(c));

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">
            {t('services.title')}
          </h1>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <Stat value={visible.length} label={t('services.statServices')} />
            <Stat value={servicesPayants} label={t('services.statPaid')} />
            <Stat value={contratsSignes} label={t('services.statSigned')} />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setTab('services')}
            className={`px-6 py-3 rounded-full font-bold transition-colors ${
              tab === 'services'
                ? 'bg-blue-1 text-white'
                : 'bg-white text-black border-2 border-blue-1 hover:bg-gray-50'
            }`}
          >
            {t('services.tabServices')}
          </button>
          <button
            onClick={() => setTab('contrats')}
            className={`px-6 py-3 rounded-full font-bold transition-colors ${
              tab === 'contrats'
                ? 'bg-blue-1 text-white'
                : 'bg-white text-black border-2 border-blue-1 hover:bg-gray-50'
            }`}
          >
            {t('services.tabContrats')}
          </button>
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

        {/* SERVICES TAB */}
        {tab === 'services' && (
          <>
            {/* Explication offre vs demande */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-6 text-sm text-gray-700 space-y-1">
              <p>
                <span className="font-bold text-blue-1">{t('services.typeOffer')}</span> — {t('services.offerExplain')}
              </p>
              <p>
                <span className="font-bold text-orange-1">{t('services.typeRequest')}</span> — {t('services.requestExplain')}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
              <div className="flex flex-wrap gap-3">
                {(['tous', 'gratuits', 'payants'] as PriceFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-6 py-3 rounded-full font-bold capitalize transition-colors ${
                      filter === f
                        ? 'bg-blue-1 text-white'
                        : 'bg-white text-black border-2 border-blue-1 hover:bg-gray-50'
                    }`}
                  >
                    {t(PRICE_FILTER_KEYS[f])}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setEditingServiceId(null);
                  setType('offre');
                  setCategorie('');
                  setPrix('0');
                  setShowForm((v) => !v);
                }}
                className="bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity"
              >
                {showForm ? t('services.cancelButton') : t('services.createButton')}
              </button>
            </div>

            {showForm && (
              <form
                onSubmit={handleCreate}
                className="bg-white rounded-2xl shadow-lg p-6 mb-8 flex flex-wrap gap-4 items-end"
              >
                <div>
                  <label className="block font-bold mb-1">{t('services.typeLabel')}</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    disabled={!!editingServiceId}
                    className="border rounded-xl p-3 disabled:opacity-50"
                  >
                    <option value="offre">{t('services.typeOffer')}</option>
                    <option value="demande">{t('services.typeRequest')}</option>
                  </select>
                  {editingServiceId && (
                    <p className="text-xs text-gray-500 mt-1">
                      {t('services.typeNotEditable')}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block font-bold mb-1">{t('services.categoryLabel')}</label>
                  <input
                    value={categorie}
                    onChange={(e) => setCategorie(e.target.value)}
                    className="border rounded-xl p-3"
                    placeholder={t('services.categoryPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{t('services.priceLabel')}</label>
                  <input
                    type="number"
                    min={0}
                    value={prix}
                    onChange={(e) => setPrix(e.target.value)}
                    className="border rounded-xl p-3 w-28"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
                >
                  {editingServiceId ? t('services.editButton') : t('services.createSubmitButton')}
                </button>
              </form>
            )}

            {loading && (
              <p className="font-semibold text-gray-600">{t('services.loading')}</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
              {!loading && visible.length === 0 && (
                <div className="col-span-full bg-white p-10 rounded-2xl shadow-lg text-center">
                  <p className="text-xl font-bold text-gray-700">
                    {t('services.empty')}
                  </p>
                </div>
              )}

              {visible.map((service) => {
                const isOwner = user?.id_user === service.prestataire?.id_user;
                const isRequested = !!user
                  ? (service.effectueDemandes ?? []).some(
                      (d) => d.id_user === user.id_user,
                    )
                  : false;
                const isTermine = service.statut === 'termine';
                const hasContrat = !!service.contrat;
                const isContratSigne =
                  service.contrat?.statut === 'signed' ||
                  service.contrat?.statut === 'archived';

                return (
                  <div
                    key={service.id_service}
                    className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-5"
                  >
                    <span className="w-fit bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
                      {service.categorie ?? service.type}
                    </span>

                    <h2 className="text-2xl font-bold min-h-[48px] capitalize">
                      {service.type}{' '}
                      {service.categorie ? `· ${service.categorie}` : ''}
                    </h2>

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">{t('services.price')}</span>
                      <span className="text-2xl font-bold text-blue-1">
                        {(service.prix ?? 0) === 0
                          ? t('services.free')
                          : `${service.prix} pts`}
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium">{t('services.status')}</span>
                      <span className="font-bold text-orange-1">
                        {service.statut}
                      </span>
                    </div>

                    <div className="flex gap-2 mt-auto flex-wrap">
                      {!isOwner ? (
                        <>
                          <button
                            onClick={() => handleDemander(service.id_service)}
                            disabled={isRequested || isTermine}
                            className="flex-1 bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90 disabled:bg-green-600 disabled:opacity-100 disabled:cursor-default"
                          >
                            {isRequested ? t('services.requested') : t('services.requestButton')}
                          </button>
                          {isRequested && !isTermine && (
                            <button
                              onClick={() =>
                                handleAnnulerDemande(service.id_service)
                              }
                              className="flex-1 bg-red-500 text-white py-3 rounded-full font-bold hover:opacity-90"
                            >
                              {t('services.withdrawRequestButton')}
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {(!isContratSigne || !hasContrat) && (
                            <div className="w-full flex gap-2">
                              {!isContratSigne && (
                                <button
                                  onClick={() => handleEditService(service)}
                                  className="flex-1 bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90"
                                >
                                  {t('services.editButton')}
                                </button>
                              )}
                              {!hasContrat && (
                                <button
                                  onClick={() => handleDelete(service.id_service)}
                                  className="flex-1 bg-red-500 text-white py-3 rounded-full font-bold hover:opacity-90"
                                >
                                  {t('services.deleteButton')}
                                </button>
                              )}
                            </div>
                          )}
                          {hasContrat && (
                            <p className="w-full text-xs text-gray-400 text-center -mt-3">
                              {isContratSigne
                                ? t('services.editLockedSigned')
                                : t('services.deleteLockedContrat')}
                            </p>
                          )}
                          {!isTermine && (
                            <button
                              onClick={() =>
                                handleOpenTerminateModal(service.id_service)
                              }
                              className="flex-1 bg-green-600 text-white py-3 rounded-full font-bold hover:opacity-90"
                            >
                              {t('services.finishButton')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* CONTRATS TAB */}
        {tab === 'contrats' && (
          <>
            {loading && (
              <p className="font-semibold text-gray-600">{t('services.loading')}</p>
            )}

            <label className="flex items-center gap-2 mb-6 font-semibold text-gray-700">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="w-4 h-4"
              />
              {t('contrats.showArchived')}
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {!loading && contratsVisibles.length === 0 && (
                <div className="col-span-full bg-white p-10 rounded-2xl shadow-lg text-center">
                  <p className="text-xl font-bold text-gray-700">
                    {contrats.length === 0
                      ? t('contrats.empty')
                      : t('contrats.emptyActive')}
                  </p>
                </div>
              )}

              {contratsVisibles.map((contrat) => {
                const alreadySignedByMe = (contrat.signatures ?? []).some(
                  (s) => s.user_postgres_id === myId,
                );
                const canSign =
                  !alreadySignedByMe &&
                  (contrat.status === 'pending' ||
                    contrat.status === 'partially_signed');

                return (
                  <div
                    key={contrat.postgres_id}
                    className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-5"
                  >
                    <div className="flex justify-between items-start">
                      <span
                        className={`px-4 py-2 rounded-full font-semibold text-white ${STATUT_COLORS[contrat.status]}`}
                      >
                        {STATUT_LABELS[contrat.status]}
                      </span>
                      <span className="text-sm text-gray-500">
                        #{contrat.postgres_id.slice(0, 8)}
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold">
                      {t('contrats.contratLabel', {
                        service: contrat.serviceLabel,
                        id: contrat.id_service,
                      })}
                    </h2>

                    {alreadySignedByMe && contrat.status === 'partially_signed' && (
                      <p className="text-sm font-semibold text-gray-500">
                        {t('contrats.signedWaiting')}
                      </p>
                    )}

                    <div className="flex gap-2 mt-auto flex-wrap">
                      {contrat.pdfUrl && (
                        <a
                          href={contrat.pdfUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90 text-center"
                        >
                          {t('contrats.showPdf')}
                        </a>
                      )}

                      {canSign && (
                        <button
                          onClick={() =>
                            handleSignerClick(contrat.postgres_id, contrat.pdfUrl)
                          }
                          className="flex-1 bg-green-600 text-white py-3 rounded-full font-bold hover:opacity-90"
                        >
                          {t('contrats.signButton')}
                        </button>
                      )}

                      {/* Telechargement possible une fois le contrat signe */}
                      {contrat.pdfUrl &&
                        (contrat.status === 'signed' ||
                          contrat.status === 'archived') && (
                          <button
                            onClick={() => handleDownloadPdf(contrat.pdfUrl)}
                            className="flex-1 bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90"
                          >
                            {t('contrats.downloadButton')}
                          </button>
                        )}

                      <button
                        onClick={() => handleShowHistory(contrat.postgres_id)}
                        className="flex-1 bg-blue-2 text-white py-3 rounded-full font-bold hover:opacity-90"
                      >
                        {t('contrats.historyButton')}
                      </button>

                      {contrat.status === 'signed' && (
                        <button
                          onClick={() => handleArchiver(contrat.postgres_id)}
                          className="flex-1 bg-gray-600 text-white py-3 rounded-full font-bold hover:opacity-90"
                        >
                          {t('contrats.archiveButton')}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Modal de terminaison de service */}
      {showTerminateModal && demandes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold mb-4">{t('services.finishModalTitle')}</h3>

            <div className="mb-6">
              <label className="block font-bold mb-2">
                {t('services.chooseRequester')}
              </label>
              <select
                value={selectedDemandeur || ''}
                onChange={(e) => setSelectedDemandeur(Number(e.target.value))}
                className="w-full border rounded-xl p-3"
              >
                <option value="">{t('services.selectRequesterPlaceholder')}</option>
                {demandes.map((d) => (
                  <option key={d.id_user} value={d.id_user}>
                    {d.user?.email ?? t('services.userFallback', { id: d.id_user })}
                  </option>
                ))}
              </select>
              {demandes.length === 0 && (
                <p className="text-sm text-gray-500 mt-2">
                  {t('services.noRequests')}
                </p>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowTerminateModal(null);
                  setSelectedDemandeur(null);
                  setDemandes(null);
                }}
                className="flex-1 bg-gray-300 text-black py-3 rounded-full font-bold hover:opacity-90"
              >
                {t('services.cancelButton')}
              </button>
              <button
                onClick={handleTerminate}
                disabled={!selectedDemandeur}
                className="flex-1 bg-green-600 text-white py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {t('services.confirmFinish')}
              </button>
            </div>
          </div>
        </div>
      )}

      {signingModal.open && (
        <SignatureModal
          pdfUrl={signingModal.pdfUrl}
          onClose={() =>
            setSigningModal({ open: false, contratId: '', pdfUrl: '' })
          }
          onSign={(dataUrl) => handleSign(signingModal.contratId, dataUrl)}
        />
      )}

      {/* Modal d'historique (audit trail) */}
      {historyModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">{t('contrats.historyModalTitle')}</h3>

            {historyModal.entries.length === 0 ? (
              <p className="text-gray-500">{t('contrats.noHistoryEvent')}</p>
            ) : (
              <ul className="flex flex-col gap-3 mb-6">
                {historyModal.entries.map((entry, i) => (
                  <li key={i} className="border-l-4 border-blue-1 pl-4">
                    <p className="font-bold">
                      {ACTION_KEYS[entry.action] ? t(ACTION_KEYS[entry.action]) : entry.action}
                    </p>
                    <p className="text-sm text-gray-600">{entry.details}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(entry.timestamp).toLocaleString(dateLocale())}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={() => setHistoryModal({ open: false, entries: [] })}
              className="w-full bg-gray-300 text-black py-3 rounded-full font-bold hover:opacity-90"
            >
              {t('contrats.closeButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Petit compteur affiche dans l'en-tete de la page.
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

export default ServiceContrats;
