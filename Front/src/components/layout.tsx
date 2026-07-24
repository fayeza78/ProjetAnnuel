import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './header';
import { SideBar } from './sidebar';

export const Layout = () => {
  // menu latéral, en overlay sur mobile
  const [menuOpen, setMenuOpen] = useState(false);

  // bloque le scroll du fond quand le menu est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  return (
    // pas de débordement horizontal
    <div className="min-h-screen w-full flex overflow-x-hidden bg-gradient-to-r from-[#DEE1E9] from-[17.77%] via-[#8AC6C7]/60 via-[61.06%] to-[#D2D4D6] to-[75.33%]">
      <SideBar open={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* fond sombre derrière le menu */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* min-w-0 pour éviter le débordement */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen min-w-0">
        <Header onOpenMenu={() => setMenuOpen(true)} />

        <main className="flex-1 flex flex-col p-4 md:p-8 bg-transparent">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
