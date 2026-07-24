import { useTranslation } from 'react-i18next';
import type { FilterType } from '../../types/event';

type EventFiltersProps = {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  showCreateForm: boolean;
  onToggleCreateForm: () => void;
};

// "Tous" = à venir, "Anciens" = passés
const FILTERS: { key: FilterType; labelKey: string }[] = [
  { key: 'all', labelKey: 'event.filterAll' },
  { key: 'recommended', labelKey: 'event.filterRecommended' },
  { key: 'past', labelKey: 'event.filterPast' },
];

function EventFilters({
  activeFilter,
  onFilterChange,
  showCreateForm,
  onToggleCreateForm,
}: EventFiltersProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
      <div className="flex flex-wrap gap-3">
        {FILTERS.map((filter) => (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={`px-6 py-3 rounded-full font-bold border-2 border-blue-1 transition-colors ${
              activeFilter === filter.key
                ? 'bg-blue-1 text-white'
                : 'bg-white text-black hover:bg-gray-50'
            }`}
          >
            {t(filter.labelKey)}
          </button>
        ))}
      </div>

      <button
        onClick={onToggleCreateForm}
        className="bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity"
      >
        {showCreateForm ? t('common.cancel') : t('event.createButton')}
      </button>
    </div>
  );
}

export default EventFilters;
