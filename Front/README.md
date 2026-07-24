# Front — application web (React + Vite)

Interface web du projet « quartier connecté » : carte du quartier, services entre
voisins, événements, votes, messagerie temps réel, classement et back-office
admin/modérateur. Consomme l'API REST (+ Socket.io) du dossier `Back`.

> Pour la documentation technique détaillée (architecture, modèles de données,
> écrans, sécurité...), voir [DOCUMENTATION.md](DOCUMENTATION.md).

## Stack technique

- **React 19** + **TypeScript** + **Vite 8**
- **React Router v7** (routing + garde de routes)
- **Tailwind CSS v4** (`@tailwindcss/vite`)
- **i18next / react-i18next** — FR (par défaut) / EN, langue détectée puis
  mémorisée dans `localStorage`
- **Leaflet / react-leaflet** + **Leaflet-Geoman** — carte interactive du quartier
- **Socket.io-client** — présence en ligne, messagerie en temps réel
- **react-bootstrap-icons / react-icons** — icônes
- **qrcode** — génération de QR code (MFA)
- Gestionnaire de paquets : **pnpm**

## Prérequis

- Node.js 24+
- pnpm (`npm install -g pnpm`)
- L'API backend lancée (par défaut sur `http://localhost:3000`)

## Installation

```bash
pnpm install
```

## Développement

```bash
pnpm dev
```

Lance Vite en mode dev. Le serveur proxifie automatiquement (voir
[vite.config.ts](vite.config.ts)) :

| Chemin appelé par le front | Redirigé vers |
| --- | --- |
| `/api/*` | `http://localhost:3000/*` |
| `/uploads/*` | `http://localhost:3000/uploads/*` (fichiers générés par l'API, ex. PDF de contrats) |
| `/socket.io/*` | `http://localhost:3000` (WebSocket compris) |

Cela évite les soucis CORS en local : pas besoin de changer `VITE_API_URL`.

## Configuration (variables d'environnement)

Définies dans [.env](.env) :

```
VITE_API_URL=/api
```

- En **dev** : `/api` est proxifié vers l'API locale (voir tableau ci-dessus).
- En **prod** : soit on garde `/api` et un reverse proxy (nginx, voir plus bas)
  fait suivre vers l'API, soit on met l'URL publique complète de l'API
  (ex. `http://51.77.245.139:3000`) — dans ce dernier cas l'API doit autoriser
  le CORS.

## Scripts disponibles

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Serveur de développement Vite (HMR) |
| `pnpm build` | Vérifie les types (`tsc -b`) puis build de prod dans `dist/` |
| `pnpm preview` | Sert le build de `dist/` en local pour vérification |
| `pnpm lint` | Lint ESLint (TypeScript + React) |

## Structure du projet

```
src/
├── api/            Couche d'accès à l'API
│   ├── client.ts   Client HTTP bas niveau : token JWT, refresh auto, erreurs
│   ├── index.ts    Fonctions par domaine (auth, services, événements, votes,
│   │               messagerie, contrats, admin, RGPD, incidents, upload…)
│   └── socket.ts   Connexion Socket.io (présence, chat temps réel)
├── context/
│   └── AuthContext.tsx   Session utilisateur, login/register/logout,
│                         déconnexion auto après 3h, ouverture de la socket
├── components/
│   ├── layout.tsx, sidebar.tsx, header.tsx   Ossature de l'app connectée
│   ├── events/                                Composants liés aux événements
│   └── services/                              Composants liés aux services (ex. signature de contrat)
├── pages/
│   ├── login.tsx, home.tsx, map.tsx, vote.tsx, event.tsx,
│   │   classement.tsx, incidents.tsx, messagerie.tsx, profil.tsx,
│   │   services&contrats.tsx
│   └── admin/       Back-office (utilisateurs, signalements, votes,
│                    quartiers, requêtes, dashboard) — réservé au rôle admin
├── i18n/
│   ├── config.ts    Init i18next (fr par défaut, en supporté)
│   └── locales/     Fichiers de traduction fr.json / en.json
├── types/           Types partagés (ex. event.ts)
├── App.tsx          Déclaration des routes + gardes (ProtectedRoute, AdminRoute)
└── main.tsx         Point d'entrée
```

## Fonctionnalités disponibles

### Authentification & compte (`/login`, `/profil`)

- **Connexion / inscription** — formulaire unique qui bascule entre les deux
  modes ; l'inscription demande adresse, ville, code postal et le quartier
  (liste déroulante alimentée par l'API, avec repli en champ libre si
  aucun quartier n'existe encore).
- **Double authentification (MFA/TOTP)** — activation avec QR code +
  saisie manuelle de la clé secrète, confirmation par code à 6 chiffres,
  désactivation. Login demande le code MFA si le compte l'a activé.
- **Changement des informations sensibles** — mot de passe, e-mail,
  téléphone, chacun protégé par le mot de passe actuel et, si la 2FA est
  active, un code MFA (géré automatiquement via la réponse 401 de l'API).
- **Session** — token JWT avec refresh automatique, expiration forcée après
  3h, déconnexion manuelle.
- **SSO client Java** (admin/modérateur) — génération d'un ticket à usage
  unique (QR code + copie presse-papiers, expire en 120s) pour connecter le
  client lourd sans ressaisir le mot de passe.
- **Centres d'intérêt** — sélection jusqu'à 10 tags dans un catalogue
  prédéfini ([interest.ts](src/interest.ts)), utilisés pour les
  recommandations.
- **Langue** — bascule FR / EN.
- **RGPD** — consentement (activer/désactiver), export de mes données en
  JSON, suppression de compte (`gdprApi.deleteAccount`).
- **Déconnexion.**

### Accueil (`/`)

Tableau de bord personnel : compteurs (services, événements, points),
carte des quartiers, mini-calendrier des prochains événements (avec tags
et badge « recommandé pour vous »), votes en cours avec barre de
progression, mes centres d'intérêt, et voisins recommandés (note moyenne,
intérêts en commun) à partir du moteur de recommandation (Neo4j).

### Carte du quartier (`/carte`)

Carte Leaflet (OpenStreetMap) affichant les zones géographiques des
quartiers (polygones), avec popup détaillant nom, description et
statistiques (habitants, événements, services, votes actifs).

### Services entre voisins & contrats (`/services`)

- **Services** : création d'une offre ou d'une demande (catégorie, prix en
  points), filtres (tous / gratuits / payants), demande/annulation de
  service par un voisin, édition (hors type) et suppression par le
  prestataire, clôture avec choix du demandeur retenu parmi les candidats.
- **Contrats** liés à un service : consultation du PDF, signature
  électronique (tracé + horodatage + IP, via une modale de signature),
  historique/piste d'audit, téléchargement du PDF signé, archivage.

### Événements (`/evenements`)

Liste filtrable (tous / recommandés / passés), création d'un événement
(titre, date, heure, lieu, durée, âge recommandé, points, tags
d'intérêt), fiche détaillée en modale (description, participants,
commentaires, tags), participation avec statut *intéressé / confirmé /
décliné*, mise en avant des événements recommandés par le moteur Neo4j.

### Messagerie (`/messagerie`)

Conversations en temps réel : liste des conversations, création d'une
nouvelle conversation en choisissant un ou plusieurs voisins (recherche
par email), envoi de messages texte et de photos (upload avec limite de
20 Mo), rafraîchissement automatique toutes les 4s, présence en ligne via
Socket.io.

### Votes (`/votes`)

Création de sondages (question, type *choix unique / choix multiple /
oui-non*, options, date limite, anonymat), participation (vote unique ou
multiple selon le type), résultats en temps réel avec barre de
progression, indicateur de vote déjà exprimé / sondage clôturé.

### Classement des voisins (`/classement`)

Podium des voisins les plus fiables (issu des recommandations Neo4j),
tableau détaillé (ville, quartier), et notation des voisins (1 à 5
étoiles) qui alimente leur score de confiance et leur moyenne affichée.

### Incidents & signalements (`/incidents`)

Formulaire à deux modes : déclarer un **incident** (description, niveau
de gravité) ou faire un **signalement** sur une ressource existante
(message, service, événement, utilisateur) avec motif. Historique des
signalements/incidents créés dans la session.

### Back-office admin (`/admin`, réservé au rôle `admin`)

Organisé en onglets :
- **Dashboard** — statistiques (incidents par statut/gravité/type,
  participations aux événements), téléchargement de l'archive du client
  Java de bureau.
- **Utilisateurs** — recherche, changement de rôle
  (`user`/`moderateur`/`admin`), blocage/déblocage du droit de vote,
  suppression de compte.
- **Quartiers** — modélisation géographique : dessin de polygones sur la
  carte (Leaflet-Geoman) pour définir la zone d'un quartier, création,
  liste, suppression.
- **Signalements** — traitement (marquer traité / rejeté) des
  signalements des utilisateurs.
- **Votes officiels** — création et clôture de sondages depuis le
  back-office.
- **Requêtes** — console d'un langage de requête maison sur les
  collections MongoDB (`events`, `contracts`, `messages`, `votes`,
  `services`, `inhabitants`, `neighborhoods`, `conversations`) avec
  autocomplétion et exemples prêts à l'emploi.

## Authentification & routing

- Toutes les routes sont protégées par `ProtectedRoute` (redirige vers
  `/login` si non connecté), sauf `/login` elle-même.
- `/admin` est en plus protégée par `AdminRoute` (rôle `admin` uniquement,
  vérifié via `/auth/me` côté serveur — jamais fait confiance au seul état client).
- Le token JWT est stocké dans `localStorage` (`cn_access_token` /
  `cn_refresh_token`) et rafraîchi automatiquement en cas de 401
  ([client.ts](src/api/client.ts)).
- La session expire automatiquement après **3h** ([AuthContext.tsx](src/context/AuthContext.tsx)).
- MFA (TOTP) géré via `authApi.mfaSetup/verify/disable` + génération de QR
  code (`qrcode`).

## Internationalisation

Langue détectée automatiquement (localStorage puis navigateur), avec le
français en repli. Pour ajouter une clé de traduction, l'ajouter dans
[src/i18n/locales/fr.json](src/i18n/locales/fr.json) et
[src/i18n/locales/en.json](src/i18n/locales/en.json).

## Build & déploiement (Docker)

Le [Dockerfile](Dockerfile) fait un build multi-stage :

1. **Build** (`node:24`) : `pnpm install` puis `pnpm build` → génère `dist/`.
2. **Service** (`nginx:alpine`) : sert `dist/` en statique sur le port 80,
   avec la config [nginx.conf](nginx.conf) qui :
   - reverse-proxy `/api/*`, `/uploads/*` et `/socket.io/*` vers le conteneur
     `api` (nom de service Docker Compose) ;
   - fait un fallback SPA (`try_files … /index.html`) pour que React Router
     gère les routes côté client.

```bash
docker build -t front .
docker run -p 80:80 front
```

En environnement Docker Compose, ce conteneur doit être sur le même réseau
qu'un service nommé `api` exposant le port 3000.

## Notes

- Pas d'endpoints admin (stats, sync, requêtes libres) dans `src/api/index.ts`
  côté flux utilisateur classique : ceux-ci sont regroupés dans `adminApi`.
- Le générateur de contrat/signature (`services/SignatureModal.tsx`) s'appuie
  sur les PDF servis par l'API via `/uploads`.
