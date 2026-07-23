# Documentation technique — Petits Secrets Entre Voisins
### Application Java Desktop (JavaFX 21)

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture générale](#2-architecture-générale)
3. [Démarrage de l'application](#3-démarrage-de-lapplication)
4. [Couche données](#4-couche-données)
   - [SessionManager](#41-sessionmanager)
   - [DatabaseConnection (SQLite)](#42-databaseconnection--sqlite)
   - [ApiService (REST)](#43-apiservice--rest)
5. [Navigation et structure UI](#5-navigation-et-structure-ui)
6. [Écrans et controllers](#6-écrans-et-controllers)
   - [Dashboard (accueil)](#61-dashboard--accueil)
   - [Voisins](#62-voisins)
   - [Incidents & Signalements](#63-incidents--signalements)
   - [Statistiques](#64-statistiques)
   - [Plugins](#65-plugins)
   - [Paramètres](#66-paramètres)
   - [Profil](#67-profil)
7. [Modèles de données](#7-modèles-de-données)
8. [Mode offline-first et synchronisation](#8-mode-offline-first-et-synchronisation)
9. [Parsing JSON](#9-parsing-json)
10. [Système de thèmes](#10-système-de-thèmes)
11. [Système de plugins](#11-système-de-plugins)
12. [Mises à jour automatiques](#12-mises-à-jour-automatiques)
13. [Tests unitaires](#13-tests-unitaires)
14. [Packaging et déploiement](#14-packaging-et-déploiement)

---

## 1. Vue d'ensemble

**Petits Secrets Entre Voisins** est une application desktop Java destinée à l'administrateur d'un quartier. Elle permet de :

- Gérer les **incidents et signalements** remontés par les voisins via l'application web
- Consulter des **statistiques** de participation et d'activité du quartier
- Fonctionner **sans internet** grâce à un cache SQLite local
- S'**auto-mettre à jour** depuis un serveur central
- Être entièrement **personnalisable** (thèmes, polices, disposition)
- Être **étendue** via un système de plugins

**Stack technique :**
- Java 21 + JavaFX 21
- SQLite (base locale embarquée via `sqlite-jdbc`)
- HTTP natif Java (`java.net.http.HttpClient`)
- Authentification JWT (connexion à l'API Node.js)
- JUnit 5 + Mockito (tests)
- Maven (build, packaging, tests)

---

## 2. Architecture générale

```
┌─────────────────────────────────────────────────────┐
│                   Interface JavaFX                  │
│  primary.fxml (shell)                               │
│  ├── sidebar nav                                    │
│  └── mainContent (VBox dynamique)                   │
│       ├── voisins-list.fxml                         │
│       ├── incidents-list.fxml                       │
│       ├── statistiques-panel.fxml                   │
│       ├── plugins-panel.fxml                        │
│       ├── settings-panel.fxml                       │
│       └── profile-panel.fxml                        │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐           ┌────────▼────────┐
│   ApiService   │           │DatabaseConnection│
│  (REST HTTP)   │           │    (SQLite)      │
│                │           │                 │
│ GET /users     │           │ cached_users    │
│ GET /incidents │           │ local_incidents │
│ GET /signal.   │           │ local_incidents │
│ PUT /traiter   │           │   _api          │
│ GET /stats/... │           │ pending_reports │
│ POST /auth/... │           │ offline_contract│
└───────┬────────┘           └────────┬────────┘
        │                             │
        └──────────┬──────────────────┘
                   │
           ┌───────▼────────┐
           │ SessionManager │
           │  (JWT token)   │
           └────────────────┘
```

**Principes clés :**
- L'app tente toujours l'API en premier. En cas d'échec, elle bascule sur SQLite.
- Toutes les mises à jour de l'UI après un appel asynchrone passent par `Platform.runLater()`.
- Les parseurs JSON utilisent des regex (pas de bibliothèque externe) via la classe `JsonParser`.

---

## 3. Démarrage de l'application

**Fichiers concernés :** `App.java`, `Launcher.java`

`Launcher` est le point d'entrée du JAR (classe `main` déclarée dans le `pom.xml`). Il délègue immédiatement à `App`.

`App` étend `javafx.application.Application` et fait dans `start()` :
1. `DatabaseConnection.startup()` — crée/migre la base SQLite locale
2. `PluginManager.getInstance()` — instancie les plugins au démarrage
3. Charge `login.fxml` comme première vue
4. Applique le thème sauvegardé via `ThemeManager.getInstance().applyTo(scene)`
5. Affiche la fenêtre

`Launcher` existe pour contourner une contrainte du module JavaFX : la classe `main` dans un JAR fat ne peut pas étendre `Application` directement sans être dans le module path.

---

## 4. Couche données

### 4.1 SessionManager

**Fichier :** `database/SessionManager.java`

Singleton qui maintient l'état de la session en mémoire :

| Champ | Type | Rôle |
|---|---|---|
| `accessToken` | `String` | JWT renvoyé par `/auth/login` |
| `adminEmail` | `String` | Email de l'admin connecté |
| `loginTime` | `LocalDateTime` | Horodatage de connexion |

Méthodes importantes :
- `isLoggedIn()` — retourne `true` si `accessToken != null`, utilisé partout pour choisir API vs cache
- `logout()` — efface le token et le timestamp
- `setRefreshToken()` — stocke le refresh token SSO (non encore exploité)

### 4.2 DatabaseConnection — SQLite

**Fichier :** `database/DatabaseConnection.java`

Base de données locale à `Data/data.db` (chemin relatif au répertoire d'exécution).

**Tables créées au démarrage (`startup()`) :**

| Table | Contenu |
|---|---|
| `cached_users` | Cache des voisins (email, rôle, adresse, ville) |
| `local_incidents` | Cache des signalements (`/signalements`) |
| `local_incidents_api` | Cache des incidents (`/incidents`) |
| `pending_reports` | Rapports créés hors ligne, en attente de sync |
| `offline_contracts` | Contrats créés hors ligne |

La méthode `addColumnIfMissing()` gère la **migration douce** : si la base existait déjà sans certaines colonnes, elles sont ajoutées sans erreur.

**Pattern utilisé pour les caches :**
```
cacheXxx(List<T>)          → vide la table puis réinsère en batch (transaction)
loadCachedXxx()            → lit depuis SQLite, retourne une List<T>
```

**Gestion des rapports offline :**
```
savePendingReport()        → INSERT dans pending_reports
loadPendingReports()       → SELECT tous les rapports non synchronisés
deletePendingReport(id)    → DELETE après sync réussie
countPendingReports()      → COUNT pour le badge UI
```

### 4.3 ApiService — REST

**Fichier :** `database/ApiService.java`

Client HTTP utilisant `java.net.http.HttpClient` (Java 11+). Timeout de connexion : 5 secondes.

**Base URL :** `http://51.77.245.139:3000`

Toutes les méthodes retournent des `CompletableFuture<T>` pour ne pas bloquer le thread JavaFX.

**Endpoints utilisés :**

| Méthode | Endpoint | Description |
|---|---|---|
| `login()` | `POST /auth/login` | Authentification, stocke le JWT |
| `exchangeSSOTicket()` | `POST /auth/sso/exchange` | Échange ticket SSO contre JWT |
| `fetchVoisinsFromServer()` | `GET /users` | Liste des voisins |
| `fetchSignalements()` | `GET /signalements` | Liste des signalements |
| `fetchIncidents()` | `GET /incidents` | Liste des incidents |
| `traiterSignalement()` | `PUT /signalements/{id}/traiter` | Marque un signalement résolu |
| `updateIncidentStatut()` | `PUT /incidents/{id}/statut` | Marque un incident résolu |
| `postSignalement()` | `POST /signalements` | Crée un signalement |
| `postIncident()` | `POST /incidents` | Crée un incident |
| `fetchStatsIncidents()` | `GET /stats/incidents` | Stats des incidents |
| `fetchStatsParticipations()` | `GET /stats/participations` | Stats de participation |
| `fetchPresenceUsers()` | `GET /presence` | Utilisateurs en ligne |
| `pullChangements()` | `GET /sync` | Synchronisation |

**Authentification :** chaque requête injecte `Authorization: Bearer <token>` si connecté.

**Valeurs acceptées par l'API pour le champ `statut` :**
- À la création d'un incident : ne pas envoyer `statut` (géré par le serveur)
- Pour résoudre : `resolu`
- Valeurs valides : `ouvert`, `en_cours`, `resolu`, `ferme`

---

## 5. Navigation et structure UI

**Fichiers :** `primary.fxml`, `PrimaryController.java`

`primary.fxml` est le **shell** permanent de l'application. Il contient :
- Une **sidebar** avec les boutons de navigation
- Un `VBox mainContent` qui est vidé et rechargé à chaque changement de vue

`PrimaryController` :
- Expose `public static PrimaryController instance` pour permettre la navigation depuis d'autres controllers (ex : depuis `StatistiquesController` vers `VoisinsController`)
- Charge les sous-vues avec `loadView(String fxmlName)` via `FXMLLoader`
- Gère les stats du dashboard en mode online et offline
- Déclenche la vérification de mise à jour au démarrage (`UpdateService.checkAndPrompt(true)`)

**Méthode de navigation publique exposée :**
```java
public void navigateToVoisins()  // appelée depuis StatistiquesController
```

---

## 6. Écrans et controllers

### 6.1 Dashboard — Accueil

**Controller :** intégré dans `PrimaryController` + `DashboardController`

Affiche à la connexion :
- Nombre de voisins inscrits / en ligne
- Nombre d'incidents ouverts / résolus
- Liste des 5 derniers signalements et incidents

En mode online, toutes les données sont chargées en parallèle via `CompletableFuture.allOf()`. En mode offline, les compteurs viennent du SQLite local.

### 6.2 Voisins

**Fichiers :** `voisins-list.fxml`, `VoisinsController.java`

Affiche la liste de tous les voisins dans un `TableView` avec colonnes :
- Email
- Statut (rôle)
- Adresse (quartier + ville)

Les données viennent de `GET /users`. En cas d'échec réseau, l'app affiche le cache SQLite. Les voisins fraîchement chargés sont mis en cache (`DatabaseConnection.cacheUsers()`).

### 6.3 Incidents & Signalements

**Fichiers :** `incidents-list.fxml`, `IncidentsController.java`

Deux tableaux distincts :
- **Signalements** (source : `GET /signalements`) — remontés par les voisins
- **Incidents** (source : `GET /incidents`) — créés manuellement

**Bouton "Traiter"** sur chaque ligne : désactivé pour les lignes déjà résolues ou créées hors ligne. Appelle `ApiService.traiterSignalement()` ou `ApiService.updateIncidentStatut()` avec `statut: resolu`.

**Création hors ligne :** si le réseau est absent, le rapport est sauvegardé dans `pending_reports` et affiché localement en orange ("Hors ligne").

**Barre de synchronisation :** affichée en haut si des rapports sont en attente. Le bouton "Synchroniser maintenant" les envoie un par un via `syncNext()` (récursif asynchrone, sans boucle bloquante).

**Auto-sync au démarrage :** si l'utilisateur est connecté ET qu'il y a des rapports en attente, la sync se déclenche automatiquement.

### 6.4 Statistiques

**Fichiers :** `statistiques-panel.fxml`, `StatistiquesController.java`

Quatre graphiques chargés en parallèle :

| Graphique | Type | Données |
|---|---|---|
| Répartition incidents | `PieChart` | En cours / Résolus (signalements + incidents) |
| Voisins par rôle | `BarChart` | Comptage par rôle (admin, habitant…) |
| Évolution | `LineChart` | Ouverts vs résolus par source |
| Participations | `BarChart` | Nombre de participations par utilisateur |

**Graphique de participations interactif :**
- Axe X : partie avant `@` de l'email (ex: `jean.dupont`)
- Tooltip au survol : email complet + nombre de participations
- Clic sur une barre : ouvre un dialogue de confirmation puis navigue vers la liste des Voisins

Labels de statistiques : total événements, participations confirmées / intéressées / déclinées.

### 6.5 Plugins

**Fichiers :** `plugins-panel.fxml`, `PluginsController.java`

Affiche la liste des plugins disponibles (fournie par `PluginManager`). Chaque plugin est représenté par une carte avec son nom, sa description et un bouton "Lancer" qui appelle `plugin.execute()`.

### 6.6 Paramètres

**Fichiers :** `settings-panel.fxml`, `SettingsController.java`

Trois sections de personnalisation :
- **Thème** — 4 thèmes : Nuit, Aube, Marine, Forêt
- **Taille de police** — Compacte, Normale, Grande
- **Disposition** — Compacte, Normale, Aérée

Une section **Mises à jour** : affiche la version actuelle et propose une vérification manuelle.

Une section **Désinstallation** (zone rouge) : supprime le raccourci bureau, retire l'entrée du registre Windows, génère un script `.bat` en TEMP qui supprime les fichiers après la fermeture du JAR.

### 6.7 Profil

**Fichiers :** `profile-panel.fxml`, `ProfileController.java`

Affiche les informations de l'administrateur connecté (email, mode de connexion).

---

## 7. Modèles de données

**Package :** `com.neighborhood_manager.models`

Tous les modèles sont des **POJO** (Plain Old Java Objects) avec getters et setters. Les getters doivent respecter la convention JavaFX (`getXxx()`) car `PropertyValueFactory` dans les `TableView` les trouve par réflexion.

### `Incident`
Représente un **signalement** (`/signalements`).

| Champ | Type | Description |
|---|---|---|
| `id_signalement` | `int` | Identifiant API |
| `motif` | `String` | Description du signalement |
| `statut` | `String` | `"En cours"` ou `"Résolu"` (converti à l'affichage) |

### `IncidentEntry`
Représente un **incident** (`/incidents`).

| Champ | Type | Description |
|---|---|---|
| `id` | `int` | Identifiant API |
| `description` | `String` | Description de l'incident |
| `statut` | `String` | `"En cours"` ou `"Résolu"` |
| `email` | `String` | Email du créateur |
| `createdAt` | `String` | Date de création (ISO partielle) |

Le constructeur protège contre les `null` : chaque champ null est remplacé par une valeur par défaut.

### `User`
Représente un **voisin** (`/users`).

| Champ | Type | Description |
|---|---|---|
| `id_user` | `int` | Identifiant API |
| `email` | `String` | Email |
| `role` | `String` | `habitant`, `admin`, `moderateur`… |
| `adresse` | `String` | `"nom_quartier - ville"` (assemblé au parsing) |
| `ville` | `String` | Ville extraite du JSON |

### `PendingReport`
Rapport créé hors ligne, stocké dans `pending_reports`.

| Champ | Type | Description |
|---|---|---|
| `id` | `int` | Clé SQLite auto-incrémentée |
| `type` | `String` | `"signalement"` ou `"incident"` |
| `description` | `String` | Contenu du rapport |
| `cibleType` | `String` | Pour les signalements : `message`, `service`… |
| `cibleId` | `String` | ID de la cible |
| `createdAt` | `String` | Horodatage SQLite |

---

## 8. Mode offline-first et synchronisation

L'application est conçue pour fonctionner **même sans internet**.

**Flux de démarrage :**
```
PrimaryController.initialize()
  └── SessionManager.isLoggedIn() ?
        ├── OUI → appels API (+ mise en cache des résultats)
        │          → si échec réseau : fallback SQLite
        └── NON → lecture directe SQLite
```

**Création de données hors ligne :**
```
Utilisateur crée un incident/signalement
  └── SessionManager.isLoggedIn() ?
        ├── OUI → POST API
        │          → si échec réseau : savePendingReport()
        └── NON → savePendingReport()
                   → badge "X rapport(s) en attente" visible
```

**Synchronisation :**
- Auto au démarrage si connecté + rapports en attente
- Manuelle via bouton "Synchroniser maintenant"
- Méthode `syncNext()` : traite les rapports un par un de façon récursive asynchrone (évite de bloquer l'UI et d'appeler `syncPending()` dans une boucle)
- Après sync : `deletePendingReport()` sur chaque succès, puis rechargement des données

---

## 9. Parsing JSON

**Fichier :** `JsonParser.java`

L'application **n'utilise pas de bibliothèque JSON** (pas de Jackson, Gson, etc.). Tout le parsing est fait en regex sur les chaînes brutes retournées par l'API.

**Pourquoi les regex ?** Contrainte du projet JPMS — ajouter une bibliothèque JSON aurait nécessité des configurations de modules supplémentaires.

**Méthodes disponibles :**

| Méthode | Entrée | Sortie |
|---|---|---|
| `parseSignalements(json)` | JSON `/signalements` | `List<Incident>` |
| `parseIncidents(json)` | JSON `/incidents` | `List<IncidentEntry>` |
| `parseUsers(json)` | JSON `/users` | `List<User>` |
| `parseRoles(json)` | JSON `/users` | `Map<String, Integer>` (rôle → count) |
| `parseUserEmailsById(json)` | JSON `/users` | `Map<Integer, String>` (id → email) |
| `parseParUtilisateur(json)` | JSON `/stats/participations` | `Map<Integer, Integer>` (id → participations) |

**Conversion des statuts :**
- `"ouvert"` → `"En cours"` (affiché à l'écran)
- Tout autre valeur → `"Résolu"`

**Attention au parsing des signalements :** le JSON contient des objets imbriqués (`signaleur`). Le split se fait sur `{"id_signalement"` pour isoler chaque bloc sans capturer les objets enfants.

---

## 10. Système de thèmes

**Fichier :** `ThemeManager.java`

Singleton qui gère la personnalisation visuelle complète. Les préférences sont persistées via `java.util.prefs.Preferences` (registre Windows).

**Trois axes de personnalisation :**

| Enum | Valeurs | Fichier CSS |
|---|---|---|
| `Theme` | NUIT, AUBE, MARINE, FORET | `theme-nuit.css`, `theme-aube.css`, `theme-marine.css`, `theme-foret.css` |
| `FontSize` | COMPACT, NORMAL, LARGE | `font-compact.css`, *(rien)*, `font-large.css` |
| `Layout` | COMPACT, NORMAL, AIRY | `layout-compact.css`, *(rien)*, `layout-airy.css` |

**Application des CSS :** `applyTo(Scene)` vide tous les stylesheets puis empile :
1. `style.css` (base, toujours appliqué)
2. CSS du thème de couleurs
3. CSS de la taille de police (si non-normal)
4. CSS de la disposition (si non-normal)

**Variables CSS :** les thèmes utilisent des variables JavaFX (`nm-primary`, `nm-accent`, `nm-card-bg`, etc.) définies dans chaque fichier de thème, permettant aux FXML de rester génériques.

---

## 11. Système de plugins

**Fichiers :** `plugins/Plugin.java`, `plugins/PluginManager.java`, `plugins/ExportStatPlugin.java`, `plugins/AnalyseSocialePlugin.java`, `plugins/CalendrierPlugin.java`

### Interface Plugin

```java
public interface Plugin {
    String getName();
    String getDescription();
    void execute();
}
```

`execute()` est responsable d'ouvrir sa propre fenêtre modale — les plugins sont autonomes.

### PluginManager

Singleton qui instancie les 3 plugins au démarrage. La liste est en lecture seule (`Collections.unmodifiableList`). **Pour ajouter un plugin :** implémenter `Plugin` et ajouter une instance dans le constructeur de `PluginManager`.

### ExportStatPlugin
Ouvre une fenêtre modale qui :
1. Charge en parallèle `/signalements` et `/users` via `CompletableFuture.thenCombine()`
2. Affiche un aperçu formaté (tableau texte monospace)
3. Exporte en CSV (séparateur `;`, BOM UTF-8 pour Excel) via un `FileChooser`

### AnalyseSocialePlugin
Ouvre une fenêtre avec un graphique en barres croisant incidents + utilisateurs + présence.

### CalendrierPlugin
Affiche un calendrier local des événements du quartier.

---

## 12. Mises à jour automatiques

**Fichiers :** `UpdateService.java`, `version.properties`

### Fonctionnement

Au démarrage (après connexion), `UpdateService.checkAndPrompt(true)` est appelé en arrière-plan.

**Flux complet :**
```
1. Lecture de la version locale  → version.properties → app.version=1.0
2. GET /app/version              → {"version":"1.1","url":"http://..."}
3. Comparaison                   → 1.1 > 1.0 ?
4. OUI → Dialogue de confirmation
5. Téléchargement du nouveau JAR (dans %TEMP%)
6. Écriture d'un script psv_update.bat dans %TEMP%
7. Lancement du script + Platform.exit()
8. Le script attend la fermeture du process Java
9. Copie le nouveau JAR à la place de l'ancien
10. Relance l'app avec javaw -jar
```

### Modes de vérification

| Appel | Comportement |
|---|---|
| `checkAndPrompt(true)` | Silencieux si à jour — utilisé au démarrage |
| `checkAndPrompt(false)` | Toujours affiche le résultat — utilisé depuis Settings |

### Détection dev vs production

`getCurrentJarFile()` regarde si la `CodeSource` pointe vers un `.jar`. Si c'est un dossier (mode développement Maven), la mise à jour est ignorée gracieusement.

### Endpoint serveur requis

```
GET /app/version → {"version": "1.1", "url": "http://51.77.245.139:3000/app/download"}
GET /app/download → sert le fichier JAR
```

---

## 13. Tests unitaires

**Framework :** JUnit 5 (`junit-jupiter`) + Mockito 5

**Localisation :** `src/test/java/com/neighborhood_manager/`

**Lancement :**
```bash
cd neighbordhood-manager
mvn test
```

### JsonParserTest (16 tests)
Teste chaque méthode de `JsonParser` avec des JSON représentatifs :
- Parsing correct (taille de liste, valeurs extraites)
- Conversion des statuts (`ouvert` → `"En cours"`, autres → `"Résolu"`)
- Gestion du JSON vide (liste vide retournée)
- Assemblage de l'adresse (quartier + ville)
- Extraction de la map `parUtilisateur`

### ModelTest (6 tests)
Teste les 3 modèles principaux :
- Getters/setters de `Incident`, `IncidentEntry`, `User`
- Protection contre les `null` dans `IncidentEntry`

### UpdateServiceTest (3 tests)
- `getCurrentVersion()` retourne une valeur non nulle et parseable en `Double`
- `checkForUpdate()` ne plante pas si le serveur est injoignable (retourne `null`)

### Configuration Maven (pom.xml)

Le plugin `maven-surefire-plugin` 3.2.5 est configuré avec des `--add-exports` et `--add-opens` pour permettre l'accès aux classes du module JPMS depuis les tests (classpath unnamed module) :
```xml
--add-exports com.neighborhood_manager/com.neighborhood_manager=ALL-UNNAMED
--add-exports com.neighborhood_manager/com.neighborhood_manager.models=ALL-UNNAMED
```

**Note SSL Windows :** si Avast (ou un autre antivirus) intercepte le HTTPS, Maven ne peut pas télécharger les dépendances. Solution : désactiver le Web Shield HTTPS dans Avast, ou lancer avec `mvn test --offline` une fois les artifacts en cache.

---

## 14. Packaging et déploiement

### Génération du JAR

```bash
cd neighbordhood-manager
mvn package
```

Le plugin `maven-shade-plugin` génère un **fat JAR** dans `target/` avec :
- Toutes les dépendances incluses (JavaFX natif Windows, SQLite, ikonli…)
- Classe principale : `com.neighborhood_manager.Launcher`
- Module-info exclus du JAR final (incompatible avec le shading)
- Signatures cryptographiques META-INF supprimées

### Scripts d'installation

| Fichier | Rôle |
|---|---|
| `install.bat` | Copie le JAR dans `%LOCALAPPDATA%\PetitsSecretsVoisins`, crée un raccourci Bureau, ajoute une entrée dans le registre Windows (Programme > Désinstaller) |
| `uninstall.bat` | Supprime le dossier d'installation et le raccourci |
| `build-installer.ps1` | Script PowerShell qui compile, package et prépare le dossier installeur |

### Désinstallation depuis l'interface

Dans Settings → Section rouge "Désinstallation" :
1. Confirmation utilisateur
2. Suppression du raccourci Bureau
3. Suppression de la clé de registre `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\PetitsSecretsVoisins`
4. Génération de `%TEMP%\uninstall_psv.bat` — script en boucle qui attend que le JAR soit libéré, puis supprime `%LOCALAPPDATA%\PetitsSecretsVoisins`
5. Lancement du script + `Platform.exit()`

### Dossier installer/

Contient une copie compilée de l'application (classes + ressources) pour la distribution, à l'intérieur de `installer/PetitsSecretsVoisins/app/`.

---

*Documentation générée le 23/07/2026 — version application 1.0*
