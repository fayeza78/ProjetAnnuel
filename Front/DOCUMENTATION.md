# Documentation technique — Petits Secrets Entre Voisins
### Application Web (React 19 + TypeScript + Vite)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture générale](#2-architecture-générale)
3. [Démarrage de l'application](#3-démarrage-de-lapplication)
4. [Couche données](#4-couche-données)
   - [client.ts (HTTP + JWT)](#41-clientts--http--jwt)
   - [index.ts (fonctions par domaine)](#42-indexts--fonctions-par-domaine)
   - [socket.ts (temps réel)](#43-socketts--temps-réel)
   - [AuthContext (session)](#44-authcontext--session)
5. [Navigation et structure UI](#5-navigation-et-structure-ui)
6. [Écrans et fonctionnalités](#6-écrans-et-fonctionnalités)
   - [Connexion / Inscription](#61-connexion--inscription)
   - [Accueil](#62-accueil)
   - [Carte du quartier](#63-carte-du-quartier)
   - [Services & Contrats](#64-services--contrats)
   - [Événements](#65-événements)
   - [Messagerie](#66-messagerie)
   - [Votes](#67-votes)
   - [Classement](#68-classement)
   - [Incidents & Signalements](#69-incidents--signalements)
   - [Profil](#610-profil)
   - [Back-office admin](#611-back-office-admin)
7. [Modèles de données (types API)](#7-modèles-de-données-types-api)
8. [Authentification, session & sécurité](#8-authentification-session--sécurité)
9. [Internationalisation](#9-internationalisation)
10. [Cartographie (Leaflet)](#10-cartographie-leaflet)
11. [Contrats & signature électronique](#11-contrats--signature-électronique)
12. [Système de recommandation](#12-système-de-recommandation)
13. [Style & design system](#13-style--design-system)
14. [Tests](#14-tests)
15. [Packaging et déploiement](#15-packaging-et-déploiement)

---

## 1. Vue d'ensemble

**Petits Secrets Entre Voisins** (Front) est l'application web destinée aux **habitants du quartier**. Elle permet de :

- Consulter la **carte du quartier** et les statistiques de chaque zone
- Échanger des **services** entre voisins (offres/demandes) et signer des **contrats** électroniques
- Participer à des **événements** et des **votes** de quartier
- Discuter via une **messagerie** en temps réel (texte + photos)
- Se **noter entre voisins** et consulter un classement de confiance
- Déclarer des **incidents** et faire des **signalements**
- Gérer son **profil** (sécurité, RGPD, centres d'intérêt, langue)
- Administrer le quartier (rôle `admin`) via un **back-office** intégré

**Stack technique :**
- React 19 + TypeScript + Vite 8
- React Router v7 (routing + garde de routes)
- Tailwind CSS v4
- i18next / react-i18next (FR / EN)
- Leaflet + react-leaflet + Leaflet-Geoman (cartographie)
- Socket.io-client (temps réel)
- qrcode (génération de QR codes MFA / SSO)
- pnpm (gestionnaire de paquets)
- Docker + nginx (service statique en production)

---

## 2. Architecture générale

```
┌──────────────────────────────────────────────────────────┐
│                     Application React                    │
│  App.tsx (routes + gardes)                                │
│  └── Layout (sidebar + header)                             │
│       ├── Home, Map, Vote, Event, ServiceContrats          │
│       ├── Messagerie, Classement, Incidents, Profil        │
│       └── AdminPage (dashboard, users, quartiers,           │
│                       signalements, votes, query)           │
└───────────────────────────┬────────────────────────────────┘
                            │
              ┌──────────────┴───────────────┐
              │                              │
    ┌─────────▼─────────┐          ┌─────────▼─────────┐
    │   src/api/*        │          │  AuthContext        │
    │  (client HTTP REST)│          │ (session, JWT, 3h)  │
    │                    │          │                     │
    │ client.ts  (fetch) │          │ user, loading        │
    │ index.ts  (domaines)│         │ login/register/logout│
    │ socket.ts (Socket.io)│        └─────────┬───────────┘
    └─────────┬──────────┘                    │
              │                                │
              └────────────────┬───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   API Node.js (Back) │
                    │  REST + Socket.io    │
                    │  (proxifiée /api,     │
                    │   /uploads, /socket.io)│
                    └──────────────────────┘
```

**Principes clés :**
- Toutes les données viennent de l'API REST ; aucun état métier persistant côté client hormis le token JWT (`localStorage`) et la langue.
- Chaque appel réseau passe par la couche `src/api` : jamais de `fetch` direct dans les pages (sauf téléchargement de PDF/blob).
- Les mises à jour d'état après un appel asynchrone restent locales au composant (`useState`), pas de store global (Redux/Zustand) : la donnée est re-fetchée après chaque mutation.
- Le routing protège les pages derrière `ProtectedRoute` (utilisateur connecté) et `AdminRoute` (rôle `admin`, vérifié serveur via `/auth/me`).

---

## 3. Démarrage de l'application

**Fichiers concernés :** `src/main.tsx`, `src/App.tsx`

`main.tsx` monte l'arbre React dans `#root` et enveloppe l'application dans `AuthProvider` (contexte de session) ; `src/i18n/config.ts` est importé pour initialiser i18next avant le premier rendu.

`App.tsx` :
1. Déclare toutes les routes via `react-router-dom` (`BrowserRouter`)
2. `/login` est publique
3. Toutes les autres routes sont enveloppées dans `ProtectedRoute` (redirige vers `/login` si non connecté) puis dans le `Layout` commun (sidebar + header)
4. `/admin` ajoute une seconde garde, `AdminRoute` (rôle `admin` uniquement)

**Démarrage en développement :**
```bash
pnpm install
pnpm dev
```
Vite proxifie `/api`, `/uploads` et `/socket.io` vers l'API locale (`http://localhost:3000`), voir [vite.config.ts](vite.config.ts).

---

## 4. Couche données

### 4.1 client.ts — HTTP + JWT

**Fichier :** `src/api/client.ts`

Client HTTP bas niveau basé sur `fetch`, sans dépendance externe (pas d'axios).

| Fonction / export | Rôle |
|---|---|
| `tokenStore` | Lit/écrit les tokens dans `localStorage` (`cn_access_token`, `cn_refresh_token`) |
| `request<T>(path, options, withAuth)` | Effectue l'appel, ajoute `Authorization: Bearer` et `Accept-Language`, parse le JSON, lève une `ApiError` si `!res.ok` |
| `tryRefresh()` | Sur 401, tente un `POST /auth/refresh` avec le refresh token puis rejoue la requête une seule fois |
| `http.get/post/put/del/upload` | Raccourcis typés au-dessus de `request` |
| `downloadBlob(path)` | Téléchargement binaire (PDF, archive Java) avec gestion du refresh token |

`ApiError` porte le `status` HTTP et le corps de réponse (`body`), utilisé notamment pour détecter le cas `{ mfa_required: true }` sur les endpoints sensibles.

### 4.2 index.ts — fonctions par domaine

**Fichier :** `src/api/index.ts`

Regroupe tous les appels API utilisateur (hors endpoints admin, isolés dans `adminApi`) par domaine métier :

| Domaine | Objet exporté | Endpoints principaux |
|---|---|---|
| Authentification | `authApi` | `register`, `login`, `logout`, `me`, `mfaSetup/Verify/Disable`, `ssoTicket`, `changePassword/Email/Phone` |
| Voisinage | `neighbourApi` | `list` (`GET /neighbours`) |
| Utilisateurs | `userApi` | `get`, `update`, `points`, `noter`, `getNote`, `getInterets` |
| Quartiers | `quartierApi` | `list` (`GET /quartiers`) |
| Services | `serviceApi` | `list`, `get`, `create`, `update`, `delete`, `demander`, `annulerDemande`, `getDemandes`, `terminer` |
| Événements | `eventApi` | `list`, `get`, `create`, `participer` |
| Votes | `voteApi` | `list`, `get`, `vote`, `create`, `close` |
| Contrats | `contratApi` | `get`, `audit`, `create`, `signer`, `archiver` |
| Messagerie | `messageApi` | `conversations`, `createConversation`, `messages`, `send` |
| Centres d'intérêt | `interestsApi` | `get`, `set` |
| Recommandations | `recommendationApi` | `voisins`, `evenements`, `services` |
| RGPD | `gdprApi` | `export`, `getConsent`, `setConsent`, `deleteAccount` |
| Signalements | `signalementApi` | `create` |
| Incidents | `incidentApi` | `create` |
| Upload | `uploadApi` | `file` (multipart) |
| Présence | `presenceApi` | `online` |
| Administration | `adminApi` | `users`, `setRole`, `deleteUser`, `setVoteBlock`, `signalements`, `traiterSignalement`, `statsIncidents`, `statsParticipations`, `createQuartier/updateQuartier/deleteQuartier`, `runQuery`, `telechargerAppJava` |

### 4.3 socket.ts — temps réel

**Fichier :** `src/api/socket.ts`

Encapsule `socket.io-client` :
- `connectSocket()` ouvre la connexion (authentifiée par le JWT via `auth: { token }`), utilisée pour signaler la présence en ligne et recevoir les événements de chat
- `disconnectSocket()` ferme la connexion
- Ouverte automatiquement quand `AuthContext` détecte un utilisateur connecté, fermée à la déconnexion

### 4.4 AuthContext — session

**Fichier :** `src/context/AuthContext.tsx`

Fournit le contexte de session à toute l'application via `useAuth()` :

| Valeur | Rôle |
|---|---|
| `user` | Profil courant (`Me`) ou `null` |
| `loading` | `true` pendant la vérification initiale du token |
| `login(email, password, code?)` | Authentifie, gère le cas MFA (`{ mfa_required: true }`) |
| `register(payload)` | Inscription puis connexion automatique |
| `logout()` | Invalide le refresh token côté API et nettoie l'état local |
| `refreshMe()` | Recharge `/auth/me` (utilisé après changement d'email/téléphone/MFA) |

**Session bornée à 3h :** l'horodatage de connexion est stocké dans `localStorage` (`cn_session_start`) ; un timer (`setTimeout`) force la déconnexion locale et la redirection vers `/login` à l'expiration, même si l'onglet reste ouvert.

---

## 5. Navigation et structure UI

**Fichiers :** `src/components/layout.tsx`, `sidebar.tsx`, `header.tsx`

`Layout` est le **shell** commun à toutes les pages protégées :
- `SideBar` — navigation fixe sur desktop, en overlay sur mobile (`open`/`onClose`), affiche l'onglet **Admin** uniquement si `user.role === 'admin'`
- `Header` — nom d'utilisateur, quartier, bouton menu mobile, accès rapide au profil
- `<Outlet />` — zone de contenu où React Router injecte la page active

**Table des routes (`App.tsx`) :**

| Chemin | Page | Garde |
|---|---|---|
| `/login` | `Login` | publique |
| `/` | `Home` | `ProtectedRoute` |
| `/carte` | `Map` | `ProtectedRoute` |
| `/services` | `ServiceContrats` | `ProtectedRoute` |
| `/evenements` | `Event` | `ProtectedRoute` |
| `/messagerie` | `Messagerie` | `ProtectedRoute` |
| `/votes` | `Vote` | `ProtectedRoute` |
| `/classement` | `Classement` | `ProtectedRoute` |
| `/incidents` | `Incidents` | `ProtectedRoute` |
| `/admin` | `AdminPage` | `ProtectedRoute` + `AdminRoute` |
| `/profil` | `Profil` | `ProtectedRoute` |

---

## 6. Écrans et fonctionnalités

### 6.1 Connexion / Inscription

**Fichier :** `src/pages/login.tsx`

Formulaire unique basculant entre connexion et inscription. L'inscription demande adresse, ville, code postal et le quartier (liste déroulante alimentée par `quartierApi.list()`, repli en champ libre si l'API n'en renvoie aucun). La connexion gère le second facteur : si l'API répond `{ mfa_required: true }`, un champ code à 6 chiffres apparaît et le formulaire est resoumis.

### 6.2 Accueil

**Fichier :** `src/pages/home.tsx`

Tableau de bord personnel chargé en parallèle (`Promise.all`) : compteurs (services, événements, points), carte Leaflet des quartiers (polygones), mini-calendrier des prochains événements avec tags et badge « recommandé », votes en cours avec barre de progression, mes centres d'intérêt, et voisins recommandés (note moyenne, intérêts communs) fournis par `recommendationApi.voisins()`.

### 6.3 Carte du quartier

**Fichier :** `src/pages/map.tsx`

Carte Leaflet/OpenStreetMap affichant chaque quartier sous forme de polygone (`parsePolygon` accepte GeoJSON, tableau brut de coordonnées ou WKT `POLYGON(( ... ))`). Popup au clic : nom, description, statistiques (habitants, événements, services, votes actifs).

### 6.4 Services & Contrats

**Fichier :** `src/pages/services&contrats.tsx` (+ `src/components/services/SignatureModal.tsx`)

Deux onglets :
- **Services** — création d'une offre/demande (catégorie, prix en points), filtres (tous/gratuits/payants), demande et retrait de demande côté voisin, édition (hors type, non modifiable après création) et suppression côté prestataire, clôture avec sélection du demandeur retenu.
- **Contrats** — un service lié à un contrat expose : consultation/téléchargement du PDF, signature électronique via `SignatureModal` (canvas HTML, export PNG), historique/piste d'audit (`contratApi.audit`), archivage une fois signé. Pas de route de liste des contrats côté API : ils sont découverts via la relation `contrat` de chaque service.

### 6.5 Événements

**Fichier :** `src/pages/event.tsx` (+ `src/components/events/*`)

Liste filtrable (tous / recommandés / passés), création (titre, date, heure, lieu, durée, âge recommandé, points, tags issus de `CATALOGUE_INTERETS`), fiche détaillée en modale, participation avec statut `interested` / `confirmed` / `declined` (seul `confirmed` compte comme place réservée), mise en avant des événements recommandés (`recommendationApi.evenements`).

### 6.6 Messagerie

**Fichier :** `src/pages/messagerie.tsx`

Conversations en quasi temps réel : liste + création (sélection multiple de voisins via `neighbourApi.list()`), envoi de texte et de photos (upload via `uploadApi.file`, limite 20 Mo côté client), auto-scroll, rafraîchissement par polling toutes les 4 secondes (liste des conversations + fil actif), complété par la présence en ligne Socket.io.

### 6.7 Votes

**Fichier :** `src/pages/vote.tsx`

Création de sondages (question, type `single`/`multiple`/`yesno`, options, date limite, anonymat), participation adaptée au type (bouton direct pour choix unique/oui-non, sélection + confirmation pour choix multiple), résultats avec barre de progression, statut voté/clôturé.

### 6.8 Classement

**Fichier :** `src/pages/classement.tsx`

Podium des voisins les plus fiables (`recommendationApi.voisins`), tableau détaillé (ville, quartier), et notation des voisins de mon quartier (1 à 5 étoiles via `userApi.noter`) qui alimente leur score moyen affiché (`userApi.getNote`).

### 6.9 Incidents & Signalements

**Fichier :** `src/pages/incidents.tsx`

Formulaire à deux modes : déclarer un **incident** (description + gravité optionnelle) via `incidentApi.create`, ou faire un **signalement** sur une ressource existante (message/service/événement/utilisateur + motif) via `signalementApi.create`. Historique des créations de la session affiché en dessous.

### 6.10 Profil

**Fichier :** `src/pages/profil.tsx`

Écran le plus dense de l'application :
- Points cumulés et informations de base (email, rôle, ville, quartier)
- Changement mot de passe / e-mail / téléphone (chacun protégé par le mot de passe actuel + code MFA si activé, détecté via `ApiError.status === 401` et `body.mfa_required`)
- Activation/désactivation de la double authentification (QR code généré côté client avec `qrcode`, confirmation par code à 6 chiffres)
- SSO client Java (admin/modérateur uniquement) — génération d'un ticket à usage unique affiché en QR code et copiable, expirant après 120 s (compte à rebours local)
- Choix de la langue (FR/EN)
- Centres d'intérêt (jusqu'à 10, catalogue partagé avec la création d'événement)
- RGPD — consentement, export JSON de mes données, suppression de compte
- Déconnexion

### 6.11 Back-office admin

**Fichiers :** `src/pages/admin/*` (réservé au rôle `admin`, cf. `AdminRoute`)

`AdminPage` affiche une barre d'onglets ; chaque onglet est un composant autonome :

| Onglet | Composant | Rôle |
|---|---|---|
| Dashboard | `AdminDashboard.tsx` | Statistiques (incidents par statut/gravité/type, participations aux événements), téléchargement de l'archive du client Java de bureau (`adminApi.telechargerAppJava`) |
| Utilisateurs | `AdminUsers.tsx` | Recherche par email, changement de rôle (`user`/`moderateur`/`admin`), blocage/déblocage du droit de vote, suppression de compte |
| Quartiers | `AdminQuartiers.tsx` | Modélisation géographique : dessin de polygones sur une carte Leaflet via **Leaflet-Geoman** (`@geoman-io/leaflet-geoman-free`), création/liste/suppression de quartiers |
| Signalements | `AdminSignalements.tsx` | Traitement des signalements (marquer traité/rejeté) |
| Votes | `AdminVotes.tsx` | Création et clôture de sondages officiels |
| Requêtes | `AdminQuery.tsx` | Console d'un langage de requête maison sur les collections MongoDB (`events`, `contracts`, `messages`, `votes`, `services`, `inhabitants`, `neighborhoods`, `conversations`), avec autocomplétion de mots-clés et exemples prêts à l'emploi |

---

## 7. Modèles de données (types API)

**Fichier :** `src/api/index.ts` (types exportés, alignés sur les réponses de l'API REST)

| Type | Champs clés | Utilisé par |
|---|---|---|
| `AuthUser` / `Me` | `id_user`, `email`, `role`, `adresse`, `ville`, `cp`, `mfa_enabled`, `vote_blocked`, `quartier` | Session, profil |
| `Neighbour` | `id_user`, `email`, `ville`, `quartier` | Messagerie, classement |
| `Quartier` | `id_quartier`, `nom_quartier`, `limite_geo` (GeoJSON/WKT), `stats` | Carte, admin |
| `Service` / `ServiceDetail` | `id_service`, `type` (`offre`/`demande`), `categorie`, `prix`, `statut`, `prestataire`, `contrat`, `effectueDemandes` | Services |
| `Evenement` / `EvenementDetail` | `id_evenement`, `titre`, `date_`, `participants`, `tags`, `comments` | Événements |
| `Vote` / `VoteOption` | `postgres_id`, `question`, `type` (`single`/`multiple`/`yesno`), `options`, `votes`, `deadline`, `status` | Votes |
| `Contrat` / `ContratSignature` / `ContratAuditEntry` | `postgres_id`, `pdfUrl`, `status` (`pending`/`partially_signed`/`signed`/`archived`), `signatures`, `auditTrail` | Contrats |
| `ConversationItem` / `Message` / `MediaAttachment` | `postgres_id`, `participants_postgres_ids`, `content`, `mediaAttachments` | Messagerie |
| `Incident` / `Signalement` | `id_incident`/`id_signalement`, `description`/`motif`, `statut`, `gravite` | Incidents |
| `AdminUser` / `IncidentsStats` / `ParticipationsStats` | agrégats admin | Back-office |

`EventType` (`src/types/event.ts`) est le modèle **UI** dérivé côté front (combinaison `Evenement` + `EvenementDetail` + statut de participation de l'utilisateur courant), construit par `mapEvent()` dans `event.tsx` — il n'existe pas tel quel côté API.

---

## 8. Authentification, session & sécurité

- **JWT** : `access_token` + `refresh_token` stockés en `localStorage`, refresh automatique et transparent sur 401 (`client.ts`).
- **Session bornée à 3h** avec déconnexion automatique même onglet ouvert (`AuthContext.tsx`).
- **MFA (TOTP)** : setup avec QR code (`authApi.mfaSetup` → `otpauthUrl` encodé via la librairie `qrcode`), vérification par code à 6 chiffres, désactivation.
- **Changements sensibles** (mot de passe, e-mail, téléphone) : nécessitent le mot de passe actuel, et un code MFA si la 2FA est active — détecté dynamiquement via la réponse `401 { mfa_required: true }` de l'API plutôt que codé en dur côté client.
- **SSO client Java** : ticket à usage unique valable 120 s (`authApi.ssoTicket`), affiché en QR code et copiable, réservé aux rôles `admin`/`moderateur`.
- **RGPD** : consentement explicite, export des données (`gdprApi.export`, téléchargé en JSON), suppression de compte.
- **Garde de rôle admin** : `AdminRoute` (App.tsx) ne fait jamais confiance à un état client local — le rôle vient de `/auth/me`, validé côté serveur à chaque chargement.

---

## 9. Internationalisation

**Fichiers :** `src/i18n/config.ts`, `src/i18n/locales/{fr,en}.json`

- i18next + `react-i18next` + `i18next-browser-languagedetector`
- Langue détectée depuis `localStorage` (clé `cn_lang`) puis le navigateur, repli sur `fr`
- `dateLocale()` dérive la locale `Intl`/`toLocaleDateString` (`fr-FR` ou `en-US`) de la langue i18n active, utilisée pour tous les formatages de date de l'application
- Le changement de langue se fait depuis le profil (`i18n.changeLanguage`) et persiste automatiquement
- Les erreurs renvoyées par l'API suivent l'en-tête `Accept-Language` envoyé par `client.ts`

---

## 10. Cartographie (Leaflet)

**Fichiers :** `src/pages/map.tsx`, `src/pages/home.tsx`, `src/pages/admin/AdminQuartiers.tsx`

- `react-leaflet` + tuiles OpenStreetMap pour l'affichage (carte publique et mini-carte d'accueil)
- Les zones de quartier (`limite_geo`) sont stockées sous forme de texte côté API et parsées côté client (`parsePolygon`/`lirePolygone`) : GeoJSON `Polygon`, tableau brut de coordonnées `[lng, lat]`, ou WKT `POLYGON((...))`
- **Dessin de zones (admin uniquement)** : `@geoman-io/leaflet-geoman-free` ajoute des contrôles de dessin de polygone sur la carte ; le tracé est converti en GeoJSON puis envoyé à `adminApi.createQuartier` (`limite_geo: JSON.stringify(geometry)`)

---

## 11. Contrats & signature électronique

**Fichiers :** `src/pages/services&contrats.tsx`, `src/components/services/SignatureModal.tsx`

- Un contrat est créé côté service (offre/demande), stocke un PDF (`pdfUrl`) et transite par les statuts `pending` → `partially_signed` → `signed` → `archived`
- La signature se fait sur un `<canvas>` HTML (tracé à la souris), exportée en PNG base64 (`canvas.toDataURL`) et envoyée à `contratApi.signer(id, dataUrl)`
- Le téléchargement du PDF signé passe par un `fetch` + `Blob` pour forcer l'enregistrement local plutôt que l'ouverture dans un nouvel onglet
- L'historique (`contratApi.audit`) affiche la piste d'audit complète (création, signatures, archivage) horodatée

---

## 12. Système de recommandation

**Fichier :** `src/api/index.ts` (`recommendationApi`)

Le front consomme un moteur de recommandation basé sur un graphe (Neo4j côté API) sans jamais interroger le graphe directement :

| Endpoint | Utilisé dans | Effet |
|---|---|---|
| `recommendationApi.voisins()` | Accueil, Classement | Classe/suggère les voisins les plus fiables |
| `recommendationApi.evenements()` | Accueil, Événements | Marque les événements recommandés (badge) |
| `recommendationApi.services()` | (réservé) | Services recommandés |

Les recommandations de voisins sont croisées avec les centres d'intérêt communs (`interestsApi` + `userApi.getInterets`) pour afficher « intérêts en commun » sur la page d'accueil.

---

## 13. Style & design system

- **Tailwind CSS v4** (`@tailwindcss/vite`), classes utilitaires directement dans le JSX, pas de fichier de thème séparé
- Palette principale : `blue-1`/`blue-2` (identité), `orange-1` (accent/alerte), cartes blanches arrondies (`rounded-2xl shadow-lg`) sur fond dégradé (`from-[#DEE1E9] via-[#8AC6C7]/60 to-[#D2D4D6]`)
- Icônes : `react-bootstrap-icons` (usage principal) et `react-icons`
- Layout responsive : sidebar fixe en desktop / overlay en mobile (`components/layout.tsx`), grilles `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

---

## 14. Tests

Aucun framework de test (unitaire ou end-to-end) n'est actuellement configuré côté Front — pas de script `test` dans `package.json`. La vérification de non-régression repose sur `pnpm lint` (ESLint + règles React/TypeScript) et `pnpm build` (`tsc -b` en mode strict avant le build Vite).

---

## 15. Packaging et déploiement

### Build de production

```bash
pnpm build
```
Exécute `tsc -b` (vérification des types) puis `vite build`, génère les assets statiques dans `dist/`.

### Image Docker

**Fichier :** `Dockerfile` — build multi-stage :
1. **Build** (`node:24`) — `pnpm install` puis `pnpm build` → `/app/dist`
2. **Service** (`nginx:alpine`) — sert `dist/` en statique sur le port 80 avec la configuration `nginx.conf`

```bash
docker build -t front .
docker run -p 80:80 front
```

### Configuration nginx

**Fichier :** `nginx.conf`

| Chemin | Comportement |
|---|---|
| `/api/*` | Reverse proxy vers le conteneur `api:3000` (préfixe retiré) |
| `/uploads/*` | Reverse proxy vers `api:3000/uploads/*` (PDF de contrats, photos) |
| `/socket.io/*` | Reverse proxy avec upgrade WebSocket vers `api:3000` |
| `/*` (fallback) | `try_files … /index.html` — laisse React Router gérer les routes côté client (SPA) |

Ce conteneur doit être déployé sur le même réseau Docker Compose qu'un service nommé `api` exposant le port 3000.

---

*Documentation générée le 24/07/2026 — voir aussi [README.md](README.md) pour le guide de démarrage rapide.*
