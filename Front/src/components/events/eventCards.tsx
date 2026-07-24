import { useTranslation } from 'react-i18next';
import type { EventType } from '../../types/event';

type ParticipationStatus = 'interested' | 'confirmed' | 'declined';

type EventCardProps = {
  event: EventType;
  onView: (event: EventType) => void;
  onParticipate?: (event: EventType, status: ParticipationStatus) => void;
};

function EventCard({ event, onView, onParticipate }: EventCardProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-5">
      <div className="flex justify-between items-start gap-4">
        <span className="w-fit bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
          {event.category}
        </span>

        {event.recommended && (
          <span className="w-fit bg-blue-1 text-white px-4 py-2 rounded-full text-sm font-bold">
            {t('event.recommended')}
          </span>
        )}
      </div>

      <h2 className="text-2xl font-bold leading-tight min-h-[64px]">
        {event.title}
      </h2>

      <p className="text-gray-600 min-h-[72px]">{event.description}</p>

      {event.interests.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {event.interests.map((i) => (
            <span
              key={i}
              className="bg-blue-50 text-blue-1 text-xs font-semibold px-3 py-1 rounded-full capitalize"
            >
              {i}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-2 text-sm">
        <p>
          <strong>{event.date}</strong>
          {event.hour && <span className="ml-2 text-gray-600">{event.hour}</span>}
        </p>
        {event.location && (
          <p>
            <strong>{t('event.infoLieu')} :</strong> {event.location}
          </p>
        )}
        {event.duration && (
          <p>
            <strong>{t('event.infoDuree')} :</strong> {event.duration}
          </p>
        )}
        {event.level && (
          <p>
            <strong>{t('event.infoAge')} :</strong> {event.level}
          </p>
        )}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-lg font-medium">{t('event.infoPoints')}</span>
        <span className="text-2xl font-bold text-blue-1">
          +{event.points} pts
        </span>
      </div>

      <div className="flex justify-between items-center">
        <span className="text-lg font-medium">{t('event.infoStatus')}</span>
        <span className="font-bold text-orange-1">{event.status}</span>
      </div>

      <div className="border-t pt-5 flex justify-between items-center">
        <span className="text-sm font-bold">{t('event.infoParticipants')}</span>
        <span className="text-lg font-bold text-blue-1">
          {event.participants}
        </span>
      </div>

      <div className="flex gap-4 mt-auto">
        <button
          onClick={() => onView(event)}
          className="flex-1 bg-blue-1 text-white py-3 rounded-full font-bold hover:opacity-90"
        >
          {t('event.view')}
        </button>
      </div>

      {event.isPast ? (
        <p className="text-center text-sm font-bold text-gray-500">
          {t('event.pastEvent')}
        </p>
      ) : (
        <div className="flex gap-2">
          <StatusButton
            label={t('event.statusInterested')}
            active={event.participationStatus === 'interested'}
            onClick={() => onParticipate?.(event, 'interested')}
          />
          <StatusButton
            label={t('event.statusConfirmed')}
            active={event.participationStatus === 'confirmed'}
            onClick={() => onParticipate?.(event, 'confirmed')}
          />
          <StatusButton
            label={t('event.statusDeclined')}
            active={event.participationStatus === 'declined'}
            onClick={() => onParticipate?.(event, 'declined')}
          />
        </div>
      )}
    </div>
  );
}

function StatusButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 rounded-full text-sm font-bold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-blue-1 border-blue-1 text-white'
          : 'border-blue-1 text-blue-1 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

export default EventCard;
