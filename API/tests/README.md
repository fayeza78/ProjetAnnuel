# Tests unitaires

Tests de l'API, basés sur le **test runner intégré de Node.js** (`node:test` + `node:assert`) exécuté via **tsx**. Les tests **unitaires** ne requièrent aucune base de données (tout est mocké). Les tests d'**intégration HTTP** utilisent `supertest` (devDependency) et n'exercent que les chemins ne touchant pas de BDD (route publique, `401` token manquant, `403` mauvais rôle, `400` validation).

## Lancer les tests

```bash
# Toute la suite
node --import tsx --test "tests/**/*.test.ts"

# Un fichier précis
node --import tsx --test tests/usecases/vote-usecase.test.ts

# En mode watch
node --import tsx --test --watch "tests/**/*.test.ts"
```

> Astuce : vous pouvez ajouter `"test": "node --import tsx --test \"tests/**/*.test.ts\""` dans les `scripts` de `package.json` pour lancer simplement `npm test`.

## Organisation

```
tests/
├── helpers/
│   └── mockRepository.ts      # fabrique un faux Repository TypeORM (mock.fn)
├── validators/                # schémas Joi (tests purs, sans mock)
│   ├── user-validators.test.ts
│   ├── service-validators.test.ts
│   ├── vote-validators.test.ts
│   ├── evenement-validators.test.ts
│   ├── contrat-validators.test.ts
│   ├── message-validators.test.ts
│   ├── incident-validators.test.ts
│   ├── quartier-validators.test.ts
│   ├── signalement-validators.test.ts
│   └── misc-validators.test.ts    # refresh/SSO/vote-block/consentement/query/terminer/sync/compétence
├── middleware/
│   ├── auth-middleware.test.ts  # authenticateToken + requireRole (JWT réel)
│   └── rate-limit.test.ts       # 429 après dépassement (supertest)
├── query/
│   └── query-language.test.ts   # lexer/parser du langage maison (pur)
├── pdf/
│   └── contrat-pdf.test.ts      # génération du contrat : gabarit HTML (balises, anti-XSS)
│                                #  + écrivain PDF maison (magic bytes, zones, checksum) (pur)
├── geo/
│   └── geo.test.ts              # parse GeoJSON + point-dans-polygone + chevauchement (pur)
├── integration/
│   ├── api.integration.test.ts  # premiers tests routing/middleware/validation (supertest, sans BDD)
│   └── routes.e2e.test.ts       # contrat HTTP de TOUTES les routes : 401/403/400/404, en-têtes… (sans BDD)
├── e2e-full/
│   └── app.e2e.test.ts          # ⭐ E2E FULL-STACK « A→Z » contre les VRAIES bases Docker (voir §E2E)
└── usecases/                    # logique métier avec repositories mockés
    ├── user-usecase.test.ts
    ├── auth-usecase.test.ts
    ├── mfa-usecase.test.ts         # MFA TOTP (otplib réel) + secret chiffré au repos
    ├── reset-password.test.ts      # mot de passe oublié (ticket usage unique, expiration)
    ├── quartier-usecase.test.ts
    ├── service-usecase.test.ts     # + terminerService / points (MongoDB mocké)
    ├── incident-usecase.test.ts
    ├── competence-usecase.test.ts
    ├── signalement-usecase.test.ts
    ├── stats-usecase.test.ts       # MongoDB mocké via mock.method
    ├── sync-usecase.test.ts        # pull/push + résolution de conflits
    ├── evenement-usecase.test.ts   # MongoDB mocké via mock.method
    └── vote-usecase.test.ts        # MongoDB mocké via mock.method
```

## Stratégie

- **Validators** : on vérifie chaque règle Joi (champs requis, formats, enums, longueurs, valeurs par défaut).
- **Usecases** : on injecte de faux repositories (`createMockRepository`) pour tester la logique métier en isolation — permissions (admin/moderateur/auteur), cas « introuvable » (`null`/`false`), comptage des votes, anti-doublons, etc.
- **Usecases MongoDB** (`vote`, `evenement`) : le singleton `AppDataSource_MongoDB.getRepository` est remplacé par `mock.method` pour ne pas dépendre d'une vraie base.
- **Middleware** : on signe de vrais JWT avec un secret de test pour vérifier l'acceptation/refus.

## Couverture actuelle

**~350 tests** au total :
- les 9 validators, le middleware d'authentification + le rate limiting, le langage de requête maison ;
- 12 usecases (dont MFA, stats, sync, signalements, **points + solde négatif**) ;
- le module **géo** (`geo.test.ts` : parse GeoJSON, point-dans-polygone, détection de chevauchement) ;
- la **génération du contrat PDF** (`pdf/contrat-pdf.test.ts` : gabarit HTML rempli sans balise
  restante, échappement anti-XSS, PDF valide, cadres de signature aux coordonnées des zones,
  checksum SHA-256 du fichier écrit) ;
- une **suite E2E HTTP** (`routes.e2e.test.ts`) qui monte l'app comme en prod (en-têtes de sécurité,
  parseur JSON, 404/erreurs JSON) et vérifie le **contrat de chaque route** : `401` sans token, `403`
  mauvais rôle, `400` corps invalide / identifiant non numérique, routes publiques, 404, JSON malformé,
  token expiré / mauvais secret, en-têtes de sécurité. Les limites de débit sont relevées via les
  variables `RL_*` pendant les tests.

## ⭐ E2E full-stack « A→Z » (`tests/e2e-full/app.e2e.test.ts`)

La suite qui teste **toute l'application contre les vraies bases Docker** (PostgreSQL + MongoDB +
Neo4j de `docker-compose`). Elle démarre l'app **exactement comme en production** et déroule le
parcours complet :

> inscription → login → quartiers (**polygone GeoJSON + chevauchement → 409**) → centres d'intérêt
> → offre de service → **recommandations Neo4j réelles** (services/voisins/événements) → demande +
> **contrat automatique** → activation **MFA** (setup + verify avec un **TOTP réel**) → signature
> (sans code — la MFA ne couvre plus la signature) →
> double-signature refusée → archivage → **transfert de points** (998/1002) → notation d'un voisin
> → événement (swipe, commentaire, photo, tag + permissions) → votes (1 seul vote, option fantôme,
> clôture, **blocage modération**) → messagerie (accès membre/403 intrus) → incidents + **SYNC
> pull/push/conflit `kept_server`** + stats → **i18n fr/en** → **SSO usage unique** → **mot de passe
> oublié** (ticket 15 min, rejeu refusé) → **RGPD** (export puis effacement → login impossible) →
> langage de requête → upload (PDF ✅ / HTML → 415).

**Isolation — ne touche PAS aux données de démo :**
- PostgreSQL → base dédiée `connected_neighbours_e2e` (créée automatiquement) ;
- MongoDB → base dédiée `Neighbours_e2e` ;
- Neo4j (pas de multi-base en community) → **plage d'IDs ≥ 900000** (séquences PG décalées) et
  nettoyage ciblé (`postgres_id ≥ 900000` + tags `e2e*`) avant/après la suite.

**Exécution :** `docker compose up -d` puis `npm test`. Si les bases sont injoignables, la suite se
marque **skipped** (elle ne casse pas `npm test` sur une machine sans Docker).

Autres pistes : mocks plus poussés pour `gdpr-usecase`, `contrat-usecase`, `message-usecase`
(orchestration multi-bases) ; mesure de couverture via `node --test --experimental-test-coverage`.
