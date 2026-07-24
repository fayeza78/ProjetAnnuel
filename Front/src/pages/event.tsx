import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import EventHeader from '../components/events/eventHeader';
import EventFilters from '../components/events/eventFilters';
import EventCard from '../components/events/eventCards';
import EventModal from '../components/events/eventModal';
import type { EventType, FilterType } from '../types/event';
import {
  eventApi,
  recommendationApi,
  ApiError,
  type Evenement,
  type EvenementDetail,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { dateLocale } from '../i18n/config';
import { CATALOGUE_INTERETS } from '../interest';

function isPastEvent(event: EventType): boolean {
  if (!event.rawDate) return false;

  const eventDate = new Date(event.rawDate);
  const today = new Date();
  eventDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  return eventDate < today;
}

function mapEvent(
  e: Evenement,
  detail: EvenementDetail | null,
  recommendedIds: Set<string>,
  currentUserId: string | null,
  t: TFunction,
): EventType {
  const d = e.date_ ? new Date(e.date_) : null;
  const rawDate = e.date_ ?? null;
  const participants = detail?.participants ?? [];
  const mine = currentUserId
    ? participants.find((p) => p.inhabitant_postgres_id === currentUserId)
    : undefined;

  return {
    id: e.id_evenement,
    title: e.titre,
    category: e.type ?? t('event.categoryFallback'),
    description: detail?.description ?? '',
    longDescription: detail?.description ?? '',
    interests: detail?.tags ?? [],
    date: d
      ? d.toLocaleDateString(dateLocale(), {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : t('event.dateFallback'),
    hour: detail?.heure ?? '',
    location: detail?.lieu ?? '',
    // Nombre d'habitants ayant réellement réservé leur place (statut confirmé).
    participants: participants.filter((p) => p.status === 'confirmed').length,
    points: detail?.points ?? 0,
    status: e.statut ?? 'actif',
    recommended: recommendedIds.has(String(e.id_evenement)),
    organizer: e.user?.email ?? '',
    duration: detail?.duree ?? '',
    level: detail?.ageRecommande ?? '',
    isRegistered: mine ? mine.status !== 'declined' : false,
    participationStatus: mine?.status,
    isPast: rawDate
      ? new Date(rawDate) < new Date(new Date().setHours(0, 0, 0, 0))
      : false,
    rawDate,
  };
}

function Event() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const currentUserId = user ? String(user.id_user) : null;
  const [selectedEvent, setSelectedEvent] = useState<EventType | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitre, setNewTitre] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newInterests, setNewInterests] = useState<string[]>([]);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [newLieu, setNewLieu] = useState('');
  const [newHeure, setNewHeure] = useState('');
  const [newDuree, setNewDuree] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newPoints, setNewPoints] = useState('0');
  const [creating, setCreating] = useState(false);

  const toggleNewInterest = (i: string) =>
    setNewInterests((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i],
    );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, reco] = await Promise.all([
        eventApi.list(),
        recommendationApi
          .evenements()
          .catch(() => ({ evenements: [] as string[] })),
      ]);
      const recommendedIds = new Set(reco.evenements ?? []);
      // on charge le détail de chaque événement (participants, tags...)
      const details = await Promise.all(
        list.map((e) =>
          eventApi
            .get(e.id_evenement)
            .then((r) => r.detail)
            .catch(() => null),
        ),
      );
      setEvents(
        list.map((e, i) =>
          mapEvent(e, details[i], recommendedIds, currentUserId, t),
        ),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('event.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  const handleCreateEvent = async (ev: FormEvent) => {
    ev.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await eventApi.create({
        titre: newTitre,
        date_: newDate || undefined,
        description: newDescription || undefined,
        interests: newInterests.length > 0 ? newInterests : undefined,
        lieu: newLieu || undefined,
        heure: newHeure || undefined,
        duree: newDuree || undefined,
        ageRecommande: newAge || undefined,
        points: newPoints ? Number(newPoints) : undefined,
      });
      setShowCreateForm(false);
      setNewTitre('');
      setNewDate('');
      setNewDescription('');
      setNewInterests([]);
      setInterestsOpen(false);
      setNewLieu('');
      setNewHeure('');
      setNewDuree('');
      setNewAge('');
      setNewPoints('0');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('event.createError'),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleParticipate = async (
    event: EventType,
    status: 'interested' | 'confirmed' | 'declined',
  ) => {
    if (isPastEvent(event)) {
      setError(t('event.pastEventError'));
      return;
    }

    try {
      setError(null);

      await eventApi.participer(event.id, status);

      // Seul le statut "confirmé" compte comme une place réellement réservée.
      const wasConfirmed = event.participationStatus === 'confirmed';
      const nowConfirmed = status === 'confirmed';
      const delta = wasConfirmed === nowConfirmed ? 0 : nowConfirmed ? 1 : -1;
      const nowRegistered = status !== 'declined';

      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                isRegistered: nowRegistered,
                participationStatus: status,
                participants: e.participants + delta,
              }
            : e,
        ),
      );

      setSelectedEvent((prev) =>
        prev && prev.id === event.id
          ? {
              ...prev,
              isRegistered: nowRegistered,
              participationStatus: status,
              participants: prev.participants + delta,
            }
          : prev,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('event.participateError'),
      );
    }
  };

  // on n'affiche que les événements pas encore passés
  const evenementsValables = useMemo(
    () => events.filter((e) => !e.isPast),
    [events],
  );

  const filteredEvents = useMemo(() => {
    // Filtre "anciens" : on montre au contraire les événements passés.
    if (activeFilter === 'past') return events.filter((e) => e.isPast);
    return evenementsValables.filter((event) =>
      activeFilter === 'recommended' ? event.recommended : true,
    );
  }, [events, evenementsValables, activeFilter]);

  const totalParticipants = evenementsValables.reduce(
    (t, e) => t + e.participants,
    0,
  );
  const publishedEvents = evenementsValables.filter(
    (e) => e.status !== 'annule',
  ).length;

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <EventHeader
          eventsCount={evenementsValables.length}
          publishedEvents={publishedEvents}
          totalParticipants={totalParticipants}
        />

        <EventFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          showCreateForm={showCreateForm}
          onToggleCreateForm={() => setShowCreateForm((v) => !v)}
        />

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}

        {showCreateForm && (
          <form
            onSubmit={handleCreateEvent}
            className="bg-white rounded-2xl shadow-lg p-6 mb-8 flex flex-wrap gap-4 items-end"
          >
            <div>
              <label className="block font-bold mb-1">
                {t('event.createTitleLabel')}
              </label>
              <input
                value={newTitre}
                onChange={(e) => setNewTitre(e.target.value)}
                required
                maxLength={50}
                className="border rounded-xl p-3"
                placeholder={t('event.createTitlePlaceholder')}
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createDateLabel')}
              </label>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="border rounded-xl p-3"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createHeureLabel')}
              </label>
              <input
                type="time"
                value={newHeure}
                onChange={(e) => setNewHeure(e.target.value)}
                className="border rounded-xl p-3"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createLieuLabel')}
              </label>
              <input
                value={newLieu}
                onChange={(e) => setNewLieu(e.target.value)}
                maxLength={200}
                className="border rounded-xl p-3"
                placeholder={t('event.createLieuPlaceholder')}
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createDureeLabel')}
              </label>
              <input
                value={newDuree}
                onChange={(e) => setNewDuree(e.target.value)}
                maxLength={50}
                className="border rounded-xl p-3"
                placeholder={t('event.createDureePlaceholder')}
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createAgeLabel')}
              </label>
              <input
                value={newAge}
                onChange={(e) => setNewAge(e.target.value)}
                maxLength={30}
                className="border rounded-xl p-3"
                placeholder={t('event.createAgePlaceholder')}
              />
            </div>
            <div>
              <label className="block font-bold mb-1">
                {t('event.createPointsLabel')}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={newPoints}
                onChange={(e) => setNewPoints(e.target.value)}
                className="border rounded-xl p-3 w-28"
              />
            </div>
            <div className="relative">
              <label className="block font-bold mb-1">
                {t('event.createInterestsLabel')}
              </label>
              <button
                type="button"
                onClick={() => setInterestsOpen((o) => !o)}
                className="border rounded-xl p-3 min-w-[220px] text-left"
              >
                {newInterests.length > 0
                  ? t('event.interestsSelected', { nb: newInterests.length })
                  : t('event.interestsPlaceholder')}
              </button>
              {interestsOpen && (
                <div className="absolute z-20 mt-1 w-64 max-h-60 overflow-y-auto bg-white border rounded-xl shadow-lg p-3">
                  {CATALOGUE_INTERETS.map((i) => (
                    <label
                      key={i}
                      className="flex items-center gap-2 py-1 cursor-pointer capitalize"
                    >
                      <input
                        type="checkbox"
                        checked={newInterests.includes(i)}
                        onChange={() => toggleNewInterest(i)}
                      />
                      {i}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full">
              <label className="block font-bold mb-1">
                {t('event.createDescriptionLabel')}
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                className="border rounded-xl p-3 w-full"
                placeholder={t('event.createDescriptionPlaceholder')}
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newTitre.trim()}
              className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
            >
              {creating ? t('event.creating') : t('event.createSubmitButton')}
            </button>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {loading && (
            <div className="col-span-full bg-white p-10 rounded-2xl shadow-lg text-center">
              <p className="text-xl font-bold text-gray-700">{t('event.loading')}</p>
            </div>
          )}

          {!loading && filteredEvents.length === 0 && (
            <div className="col-span-full bg-white p-10 rounded-2xl shadow-lg text-center">
              <p className="text-xl font-bold text-gray-700">
                {t('event.empty')}
              </p>
            </div>
          )}

          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onView={setSelectedEvent}
              onParticipate={handleParticipate}
            />
          ))}
        </div>
      </div>

      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onParticipate={handleParticipate}
        />
      )}
    </div>
  );
}

export default Event;
