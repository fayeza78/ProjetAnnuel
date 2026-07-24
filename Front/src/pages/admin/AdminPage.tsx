import { useState } from 'react';
import {
  Speedometer2,
  People,
  GeoAlt,
  Flag,
  BarChartLine,
  Terminal,
  ShieldLock,
} from 'react-bootstrap-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import AdminDashboard from './AdminDashboard';
import AdminUsers from './AdminUsers';
import AdminQuartiers from './AdminQuartiers';
import AdminSignalements from './AdminSignalements';
import AdminVotes from './AdminVotes';
import AdminQuery from './AdminQuery';

type TabKey = 'dashboard' | 'users' | 'quartiers' | 'signalements' | 'votes' | 'query';

const TABS: { key: TabKey; labelKey: string; Icon: typeof People }[] = [
  { key: 'dashboard', labelKey: 'admin.tabDashboard', Icon: Speedometer2 },
  { key: 'users', labelKey: 'admin.tabUsers', Icon: People },
  { key: 'quartiers', labelKey: 'admin.tabQuartiers', Icon: GeoAlt },
  { key: 'signalements', labelKey: 'admin.tabSignalements', Icon: Flag },
  { key: 'votes', labelKey: 'admin.tabVotes', Icon: BarChartLine },
  { key: 'query', labelKey: 'admin.tabQuery', Icon: Terminal },
];

export default function AdminPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>('dashboard');

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        {/* En-tête */}
        <div className="shadow-lg w-full bg-white rounded-2xl mb-6 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <div className="flex items-center gap-4">
            <ShieldLock size={36} className="text-orange-1 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('admin.title')}</h1>
              <p className="text-blue-2 font-medium truncate">{t('admin.connectedAs', { email: user?.email })}</p>
            </div>
          </div>
          <span className="bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-bold uppercase text-sm self-start md:self-auto">
            {user?.role}
          </span>
        </div>

        {/* Navbar horizontale */}
        <div className="bg-white rounded-2xl shadow-lg p-2 mb-6 flex flex-wrap gap-2">
          {TABS.map(({ key, labelKey, Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition ${
                tab === key
                  ? 'bg-blue-1 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Icon size={18} />
              {t(labelKey)}
            </button>
          ))}
        </div>

        {/* Contenu de l'onglet */}
        <div>
          {tab === 'dashboard' && <AdminDashboard />}
          {tab === 'users' && <AdminUsers />}
          {tab === 'quartiers' && <AdminQuartiers />}
          {tab === 'signalements' && <AdminSignalements />}
          {tab === 'votes' && <AdminVotes />}
          {tab === 'query' && <AdminQuery />}
        </div>
      </div>
    </div>
  );
}
