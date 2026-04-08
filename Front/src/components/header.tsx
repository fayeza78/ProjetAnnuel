import { PersonCircle, Gear } from 'react-bootstrap-icons';

export const Header = () => {
  return (
    <div className="h-20 w-full flex items-center p-14">
      <div className="flex-1 flex justify-center px-4">
        <div className="relative w-full max-w-xl">
          <input
            type="text"
            placeholder="Rechercher"
            className="w-full bg-white h-12 rounded-2xl px-6 text-gray-700"
          />
        </div>
      </div>

      <div className="w-1/4 flex items-center justify-end gap-6">
        <button className="text-blue-1 hover:text-blue-2">
          <Gear size={22} />
        </button>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-blue-1 font-bold text-[14px]">Meriam K</p>
            <p className="text-blue-2 font-medium text-[14px]">ESGI</p>
          </div>
          <div className="w-12 h-12 rounded-full border-2 border-orange-1 flex items-center justify-center">
            <PersonCircle size={32} className="text-orange-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
