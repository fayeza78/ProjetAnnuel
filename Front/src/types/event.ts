export type FilterType = 'all' | 'recommended' | 'upcoming' | 'past';

export type EventType = {
  id: number;
  title: string;
  category: string;
  description: string;
  longDescription: string;
  date: string;
  hour: string;
  location: string;
  /** Nombre d'habitants ayant confirmé leur participation (réservé leur place) */
  participants: number;
  points: number;
  status: string;
  recommended: boolean;
  organizer: string;
  duration: string;
  level: string;
  isRegistered?: boolean;
  isPast?: boolean;
  /** Statut de participation choisi par l'utilisateur */
  participationStatus?: 'interested' | 'confirmed' | 'declined';
  /** Date ISO brute renvoyée par l'API (pour les filtres À venir / Passés) */
  rawDate?: string | null;
  /** Centres d'intérêt (tags MongoDB) de l'événement */
  interests: string[];
};
