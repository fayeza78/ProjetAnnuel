import type { ElementType } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  HouseDoor,
  Map,
  CalendarEvent,
  Envelope,
  BarChart,
  Trophy,
  Briefcase,
  ShieldLock,
  ExclamationTriangleFill,
} from 'react-bootstrap-icons';
import LogoImage from '../assets/logo_projet_sans_nom.png';
import { useAuth } from '../context/AuthContext';

const nav_element: { key: string; path: string; Icon: ElementType }[] = [
  { key: 'nav.home', Icon: HouseDoor, path: '/' },
  { key: 'nav.map', Icon: Map, path: '/carte' },
  { key: 'nav.services', Icon: Briefcase, path: '/services' },
  { key: 'nav.events', Icon: CalendarEvent, path: '/evenements' },
  { key: 'nav.messages', Icon: Envelope, path: '/messagerie' },
  { key: 'nav.votes', Icon: BarChart, path: '/votes' },
  { key: 'nav.leaderboard', Icon: Trophy, path: '/classement' },
  { key: 'nav.incidents', Icon: ExclamationTriangleFill, path: '/incidents' },
];

export const SideBar = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  // onglet admin seulement pour les admins
  const links = user?.role === 'admin'
    ? [...nav_element, { key: 'nav.admin', Icon: ShieldLock, path: '/admin' }]
    : nav_element;

  return (
    // caché sur mobile, toujours visible sur desktop
    <div
      className={`bg-blue-1 text-blue-2 w-60 h-screen flex flex-col p-4 fixed z-40 border-r border-white/20 transition-transform duration-200 md:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="mb-3 px-2 flex justify-center">
        <img
          src={LogoImage}
          alt="Logo application"
          className="max-w-40 h-auto"
        />
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto">
        {links.map((lien) => (
          <NavLink
            key={lien.path}
            to={lien.path}
            onClick={onClose}
            className={({ isActive }) =>
              `w-full flex flex-col items-center justify-center py-2 rounded-xl text-[14px] cursor-pointer transition-colors ${
                isActive
                  ? 'bg-white/20 text-white shadow-lg border border-white/20'
                  : 'text-emerald-50/70 hover:bg-white/10 hover:text-white border border-transparent'
              }`
            }
          >
            <div className="mb-2">
              <lien.Icon size={24} />
            </div>
            <span>{t(lien.key)}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};
