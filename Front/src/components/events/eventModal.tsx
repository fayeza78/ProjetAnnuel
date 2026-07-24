import { useTranslation } from 'react-i18next';
import type { EventType } from '../../types/event';

type ParticipationStatus = 'interested' | 'confirmed' | 'declined';

type EventModalProps = {
  event: EventType;
  onClose: () => void;
  onParticipate: (event: EventType, status: ParticipationStatus) => void;
};

function EventModal({ event, onClose, onParticipate }: EventModalProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-3xl font-bold hover:text-orange-1"
        >
          ×
        </button>

        <div className="mb-6">
          <span className="bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
            {event.category}
          </span>
        </div>

        <h2 className="text-3xl font-bold text-blue-1 mb-4">{event.title}</h2>

        <p className="text-gray-700 mb-6 leading-relaxed">
          {event.longDescription || event.description}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Info label={t('event.infoDate')} value={event.date} />
          <Info label={t('event.infoHour')} value={event.hour || t('event.hourUnspecified')} />
          <Info label={t('event.infoLocation')} value={event.location || t('event.locationUnspecified')} />
          <Info label={t('event.infoDuration')} value={event.duration || t('event.durationUnspecified')} />
          <Info label={t('event.infoOrganizer')} value={event.organizer || t('event.organizerUnspecified')} />
          <Info label={t('event.infoLevel')} value={event.level || t('event.allLevels')} />
        </div>

        <div className="flex justify-between items-center border-t pt-5">
          <Info
            label={t('event.infoParticipants')}
            value={String(event.participants)}
          />
          <Info label={t('event.infoReward')} value={`+${event.points} pts`} />
          <Info label={t('event.infoStatus')} value={event.status} />
        </div>

        {event.isPast ? (
          <p className="text-center text-sm font-bold text-gray-500 mt-8">
            {t('event.pastEvent')}
          </p>
        ) : (
          <div className="flex gap-3 mt-8">
            <ModalStatusButton
              label={t('event.statusInterested')}
              active={event.participationStatus === 'interested'}
              onClick={() => onParticipate(event, 'interested')}
            />
            <ModalStatusButton
              label={t('event.statusConfirmed')}
              active={event.participationStatus === 'confirmed'}
              onClick={() => onParticipate(event, 'confirmed')}
            />
            <ModalStatusButton
              label={t('event.statusDeclined')}
              active={event.participationStatus === 'declined'}
              onClick={() => onParticipate(event, 'declined')}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ModalStatusButton({
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
      className={`flex-1 py-3 rounded-full font-bold border-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
        active
          ? 'bg-blue-1 border-blue-1 text-white'
          : 'border-blue-1 text-blue-1 hover:bg-gray-50'
      }`}
    >
      {label}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 p-4 rounded-xl">
      <p className="font-bold">{label}</p>
      <p>{value}</p>
    </div>
  );
}

export default EventModal;
