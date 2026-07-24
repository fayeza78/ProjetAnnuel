# Connected Neighbours — Le projet complet (API + Front + Java)

> Vue d'ensemble des trois briques applicatives. Détail du sujet : `Doc/Sujet/` ·
> Détail de l'API : `README.md` et `Doc/Explain/`.

**Équipe (ESGI 3AL2)** : Fayëza Tibedeo · Meriam Kolli · Julien Carreira
**Production** : https://petitsecretentrevoisins.online (HTTPS)
**Dépôt client Java** : https://github.com/fayeza78/ProjetAnnuel/tree/main/JAVA

---

## 1. Comment les trois briques s'articulent

```
   Navigateur                          Poste administrateur
       │                                       │
   FRONT REACT  ◄── QR / ticket SSO ──►   CLIENT JAVA (JavaFX)
       │                                       │  base locale SQLite
       │ /api + /socket.io (via Apache HTTPS)  │  (offline-first)
       ▼                                       ▼
   ┌─────────────────────  API Node.js  ─────────────────────┐
   │   authentification JWT · MFA · rôles · règles métier    │
   │   fournisseur d'identité UNIQUE des deux clients        │
   └───────┬──────────────────┬──────────────────┬───────────┘
       PostgreSQL          MongoDB             Neo4j
    (source de vérité) (documents riches) (graphe social/reco)
```

- L'**API est le centre** : les deux clients s'authentifient auprès d'elle (JWT), et le client
  Java peut récupérer une session **sans mot de passe** via un ticket SSO généré sur le site web
  (QR code) et échangé une seule fois.
- Le **Front** passe par Apache (même origine, HTTPS) ; le **Java** appelle l'API directement et
  travaille hors-ligne sur sa base locale, puis se **synchronise** (`GET/POST /sync`,
  conflits en last-write-wins).

---

## 2. L'API (Node.js) — le cœur

|              |                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | Node.js · Express 5 · TypeScript strict (ESM) · TypeORM · Socket.io                                                                                                                                                                                                                            |
| Persistance  | **3 bases** : PostgreSQL (relationnel, source de vérité), MongoDB (votes, messages, contrats signables, profils/points), Neo4j (graphe social → 3 recommandations) — reliées par `postgres_id`                                                                                                 |
| Architecture | couches strictes : `routes → middleware → handler → validator Joi typé + interface → usecase → repository` (90 routes)                                                                                                                                                                         |
| Sécurité     | JWT + refresh, **MFA TOTP obligatoire** (secret chiffré AES-256-GCM), SSO par ticket, 3 rôles, rate-limiting par paliers, RGPD complet (export/anonymisation 3 bases)                                                                                                                          |
| Spécificités | détection de **chevauchement de quartiers** (géométrie maison), **langage d'interrogation type lex/yacc** (`FIND … WHERE … LIMIT`), **PDF de contrat généré sans bibliothèque** (gabarit HTML + écrivain PDF maison, zones de signature alignées), erreurs bilingues `{ code, error }` (fr/en) |
| Qualité      | **393 tests** (unitaires, contrat HTTP de toutes les routes, E2E full-stack contre les vraies bases) · Swagger sur `/api/api-docs`                                                                                                                                                             |
| Déploiement  | 7 conteneurs Docker + Apache (HTTPS Let's Encrypt) via `prod.sh`                                                                                                                                                                                                                               |

## 3. Le Front web (React) — l'interface des habitants

|              |                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack        | React 19 · Vite · TypeScript · React Router 7 · Tailwind CSS                                                                                                                              |
| Cartographie | **Leaflet + react-leaflet + Leaflet-Geoman** — l'**outil de dessin des quartiers** demandé par le sujet (polygones envoyés en GeoJSON à l'API, refus 409 affiché en cas de chevauchement) |
| Multilingue  | **i18next + react-i18next** + détection de la langue du navigateur (fr/en) — l'exigence « application multilingue » du sujet                                                              |
| Temps réel   | **socket.io-client** — présence online/offline et messagerie en direct (même JWT que l'API)                                                                                               |
| SSO          | lib **qrcode** — le ticket SSO est affiché en QR code sur la page profil, à scanner depuis l'appli Java                                                                                   |
| Pages        | accueil, carte des quartiers, services & contrats (signature), événements (swipe), votes, messagerie, incidents, classement, profil, back-office admin                                    |
| Déploiement  | Dockerfile multi-étapes : build Vite puis service statique **nginx** (conteneur `front`)                                                                                                  |

## 4. Le client Java (JavaFX) — le back-office de l'administrateur

|                          |                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack                    | **Java 21 + JavaFX 21** · Maven · **SQLite** (`sqlite-jdbc`, base locale `Data/data.db`) · `java.net.http.HttpClient` natif · JUnit 5 + Mockito           |
| Incidents & signalements | consultation, création et **traitement** (`PUT /incidents/:id/statut`, `/signalements/:id/traiter`)                                                       |
| Statistiques             | 4 graphiques JavaFX (PieChart, BarChart, LineChart) sur `/stats/incidents` et `/stats/participations`                                                     |
| **Offline-first**        | cache SQLite : consultation ET ajout sans réseau, puis **synchronisation** automatique (`GET/POST /sync`, résolution de conflits côté API)                |
| SSO                      | `POST /auth/sso/exchange` — connexion via le ticket généré sur le site web, sans mot de passe                                                             |
| Plugins                  | 3 inclus : export de statistiques, analyse sociale, calendrier local                                                                                      |
| Thèmes                   | 4 thèmes de couleurs (Nuit, Aube, Marine, Forêt) + 3 tailles de police × 3 dispositions                                                                   |
| Mises à jour             | vérification, téléchargement et remplacement automatique du JAR                                                                                           |
| Désinstallation          | depuis l'interface (+ script de nettoyage)                                                                                                                |
| Livraison                | **fat JAR auto-exécutable** (`mvn package`, maven-shade-plugin ; classe `Launcher` pour contourner la contrainte JPMS) + `install.bat` (raccourci bureau) |

---

## 5. Qui couvre quoi (exigences du sujet)

| Exigence                                                              | Brique principale                               |
| --------------------------------------------------------------------- | ----------------------------------------------- |
| Dessin des quartiers + problèmes de limites                           | Front (Geoman) + API (refus des chevauchements) |
| Services, points, contrat obligatoire, signatures                     | API (+ écrans Front)                            |
| Événements + swipe + suggestions Neo4j                                | API (+ interface Front)                         |
| Messagerie multimédia + présence temps réel                           | API Socket.io (+ interface Front)               |
| Votes paramétrables                                                   | API (+ écrans Front)                            |
| Multilingue                                                           | Front (i18next) + API (erreurs fr/en)           |
| MFA obligatoire, SSO, rôles, RGPD                                     | API                                             |
| Incidents, stats, offline-first, sync, plugins, thèmes, MAJ auto, JAR | Client Java                                     |
| Conteneurisation, tests, déploiement                                  | API + Front (Docker) · projet déployé en HTTPS  |
