import { useTranslation } from 'react-i18next';

type EventHeaderProps = {
  eventsCount: number;
  publishedEvents: number;
  totalParticipants: number;
};

function EventHeader({
  eventsCount,
  publishedEvents,
  totalParticipants,
}: EventHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
      <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('event.title')}</h1>

      <div className="flex flex-wrap gap-6 md:gap-8">
        <Stat value={eventsCount} label={t('event.statEvents')} />
        <Stat value={publishedEvents} label={t('event.statPublished')} />
        <Stat value={totalParticipants} label={t('event.statParticipants')} />
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

export default EventHeader;
