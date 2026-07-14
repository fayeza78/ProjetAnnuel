package com.neighborhood_manager.database;
import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;
import com.neighborhood_manager.models.PendingReport;
import com.neighborhood_manager.models.User;


public class DatabaseConnection {
    private static final String SQL_LITE_URL    =  "jdbc:sqlite:Data/data.db";
    private static final String POSTGRESQL_URL  =  "jdbc:postgresql://51.77.245.139:5432/connected_neighbours";


    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(SQL_LITE_URL);
    }


    public static void startup() {
        try {
            File directory = new File("Data");
            if (!directory.exists()) {
                directory.mkdir();
            }

            try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
                // table pour les contract en mode offline
                String sqlContrats = "CREATE TABLE IF NOT EXISTS offline_contracts (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "resident_name TEXT NOT NULL," +
                        "service_type TEXT," +
                        "status TEXT DEFAULT 'PENDING'," +
                        "content BLOB," +
                        "created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP" +
                        ");";

                // table pour le cache des utilisateurs (voisins)
                String sqlUsers = "CREATE TABLE IF NOT EXISTS cached_users (" +
                        "id TEXT PRIMARY KEY," +
                        "email TEXT," +
                        "role TEXT," +
                        "adresse TEXT," +
                        "ville TEXT" +
                        ");";
                // table pour le cache des signalements (/signalements)
                String sqlIncidents = "CREATE TABLE IF NOT EXISTS local_incidents (" +
                        "id TEXT PRIMARY KEY," +
                        "description TEXT NOT NULL," +
                        "status TEXT DEFAULT 'PENDING'" +
                        ");";
                // table pour le cache des incidents (/incidents)
                String sqlIncidentsApi = "CREATE TABLE IF NOT EXISTS local_incidents_api (" +
                        "id TEXT PRIMARY KEY," +
                        "description TEXT," +
                        "status TEXT DEFAULT 'ouvert'," +
                        "email TEXT," +
                        "created_at TEXT" +
                        ");";
                // table pour les rapports créés hors ligne, en attente de sync
                String sqlPending = "CREATE TABLE IF NOT EXISTS pending_reports (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "type TEXT NOT NULL," +
                        "description TEXT NOT NULL," +
                        "cible_type TEXT," +
                        "cible_id TEXT," +
                        "created_at TEXT" +
                        ");";
                stmt.execute(sqlContrats);
                stmt.execute(sqlUsers);
                stmt.execute(sqlIncidents);
                stmt.execute(sqlIncidentsApi);
                stmt.execute(sqlPending);

                // Migration douce : ajoute les colonnes manquantes si la base existe déjà
                addColumnIfMissing(stmt, "cached_users", "role", "TEXT");
                addColumnIfMissing(stmt, "cached_users", "adresse", "TEXT");
                addColumnIfMissing(stmt, "cached_users", "ville", "TEXT");
            }
        } catch (SQLException e) {
            System.err.println("Erreur lors de l'initialisation SQLite : " + e.getMessage());
        }

    }

    private static void addColumnIfMissing(Statement stmt, String table, String column, String type) {
        try {
            stmt.execute("ALTER TABLE " + table + " ADD COLUMN " + column + " " + type);
        } catch (SQLException ignored) {
            // La colonne existe déjà : rien à faire.
        }
    }

    /* ===================== Cache des voisins (utilisateurs) ===================== */

    /** Remplace le cache local des voisins par la liste fournie (données fraîches de l'API). */
    public static void cacheUsers(List<User> users) {
        String sql = "INSERT OR REPLACE INTO cached_users (id, email, role, adresse, ville) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try (Statement clear = conn.createStatement()) {
                clear.execute("DELETE FROM cached_users");
            }
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (User u : users) {
                    ps.setString(1, String.valueOf(u.getId_user()));
                    ps.setString(2, u.getEmail());
                    ps.setString(3, u.getRole());
                    ps.setString(4, u.getAdresse());
                    ps.setString(5, u.getVille());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
            System.out.println("[Cache SQLite] " + users.size() + " voisins mis en cache.");
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur mise en cache voisins : " + e.getMessage());
        }
    }

    /** Charge les voisins depuis le cache SQLite (mode offline). */
    public static List<User> loadCachedUsers() {
        List<User> list = new ArrayList<>();
        String sql = "SELECT id, email, role, adresse, ville FROM cached_users";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                int id = 0;
                try { id = Integer.parseInt(rs.getString("id")); } catch (NumberFormatException ignored) {}
                list.add(new User(
                        id,
                        rs.getString("email"),
                        rs.getString("role"),
                        rs.getString("adresse"),
                        rs.getString("ville")));
            }
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur lecture voisins : " + e.getMessage());
        }
        return list;
    }

    /* ===================== Cache des incidents (signalements) ===================== */

    /** Remplace le cache local des incidents par la liste fournie (données fraîches de l'API). */
    public static void cacheIncidents(List<Incident> incidents) {
        String sql = "INSERT OR REPLACE INTO local_incidents (id, description, status) VALUES (?, ?, ?)";
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try (Statement clear = conn.createStatement()) {
                clear.execute("DELETE FROM local_incidents");
            }
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (Incident inc : incidents) {
                    ps.setString(1, String.valueOf(inc.getId_signalement()));
                    ps.setString(2, inc.getMotif());
                    ps.setString(3, inc.getStatut());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
            System.out.println("[Cache SQLite] " + incidents.size() + " incidents mis en cache.");
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur mise en cache incidents : " + e.getMessage());
        }
    }

    /** Charge les signalements depuis le cache SQLite (mode offline). */
    public static List<Incident> loadCachedIncidents() {
        List<Incident> list = new ArrayList<>();
        String sql = "SELECT id, description, status FROM local_incidents";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                int id = 0;
                try { id = Integer.parseInt(rs.getString("id")); } catch (NumberFormatException ignored) {}
                list.add(new Incident(id, rs.getString("description"), rs.getString("status")));
            }
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur lecture signalements : " + e.getMessage());
        }
        return list;
    }

    /* ===================== Cache des incidents (/incidents) ===================== */

    /** Remplace le cache local des incidents API par la liste fournie. */
    public static void cacheIncidentEntries(List<IncidentEntry> incidents) {
        String sql = "INSERT OR REPLACE INTO local_incidents_api (id, description, status, email, created_at) VALUES (?, ?, ?, ?, ?)";
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try (Statement clear = conn.createStatement()) {
                clear.execute("DELETE FROM local_incidents_api");
            }
            try (PreparedStatement ps = conn.prepareStatement(sql)) {
                for (IncidentEntry inc : incidents) {
                    ps.setString(1, String.valueOf(inc.getId()));
                    ps.setString(2, inc.getDescription());
                    ps.setString(3, inc.getStatut());
                    ps.setString(4, inc.getEmail());
                    ps.setString(5, inc.getCreatedAt());
                    ps.addBatch();
                }
                ps.executeBatch();
            }
            conn.commit();
            System.out.println("[Cache SQLite] " + incidents.size() + " incidents mis en cache.");
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur mise en cache incidents : " + e.getMessage());
        }
    }

    /* ===================== Rapports en attente de synchronisation ===================== */

    /** Enregistre un rapport créé hors ligne (signalement ou incident). */
    public static void savePendingReport(String type, String description, String cibleType, String cibleId) {
        String sql = "INSERT INTO pending_reports (type, description, cible_type, cible_id, created_at) VALUES (?, ?, ?, ?, datetime('now'))";
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, type);
            ps.setString(2, description);
            ps.setString(3, cibleType);
            ps.setString(4, cibleId);
            ps.executeUpdate();
            // Supprime les anciens rapports mal formés (sans cible_type/cible_id)
            System.out.println("[Offline] Rapport sauvegardé : " + type + " — " + description);
        } catch (SQLException e) {
            System.err.println("[Offline] Erreur sauvegarde rapport : " + e.getMessage());
        }
    }

    /** Retourne tous les rapports non encore synchronisés. */
    public static List<PendingReport> loadPendingReports() {
        List<PendingReport> list = new ArrayList<>();
        // Migration douce : ajoute les colonnes si elles n'existent pas encore
        try (Connection conn = getConnection(); Statement mig = conn.createStatement()) {
            addColumnIfMissing(mig, "pending_reports", "cible_type", "TEXT");
            addColumnIfMissing(mig, "pending_reports", "cible_id",   "TEXT");
        } catch (SQLException ignored) {}

        String sql = "SELECT id, type, description, cible_type, cible_id, created_at FROM pending_reports";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                list.add(new PendingReport(
                        rs.getInt("id"),
                        rs.getString("type"),
                        rs.getString("description"),
                        rs.getString("cible_type"),
                        rs.getString("cible_id"),
                        rs.getString("created_at")));
            }
        } catch (SQLException e) {
            System.err.println("[Offline] Erreur lecture rapports en attente : " + e.getMessage());
        }
        return list;
    }

    /** Compte les rapports en attente (pour le badge UI). */
    public static int countPendingReports() {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM pending_reports")) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            return 0;
        }
    }

    /** Supprime un rapport après synchronisation réussie. */
    public static void deletePendingReport(int id) {
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement("DELETE FROM pending_reports WHERE id = ?")) {
            ps.setInt(1, id);
            ps.executeUpdate();
        } catch (SQLException e) {
            System.err.println("[Offline] Erreur suppression rapport : " + e.getMessage());
        }
    }

    /** Charge les incidents depuis le cache SQLite (mode offline). */
    public static List<IncidentEntry> loadCachedIncidentEntries() {
        List<IncidentEntry> list = new ArrayList<>();
        String sql = "SELECT id, description, status, email, created_at FROM local_incidents_api";
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                int id = 0;
                try { id = Integer.parseInt(rs.getString("id")); } catch (NumberFormatException ignored) {}
                list.add(new IncidentEntry(id,
                        rs.getString("description"),
                        rs.getString("status"),
                        rs.getString("email"),
                        rs.getString("created_at")));
            }
        } catch (SQLException e) {
            System.err.println("[Cache SQLite] Erreur lecture incidents : " + e.getMessage());
        }
        return list;
    }
}