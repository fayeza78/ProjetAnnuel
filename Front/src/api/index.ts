// ─────────────────────────────────────────────────────────────────────────────
// Couche API : types + fonctions par domaine (toutes basées sur le client HTTP).
// Côté utilisateur uniquement (pas d'endpoints admin : stats, sync, query...).
// ─────────────────────────────────────────────────────────────────────────────
import { http, tokenStore, downloadBlob } from './client';

export { ApiError, tokenStore } from './client';

// ── Types ────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id_user: number;
  email: string;
  role: 'user' | 'moderateur' | 'admin';
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: AuthUser;
}

export type LoginResult = AuthResponse | { mfa_required: true };

export interface Me {
  id_user: number;
  email: string;
  role: string;
  adresse?: string;
  ville?: string;
  cp?: string;
  mfa_enabled?: boolean;
  vote_blocked?: boolean;
  quartier?: { nom_quartier: string } | string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Neighbour {
  id_user: number;
  email: string;
  ville: string | null;
  quartier: string | null;
}

export interface QuartierStats {
  inhabitants_count: number;
  events_count: number;
  services_count: number;
  active_votes: number;
}

export interface Quartier {
  id_quartier: number;
  nom_quartier: string;
  limite_geo?: string;
  description?: string | null;
  stats?: QuartierStats | null;
}

export interface Service {
  id_service: number;
  type: string; // "offre" | "demande"
  categorie?: string;
  date_?: string;
  prix?: number;
  statut: string;
}

// Référence Postgres embarquée dans ServiceDetail.contrat (GET /services/:id) —
// juste de quoi retrouver le contrat complet via contratApi.get(id_contrat).
export interface ContratRef {
  id_contrat: string;
  lienpdf: string;
  statut: string;
  createdAt?: string;
  updatedAt?: string;
}

// GET /services/:id renvoie bien plus que la liste (GET /services, sans relations) :
// le prestataire, les demandes reçues et la référence du contrat, si il y en a un.
export interface ServiceDetail extends Service {
  prestataire?: { id_user: number; email: string } | null;
  contrat?: ContratRef | null;
  effectueDemandes?: { id_user: number; id_service: number }[];
  detail?: unknown;
}

export interface Evenement {
  id_evenement: number;
  titre: string;
  date_?: string;
  type?: string;
  statut?: string;
  user?: { id_user: number; email: string };
}

export interface EvenementParticipant {
  inhabitant_postgres_id: string;
  firstName: string;
  status: 'interested' | 'confirmed' | 'declined';
  joinedAt: string;
}

// Détail MongoDB associé à l'événement (GET /evenements/:id) — participants,
// tags, photos, commentaires : tout ce que la liste Postgres n'expose pas.
export interface EvenementDetail {
  postgres_id: string;
  title_event: string;
  description?: string;
  photos?: string[];
  tags?: string[];
  lieu?: string;
  heure?: string;
  duree?: string;
  ageRecommande?: string;
  points?: number;
  participants?: EvenementParticipant[];
  comments?: {
    inhabitant_postgres_id: string;
    firstName: string;
    content: string;
    createdAt: string;
  }[];
}

export interface VoteOption {
  id: string;
  label: string;
  votesCount: number;
}

export interface Vote {
  postgres_id: string;
  question: string;
  description?: string;
  type: 'single' | 'multiple' | 'yesno';
  options: VoteOption[];
  votes?: { user_postgres_id: string; optionIds: string[] }[];
  deadline?: string | null;
  status?: string;
  createdBy_postgres_id?: string;
}

// Forme réelle de GET /contrats/:id (document MongoDB — pas l'entité Postgres,
// qui ne stocke que id_contrat/lienpdf/statut).
export interface ContratSignature {
  user_postgres_id: string;
  signatureImage: string;
  signedAt: string;
  ipAddress: string;
  checksum: string;
}

export interface ContratAuditEntry {
  action: string;
  user_postgres_id: string;
  timestamp: string;
  details: string;
}

export interface Contrat {
  postgres_id: string; // = id_contrat
  pdfUrl: string;
  status: 'pending' | 'partially_signed' | 'signed' | 'archived';
  signatures?: ContratSignature[];
  auditTrail?: ContratAuditEntry[];
  signatureZones?: {
    assignedTo_postgres_id: string;
    type: 'signature' | 'initials';
    label: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}

// GET /services/:id/demandes renvoie un tableau brut de demandes (pas un objet
// { demandeurs: [...] }), chacune avec l'utilisateur demandeur en relation.
export interface EffectueDemande {
  id_user: number;
  id_service: number;
  user?: { id_user: number; email: string };
  createdAt?: string;
}

export interface ConversationItem {
  conversation: {
    postgres_id: string;
    participants_postgres_ids: string[];
    type: string;
    title?: string | null;
    lastMessageAt?: string | null;
  };
  lastMessage: Message | null;
}

export interface MediaAttachment {
  type: 'photo' | 'voice' | 'video';
  url: string;
  size: number;
  mimeType: string;
  duration?: number;
}

export interface Message {
  postgres_id: string;
  conversationId: string;
  sender_postgres_id: string;
  recipient_postgres_ids?: string[];
  content?: string;
  mediaAttachments?: MediaAttachment[];
  createdAt?: string;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  async register(payload: {
    email: string;
    password: string;
    adresse: string;
    ville: string;
    cp: string;
    nom_quartier: string;
  }) {
    return http.post<{ id_user: number; email: string; role: string }>(
      '/auth/register',
      payload,
    );
  },

  async login(
    email: string,
    password: string,
    code?: string,
  ): Promise<LoginResult> {
    const body: Record<string, string> = { email, password };
    if (code) body.code = code;
    const res = await http.post<LoginResult>('/auth/login', body);
    if ('access_token' in res) {
      tokenStore.set(res.access_token, res.refresh_token);
    }
    return res;
  },

  async logout() {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await http.post('/auth/logout', { refresh_token: refresh });
    } finally {
      tokenStore.clear();
    }
  },

  // Mot de passe oublié : demande un code de réinitialisation (route publique).
  // reset_token n'est renvoyé qu'en mode démo (EXPOSE_RESET_TOKEN=true côté API),
  // sinon il part par e-mail.
  forgotPassword(email: string) {
    return http.post<{ message: string; reset_token?: string; expires_in?: number }>(
      '/auth/forgot-password',
      { email },
    );
  },

  // Réinitialise le mot de passe à partir du code reçu.
  resetPassword(token: string, new_password: string) {
    return http.post<{ message: string }>('/auth/reset-password', {
      token,
      new_password,
    });
  },

  me() {
    return http.get<Me>('/auth/me');
  },

  mfaSetup() {
    return http.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup');
  },

  mfaVerify(code: string) {
    return http.post<{ message: string }>('/auth/mfa/verify', { code });
  },

  mfaDisable() {
    return http.post<{ message: string }>('/auth/mfa/disable');
  },

  // SSO : génère un ticket à usage unique (valable 120 s) pour connecter le
  // client Java sans ressaisir le mot de passe.
  ssoTicket() {
    return http.post<{ sso_ticket: string; expires_in: number }>(
      '/auth/sso/ticket',
    );
  },

  // Changements d'infos sensibles — un code MFA est requis si la 2FA est activée
  // (l'API répond alors 401 avec { mfa_required: true }).
  changePassword(current_password: string, new_password: string, code?: string) {
    const body: Record<string, string> = { current_password, new_password };
    if (code) body.code = code;
    return http.post<{ message: string }>('/auth/change-password', body);
  },

  changeEmail(password: string, new_email: string, code?: string) {
    const body: Record<string, string> = { password, new_email };
    if (code) body.code = code;
    return http.post<{ message: string }>('/auth/change-email', body);
  },

  changePhone(password: string, telephone: string, code?: string) {
    const body: Record<string, string> = { password, telephone };
    if (code) body.code = code;
    return http.post<{ message: string }>('/auth/change-phone', body);
  },
};

// ── Annuaire des voisins (pour démarrer une conversation) ─────────────────────
export const neighbourApi = {
  list: () => http.get<Neighbour[]>('/neighbours'),
};

// ── Administration / Back-office (admin & modérateur) ─────────────────────────
export interface AdminUser {
  id_user: number;
  email: string;
  role: 'user' | 'moderateur' | 'admin';
  ville?: string | null;
  quartier?: { nom_quartier: string } | string | null;
  vote_blocked?: boolean;
  createdAt?: string;
}

export interface Signalement {
  id_signalement?: number;
  id?: number;
  cible_type: string;
  cible_id: string;
  motif?: string;
  statut?: string;
  createdAt?: string;
}

export interface IncidentsStats {
  total: number;
  parStatut: Record<string, number>;
  parGravite: Record<string, number>;
  parType: Record<string, number>;
}

export interface ParticipationsStats {
  totalEvenements: number;
  participations: { interested: number; confirmed: number; declined: number };
  parUtilisateur: Record<string, number>;
}

export const adminApi = {
  // Utilisateurs
  users: () => http.get<AdminUser[]>('/users'),
  setRole: (id: number, role: string) =>
    http.put<{ id_user: number; email: string; role: string }>(
      `/users/${id}/role`,
      { role },
    ),
  deleteUser: (id: number) => http.del(`/users/${id}`),
  setVoteBlock: (id: number, blocked: boolean) =>
    http.put<{ id_user: number; email: string; vote_blocked: boolean }>(
      `/users/${id}/vote-block`,
      { blocked },
    ),

  // Signalements
  signalements: () => http.get<Signalement[]>('/signalements'),
  traiterSignalement: (id: number, statut: 'ouvert' | 'traite' | 'rejete') =>
    http.put<Signalement>(`/signalements/${id}/traiter`, { statut }),

  // Statistiques
  statsIncidents: () => http.get<IncidentsStats>('/stats/incidents'),
  statsParticipations: () =>
    http.get<ParticipationsStats>('/stats/participations'),

  // Quartiers (modélisation géographique)
  createQuartier: (data: { nom_quartier: string; limite_geo?: string }) =>
    http.post<Quartier>('/quartiers', data),
  updateQuartier: (
    id: number,
    data: { nom_quartier?: string; limite_geo?: string },
  ) => http.put<Quartier>(`/quartiers/${id}`, data),
  deleteQuartier: (id: number) => http.del(`/quartiers/${id}`),

  // Langage de requête MongoDB maison
  runQuery: (query: string) => http.post<unknown>('/query', { query }),

  // télécharge l'archive du client Java (admin)
  telechargerAppJava: () => downloadBlob('/admin/telecharger-app-java'),
};

// Alias rétro-compatible
export const moderationApi = {
  setVoteBlock: adminApi.setVoteBlock,
};

// ── Users ────────────────────────────────────────────────────────────────────
export const userApi = {
  get: (id: number) => http.get<Me>(`/users/${id}`),
  update: (
    id: number,
    data: Partial<Pick<Me, 'adresse' | 'ville' | 'cp'>> & {
      telephone?: string;
      langue?: string;
    },
  ) => http.put<Me>(`/users/${id}`, data),
  points: () => http.get<{ points: number }>('/me/points'),
  // note un voisin (1 à 5)
  noter: (id: number, rating: number) =>
    http.post<{ message: string; rating: number }>(`/users/${id}/noter`, {
      rating,
    }),
  // ma note + la moyenne du voisin
  getNote: (id: number) =>
    http.get<{
      maNote: number | null;
      moyenne: number | null;
      nombreDeNotes: number;
    }>(`/users/${id}/noter`),
  // centres d'intérêt d'un voisin
  getInterets: (id: number) =>
    http.get<{ interests: string[] }>(`/users/${id}/interets`),
};

// ── Quartiers ────────────────────────────────────────────────────────────────
export const quartierApi = {
  list: () => http.get<Quartier[]>('/quartiers'),
};

// ── Services ─────────────────────────────────────────────────────────────────
export const serviceApi = {
  list: (filters?: { type?: string; statut?: string }) => {
    const q = new URLSearchParams();
    if (filters?.type) q.set('type', filters.type);
    if (filters?.statut) q.set('statut', filters.statut);
    const qs = q.toString();
    return http.get<Service[]>(`/services${qs ? `?${qs}` : ''}`);
  },
  get: (id: number) => http.get<ServiceDetail>(`/services/${id}`),
  create: (data: {
    type: string;
    categorie?: string;
    date_?: string;
    prix?: number;
  }) => http.post<Service>('/services', data),
  // Le type n'est pas modifiable après création (non accepté par l'API).
  update: (
    id: number,
    data: Partial<Pick<Service, 'categorie' | 'date_' | 'prix' | 'statut'>>,
  ) => http.put<Service>(`/services/${id}`, data),
  delete: (id: number) => http.del(`/services/${id}`),
  demander: (id: number) => http.post(`/services/${id}/demander`),
  annulerDemande: (id: number) => http.del(`/services/${id}/demander`),
  getDemandes: (id: number) =>
    http.get<EffectueDemande[]>(`/services/${id}/demandes`),
  terminer: (id: number, id_demandeur?: number) =>
    http.post(
      `/services/${id}/terminer`,
      id_demandeur ? { id_demandeur } : undefined,
    ),
};

// ── Événements ───────────────────────────────────────────────────────────────
export const eventApi = {
  list: () => http.get<Evenement[]>('/evenements'),
  get: (id: number) =>
    http.get<{ evenement: Evenement; detail: EvenementDetail | null }>(
      `/evenements/${id}`,
    ),
  create: (data: {
    titre: string;
    date_?: string;
    description?: string;
    interests?: string[];
    lieu?: string;
    heure?: string;
    duree?: string;
    ageRecommande?: string;
    points?: number;
  }) => http.post<Evenement>('/evenements', data),
  participer: (id: number, status: 'interested' | 'confirmed' | 'declined') =>
    http.post(`/evenements/${id}/participer`, { status }),
};

// ── Votes ────────────────────────────────────────────────────────────────────
export const voteApi = {
  list: () => http.get<Vote[]>('/votes'),
  get: (id: string) => http.get<Vote>(`/votes/${id}`),
  vote: (id: string, optionIds: string[]) =>
    http.post<Vote>(`/votes/${id}/voter`, { optionIds }),
  create: (data: {
    question: string;
    type: 'single' | 'multiple' | 'yesno';
    options: string[];
    description?: string;
    deadline?: string;
    isAnonymous?: boolean;
  }) => http.post<Vote>('/votes', data),
  close: (id: string) =>
    http.post<{ message: string; vote: Vote }>(`/votes/${id}/cloturer`),
};

// ── Contrats ─────────────────────────────────────────────────────────────────
// Pas de route de liste (GET /contrats n'existe pas côté API) : les contrats se
// découvrent via la relation `contrat` de chaque service (serviceApi.get).
export const contratApi = {
  get: (id: string) => http.get<Contrat>(`/contrats/${id}`),
  audit: (id: string) =>
    http.get<{ auditTrail: ContratAuditEntry[] }>(`/contrats/${id}/audit`),
  create: (data: { id_service: number; pdfUrl: string }) =>
    http.post<Contrat>('/contrats', data),
  signer: (id: string, signatureImage: string) =>
    http.post<{ message: string; contrat: Contrat }>(
      `/contrats/${id}/signer`,
      { signatureImage },
    ),
  archiver: (id: string) =>
    http.post<{ message: string; contrat: Contrat }>(
      `/contrats/${id}/archiver`,
    ),
};

// ── Messagerie ───────────────────────────────────────────────────────────────
export const messageApi = {
  conversations: () => http.get<ConversationItem[]>('/conversations'),
  createConversation: (recipient_postgres_ids: string[]) =>
    http.post<ConversationItem['conversation']>('/conversations', {
      recipient_postgres_ids,
    }),
  messages: (conversationId: string) =>
    http.get<Message[]>(`/conversations/${conversationId}/messages`),
  send: (
    conversationId: string,
    content: string,
    recipientIds?: string[],
    mediaAttachments?: MediaAttachment[],
  ) =>
    http.post<Message>(`/conversations/${conversationId}/messages`, {
      ...(content ? { content } : {}),
      ...(recipientIds ? { recipientIds } : {}),
      ...(mediaAttachments?.length ? { mediaAttachments } : {}),
    }),
};

// ── Centres d'intérêt (profil Mongo + INTERESSE_PAR Neo4j → recommandations) ─
export const interestsApi = {
  get: () => http.get<{ interests: string[] }>('/me/interets'),
  set: (interests: string[]) =>
    http.put<{ message: string; interests: string[] }>('/me/interets', {
      interests,
    }),
};

// ── Recommandations (graphe Neo4j) ───────────────────────────────────────────
export const recommendationApi = {
  voisins: () => http.get<{ voisins: string[] }>('/recommendations/voisins'),
  evenements: () =>
    http.get<{ evenements: string[] }>('/recommendations/evenements'),
  services: () => http.get<{ services: string[] }>('/recommendations/services'),
};

// ── RGPD ─────────────────────────────────────────────────────────────────────
export const gdprApi = {
  export: () => http.get<Record<string, unknown>>('/gdpr/export'),
  getConsent: () =>
    http.get<{ consentDonne: boolean; date: string | null }>(
      '/gdpr/consentement',
    ),
  setConsent: (consentement: boolean) =>
    http.post('/gdpr/consentement', { consentement }),
  deleteAccount: () => http.del('/gdpr/delete'),
};

// ── Signalements ─────────────────────────────────────────────────────────────
export const signalementApi = {
  create: (data: {
    cible_type: 'message' | 'service' | 'evenement' | 'user';
    cible_id: string;
    motif?: string;
  }) => http.post<Signalement>('/signalements', data),
};

// ── Incidents ────────────────────────────────────────────────────────────────
// La lecture (GET /incidents) est réservée admin/modérateur (gérée côté client
// Java) ; un habitant peut uniquement en déclarer un.
export interface Incident {
  id_incident: number;
  description: string;
  statut: string;
  type?: string;
  gravite?: string;
  createdAt?: string;
}

export const incidentApi = {
  create: (data: {
    description: string;
    type?: 'incident' | 'alerte';
    gravite?: 'faible' | 'moyenne' | 'haute' | 'critique';
  }) => http.post<Incident>('/incidents', data),
};

// ── Upload ───────────────────────────────────────────────────────────────────
export const uploadApi = {
  file: (file: File) =>
    http.upload<{
      url: string;
      filename: string;
      mimeType: string;
      size: number;
    }>('/upload', file),
};

// ── Présence (temps réel via lecture REST) ───────────────────────────────────
export const presenceApi = {
  online: () => http.get<{ online: string[] }>('/presence'),
};
