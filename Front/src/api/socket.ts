// Connexion Socket.io vers l'API : sert la présence en ligne et le chat temps réel.
import { io, type Socket } from 'socket.io-client';
import { tokenStore } from './client';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

// Si VITE_API_URL est une URL absolue on s'y connecte, sinon on reste sur la même
// origine (Apache et le proxy Vite renvoient /socket.io vers l'API).
const URL_SOCKET = BASE.startsWith('http') ? BASE : null;

let socket: Socket | null = null;

// Ouvre la socket avec le JWT : l'API compte alors l'utilisateur comme en ligne.
export function connectSocket(): Socket | null {
  const token = tokenStore.getAccess();
  if (!token) return null;
  if (socket) return socket;
  socket = URL_SOCKET
    ? io(URL_SOCKET, { auth: { token } })
    : io({ auth: { token } });
  return socket;
}

// Ferme la socket : l'API repasse l'utilisateur hors ligne.
export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

// Renvoie la socket courante, ou null si aucune connexion n'est ouverte.
export function getSocket(): Socket | null {
  return socket;
}
