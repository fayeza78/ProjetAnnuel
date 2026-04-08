import { useState } from 'react';
import { Layout } from './components/layout';
import Home from './pages/home';
import Map from './pages/map';
import Vote from './pages/vote';
import ServiceContrats from './pages/services&contrats';
import Event from './pages/event';
import Classement from './pages/classement';
import Messagerie from './pages/messagerie';

export type Pages =
  | 'accueil'
  | 'carte'
  | 'services'
  | 'evenements'
  | 'messagerie'
  | 'votes'
  | 'classement';

export const App = () => {
  const [actualPage, setPage] = useState<Pages>('accueil');

  const renderPage = () => {
    switch (actualPage) {
      case 'accueil':
        return <Home />;
      case 'carte':
        return <Map />;
      case 'services':
        return <ServiceContrats />;
      case 'evenements':
        return <Event />;
      case 'messagerie':
        return <Messagerie />;
      case 'votes':
        return <Vote />;
      case 'classement':
        return <Classement />;
    }
  };

  return (
    <Layout actualPage={actualPage} setPage={setPage}>
      {renderPage()}
    </Layout>
  );
};
