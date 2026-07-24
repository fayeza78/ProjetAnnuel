import { List, PersonCircle } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export const Header = ({ onOpenMenu }: { onOpenMenu: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();

  const displayName = user?.email ? user.email.split('@')[0] : t('common.user');
  const quartier =
    typeof user?.quartier === 'string'
      ? user.quartier
      : user?.quartier?.nom_quartier ?? user?.ville ?? '';

  return (
    <div className="h-20 w-full flex items-center px-4 md:px-14">
      {/* Bouton menu : visible seulement sur mobile (la sidebar est cachée) */}
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Menu"
        className="md:hidden text-blue-1 mr-3"
      >
        <List size={30} />
      </button>

      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full max-w-xl" />
      </div>

      <div className="flex items-center justify-end gap-6">
        <div
          onClick={() => navigate('/profil')}
          className="flex items-center gap-3 cursor-pointer"
        >
          <div className="text-right">
            <p className="text-blue-1 font-bold text-[14px]">{displayName}</p>
            <p className="text-blue-2 font-medium text-[14px]">{quartier}</p>
          </div>

          <div className="w-12 h-12 rounded-full border-2 border-orange-1 flex items-center justify-center hover:bg-orange-50 transition">
            <PersonCircle size={32} className="text-orange-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
