# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All Maven commands must be run from `neighbordhood-manager/` (where `pom.xml` lives):

```bash
cd neighbordhood-manager

# Run the app
mvn javafx:run

# Compile only
mvn compile

# Run tests
mvn test

# Run a single test class
mvn test -Dtest=MyTestClass

# Package
mvn package
```

## Architecture

This is a JavaFX 21 desktop application ("Petits secrets Entre Voisins") — a neighborhood management tool for an admin user.

### Data layer

The app runs in two modes depending on API reachability:

- **Online**: REST API at `http://51.77.245.139:3000` (Node.js backend). Auth is JWT — `ApiService.login()` stores the token in `SessionManager`. All API calls in `ApiService` inject the token via `Authorization: Bearer`.
- **Offline fallback**: SQLite database at `Data/data.db` (relative to the working directory). `DatabaseConnection.startup()` creates it on first launch with tables: `offline_contracts`, `cached_users`, `local_incidents`.

`ApiService` uses Java's built-in `HttpClient` with `CompletableFuture`. There is **no JSON library** — all parsing is done with manual regex splitting on raw JSON strings.

### Navigation / view loading

`primary.fxml` is the shell — a sidebar nav + a `VBox mainContent` container. `PrimaryController` loads sub-views by replacing `mainContent`'s children with FXML panels:

```
primary.fxml         → PrimaryController   (shell + auto-login)
voisins-list.fxml    → VoisinsController   (neighbors table)
incidents-list.fxml  → IncidentsController (incident reports + "Traiter" action)
plugins-panel.fxml   → PluginsController
settings-panel.fxml  → SettingsController
profile-panel.fxml   → ProfileController
```

`DashboardController` handles the stats widgets embedded inside `primary.fxml` (not a separate panel).

On startup, `PrimaryController.initialize()` automatically logs in with hardcoded admin credentials. If that fails, it falls back to offline mode with SQLite counts.

### Theming

`ThemeManager` (singleton) stacks CSS files onto the JavaFX `Scene`:

1. `style.css` — base styles always applied
2. A color theme (`themes/theme-nuit.css`, `theme-aube.css`, `theme-marine.css`, `theme-foret.css`)
3. Optional font size override (`themes/font-compact.css`, `font-large.css`)
4. Optional layout override (`themes/layout-compact.css`, `layout-airy.css`)

Preferences persist via `java.util.prefs.Preferences`. Default theme is `NUIT`.

### Plugin system

`Plugin` is an interface with `getName()`, `getDescription()`, and `execute()`. `PluginManager` (singleton) statically registers three plugins at startup:

- `ExportStatPlugin` — exports stats
- `AnalyseSocialePlugin` — bar chart modal with live API data (incidents + users + presence)
- `CalendrierPlugin` — calendar view

To add a plugin: implement `Plugin`, then add an instance to `PluginManager`'s constructor.

### Models

`User` and `Incident` are plain POJOs with getters. They must expose JavaFX-compatible getters (e.g., `getMotif()`, `getStatut()`) because `PropertyValueFactory` in `TableView` binds by getter name via reflection.

## Key constraints

- The JPMS module descriptor (`module-info.java`) is required. New packages used by FXML controllers must be opened: `opens com.neighborhood_manager.newpkg to javafx.fxml;`.
- JSON is parsed with regex, not a library — be careful with nested objects (the incident parser splits on `{"id_signalement"` to avoid hitting nested `signaleur` objects).
- All UI updates after async `CompletableFuture` calls must be wrapped in `Platform.runLater()`.
- The SQLite driver is loaded by JDBC auto-discovery; the module `sqlite.jdbc` line in `module-info.java` is intentionally commented out.