import React from 'react';
import { Header } from './header';
import { SideBar } from './sidebar';
import type { Pages } from '../App';

interface LayoutProps {
  children: React.ReactNode;
  actualPage: Pages;
  setPage: (page: Pages) => void;
}

export const Layout = ({ children, actualPage, setPage }: LayoutProps) => {
  return (
    <div className="min-h-screen w-full flex bg-gradient-to-r from-[#DEE1E9] from-[17.77%] via-[#8AC6C7]/60 via-[61.06%] to-[#D2D4D6] to-[75.33%] bg-fixed">
      <SideBar actualPage={actualPage} setPage={setPage} />
      <div className="flex-1 ml-60 flex flex-col">
        <Header />
        <main className="flex-1 p-8 bg-transparent">{children}</main>
      </div>
    </div>
  );
};
