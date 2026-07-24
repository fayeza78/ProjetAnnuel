import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authApi, tokenStore, type Me, type LoginResult } from '../api';
import { connectSocket, disconnectSocket } from '../api/socket';

interface AuthContextValue {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string, code?: string) => Promise<LoginResult>;
  register: (payload: {
    email: string;
    password: string;
    adresse: string;
    ville: string;
    cp: string;
    nom_quartier: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Durée de vie maximale d'une session : 3 heures, puis déconnexion automatique.
const SESSION_MAX_MS = 3 * 60 * 60 * 1000;
const SESSION_START_KEY = 'cn_session_start';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Déconnexion immédiate (locale) + redirection — utilisée à l'expiration des 3h.
  const forceLogout = () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    localStorage.removeItem(SESSION_START_KEY);
    disconnectSocket();
    tokenStore.clear();
    setUser(null);
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  };

  // Programme la déconnexion auto au bout du temps restant sur la session courante.
  const scheduleAutoLogout = () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    const startRaw = localStorage.getItem(SESSION_START_KEY);
    const start = startRaw ? parseInt(startRaw, 10) : NaN;
    if (Number.isNaN(start)) return;

    const remaining = start + SESSION_MAX_MS - Date.now();
    if (remaining <= 0) {
      forceLogout();
      return;
    }
    logoutTimer.current = setTimeout(forceLogout, remaining);
  };

  const refreshMe = async () => {
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  };

  // Au montage : si un token existe, on vérifie l'âge de la session puis on récupère le profil.
  useEffect(() => {
    (async () => {
      if (tokenStore.getAccess()) {
        const startRaw = localStorage.getItem(SESSION_START_KEY);
        // Pas d'horodatage (ancienne session) → on en pose un maintenant.
        if (!startRaw) localStorage.setItem(SESSION_START_KEY, String(Date.now()));

        const start = parseInt(localStorage.getItem(SESSION_START_KEY)!, 10);
        if (Date.now() - start >= SESSION_MAX_MS) {
          forceLogout();
          setLoading(false);
          return;
        }
        await refreshMe();
        scheduleAutoLogout();
      }
      setLoading(false);
    })();
    return () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, []);

  // garde la socket ouverte quand on est connecté (présence en ligne)
  useEffect(() => {
    if (user) connectSocket();
    else disconnectSocket();
  }, [user?.id_user]);

  const login = async (email: string, password: string, code?: string): Promise<LoginResult> => {
    const res = await authApi.login(email, password, code);
    if ('access_token' in res) {
      // Nouvelle session : on (re)démarre le compteur de 3h.
      localStorage.setItem(SESSION_START_KEY, String(Date.now()));
      await refreshMe();
      scheduleAutoLogout();
    }
    return res;
  };

  const register = async (payload: {
    email: string;
    password: string;
    adresse: string;
    ville: string;
    cp: string;
    nom_quartier: string;
  }) => {
    await authApi.register(payload);
    await login(payload.email, payload.password);
  };

  const logout = async () => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    localStorage.removeItem(SESSION_START_KEY);
    disconnectSocket();
    await authApi.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
