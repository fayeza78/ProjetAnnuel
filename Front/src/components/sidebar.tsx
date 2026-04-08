import type { ElementType } from 'react';
import {
  HouseDoor,
  Map,
  CalendarEvent,
  Envelope,
  BarChart,
  Trophy,
  Briefcase,
} from 'react-bootstrap-icons';
import LogoImage from '../assets/logo_projet_sans_nom.png';
import type { Pages } from '../App';

const nav_element: { name: string; id: Pages; Icon: ElementType }[] = [
  { name: 'Accueil', Icon: HouseDoor, id: 'accueil' },
  { name: 'Carte', Icon: Map, id: 'carte' },
  { name: 'Services & Contrats', Icon: Briefcase, id: 'services' },
  { name: 'Évènements', Icon: CalendarEvent, id: 'evenements' },
  { name: 'Messagerie', Icon: Envelope, id: 'messagerie' },
  { name: 'Votes', Icon: BarChart, id: 'votes' },
  { name: 'Classement', Icon: Trophy, id: 'classement' },
];

interface SideBarProps {
  actualPage: Pages;
  setPage: (page: Pages) => void;
}

export const SideBar = ({ actualPage, setPage }: SideBarProps) => {
  return (
    <div className="bg-blue-1 text-blue-2 w-50 h-screen flex flex-col p-4 fixed  border-white">
      <div className="mb-3 px-2 flex justify-center">
        <div className="rounded-2xl flex items-center justify-center ">
          <img
            src={LogoImage}
            alt="Logo application"
            className="w-full h-full"
          />
        </div>
      </div>
      <nav className="flex-1 space-y-2">
        {nav_element.map((lien) => (
          <button
            key={lien.id}
            onClick={() => setPage(lien.id)}
            className={`
              w-full flex flex-col items-center justify-center py-2 rounded-xl text-[14px] cursor-pointer transition-colors
              ${
                actualPage === lien.id
                  ? 'bg-white/20 text-white shadow-lg border border-white/20'
                  : 'text-emerald-50/70 hover:bg-white/10 hover:text-white border border-transparent'
              } 
            `}
          >
            {lien.Icon && (
              <div className="mb-2">
                <lien.Icon size={24} />
              </div>
            )}
            <span>{lien.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
