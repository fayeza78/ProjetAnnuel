# Connected Neighbours — API

Plateforme collaborative de quartier : services entre voisins (gratuits ou payants en **points**),
contrats **signés numériquement**, événements (swipe), votes, messagerie temps réel,
incidents et **recommandations** par graphe social.

> **Production : https://petitsecretentrevoisins.online** · Swagger : `/api/api-docs`
> Node.js · Express 5 · TypeScript strict (ESM) · PostgreSQL + MongoDB + Neo4j · Docker

---

## Démarrage rapide

```bash
cp .env.example .env                                   # renseigner les secrets
docker compose up -d --build api postgres mongodb neo4j
docker compose exec api npm run seed                   # jeu de données de démo
# API → http://localhost:3000   ·   Swagger → http://localhost:3000/api-docs
```

Installeur assisté (machine vierge) : `bash scripts/install.sh` — détails dans `INSTALL.md`.

---

## Méthode — l'architecture en couches

**Toutes les 90 routes** suivent le même chemin, sans exception :

```
routes.ts → Middleware → Handler → Interface (Requests) + Validator (Joi) → Usecase → Repository
              │             │                    │                             │
              │             │                    │                             └─ TypeORM (PG/Mongo)
              │             │                    │                                ou Cypher (Neo4j)
              │             │                    └─ contrat TypeScript du body
              │             │                       + schéma Joi typé dessus
              │             └─ contrôleur : valide, appelle le usecase,
              │                traduit en HTTP, synchronise les autres bases
              └─ rate-limit → JWT (authenticateToken) → rôle (requireRole)
```

| Couche | Dossier | Rôle |
|---|---|---|
| **Routes** | `src/Handlers/routes.ts` | Table unique des 90 endpoints + leurs middlewares (palier de débit, auth, rôle) |
| **Handler** | `src/Handlers/*-handler.ts` | Contrôleur Express : validation, appel du usecase, mapping HTTP, synchro multi-bases *best-effort* |
| **Interface Request** | `src/Handlers/Requests/*-request.ts` | Le contrat TypeScript de chaque corps de requête |
| **Validator** | `src/Handlers/Validators/*-validators.ts` | Schéma Joi **typé sur l'interface** (`Joi.object<CreateUserRequest>`) → `validation.value` typé |
| **Usecase** | `src/Usecases/*-usecase.ts` | Logique métier pure (permissions, points, votes, géométrie…), repositories **injectés par constructeur** |

**Les deux règles d'or du projet :**
1. **Aucun handler ne lit `req.body` directement** — tout champ passe par interface + Joi ;
2. **Les usecases reçoivent leurs repositories en paramètre** → testables unitairement avec des mocks.

Ajouter un endpoint = route dans `routes.ts` + interface + validator + méthode de usecase
(+ synchro Mongo/Neo4j dans le handler si besoin, chacune dans son `try/catch`).

---

## Structure du projet

```
src/
├── index.ts                 démarrage : middlewares globaux, connexions BDD, erreurs JSON
├── swagger.ts               spécification OpenAPI servie sur /api-docs
├── seed.ts                  jeu de démo — vide et repeuple les 3 bases (destructif)
├── Handlers/                routes.ts + contrôleurs + Requests/ + Validators/
├── Usecases/                logique métier (1 fichier par domaine)
├── Middleware/              JWT, rôles, rate-limit par paliers, en-têtes sécurité, crypto TOTP
├── Database/
│   ├── database.ts          les 3 DataSources (+ wrapper Neo4j maison)
│   ├── Entites_PostGreSQL/  11 tables (source de vérité, soft-delete)
│   ├── Entites_MongoDB/     8 collections (documents riches)
│   └── Entites_NEO4J/       repositories Cypher écrits à la main
├── Geo/                     géométrie des quartiers (anti-chevauchement, ray casting)
├── Pdf/                     génération du PDF de contrat (écrivain PDF maison, sans lib)
├── Query/                   langage FIND … WHERE … LIMIT (lexer + parser type lex/yacc)
├── I18n/                    erreurs bilingues { code, error }
└── Realtime/                Socket.io : présence online/offline + chat
templates/                   gabarit HTML du contrat ({{NUMERO_CONTRAT}}, {{PRIX}}…)
tests/                       393 tests — unitaires, intégration HTTP, E2E full-stack
Doc/                         documentation (sujet, architecture, entités, explications)
scripts/                     install.sh, export-bdd.sh, build-livraison.sh
```

---

## Les 3 bases de données

| Base | Rôle | Contenu |
|---|---|---|
| **PostgreSQL** | Source de vérité relationnelle (TypeORM, soft-delete) | users, quartiers (GeoJSON), services, contrats (référence), incidents, tokens, transactions de points |
| **MongoDB** | Documents riches | votes (+bulletins), messages & conversations, détails d'événements, **contrats signables** (zones, signatures, audit), profils (**solde de points**, RGPD) |
| **Neo4j** | Graphe social → moteur de **recommandations** | `A_AIDE`, `A_NOTE`, `A_PARTICIPE`, `INTERESSE_PAR`, `A_TAG`… |

Jointure logique entre les mondes : **`postgres_id`** (l'id PostgreSQL en chaîne). Pas de clé
étrangère inter-bases : l'écriture principale aboutit d'abord, les synchros secondaires sont
*best-effort*. Détail complet : `Doc/RECAP_ENTITES.md` et `Doc/Explain/08-ENTITES-3-BASES.md`.

---

## Infrastructure (production)

```
Internet ──HTTPS(443)──► Apache (Let's Encrypt, redirection 80→443)
                           ├── /            → conteneur front  (nginx, build React)
                           ├── /api         → conteneur api    (Node/Express :3000)
                           └── /socket.io   → conteneur api    (WebSocket)
Docker cn_network : api · front · postgres · mongodb · neo4j · adminer · mongo-express
```

- **7 conteneurs** ; les bases et outils d'admin ne publient leurs ports que sur `127.0.0.1`
  (jamais exposés à Internet — accès via tunnel SSH) ;
- Déploiement : **`./prod.sh`** — build des images, démarrage, vérification santé, génération de
  la conf Apache (le vhost HTTPS est régénéré automatiquement si un certificat existe), test de
  config + retour arrière en cas d'erreur ;
- Certificat **Let's Encrypt** renouvelé automatiquement (timer certbot + rechargement Apache).

---

## Sécurité

- **JWT** d'accès (1 h) + **refresh token** (30 j, en base, révoqué au logout) ; mots de passe **bcrypt** ;
- **3 rôles** (`user` / `moderateur` / `admin`) via `requireRole`, garde « dernier admin » ;
- **MFA TOTP obligatoire** pour les actions sensibles (signature, changement mdp/e-mail/tél) —
  secret **chiffré au repos (AES-256-GCM)** ; interrupteur démo `MFA_ENFORCE` ;
- **SSO** web ↔ client Java par ticket à usage unique (2 min) ;
- **Rate-limiting par paliers** (global 600/15 min + auth, sensible, écriture, upload, query) ;
- Signatures de contrat : parties uniquement, IP, horodatage, **checksum SHA-256**, journal d'audit ;
- En-têtes de sécurité sur toutes les réponses, uploads en whitelist MIME (20 Mo, nom UUID) ;
- **RGPD complet** : export des 3 bases, consentement, anonymisation + révocation des sessions.

---

## Langues (i18n)

Toute erreur renvoie **`{ code, error }`** : `code` **stable** (contrat d'API pour le front et le
client Java), `error` **traduit** selon l'en-tête `Accept-Language` — **français par défaut,
anglais supporté** (`src/I18n/i18n.ts`). Le profil utilisateur porte aussi un champ `langue`.

```bash
curl -H "Accept-Language: en" …/api/route-inconnue
# → { "code": "NOT_FOUND_ROUTE", "error": "Route not found" }
```

---

## Tests — 393 (0 échec)

| Niveau | Contenu |
|---|---|
| Unitaires | usecases (repos mockés), validators Joi, middleware JWT, géométrie, lexer/parser |
| Intégration HTTP | contrat de **toutes** les routes (401/403/400/404, en-têtes, JSON malformé) — sans BDD |
| **E2E full-stack** | parcours complet contre les **vraies bases Docker** (inscription → … → RGPD), bases d'essai isolées, skip propre sans Docker |

```bash
npm test                                            # toute la suite
node --import tsx --test tests/geo/geo.test.ts      # un fichier
```

---

## Commandes

| Commande | Rôle |
|---|---|
| `npm run DEV` | serveur de dev (hot reload) |
| `npm run build` | compilation TypeScript (stricte, `noEmitOnError`) |
| `npm test` | suite de tests complète |
| `npm run seed` | vide et repeuple les 3 bases (démo — destructif) |
| `./prod.sh` | déploiement production complet |
| `bash scripts/export-bdd.sh` | exporte les jeux d'essais (SQL / JSON / Cypher) |

---

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|---|---|---|
| `admin@admin.fr` | `compaq` | admin |
| `martin.dupont@email.fr` | `Password123!` | admin |
| `clara.petit@email.fr` | `Password123!` | modérateur |
| `sophie.bernard@email.fr` | `Password123!` | user |
