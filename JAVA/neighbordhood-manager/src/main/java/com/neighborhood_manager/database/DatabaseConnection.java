package com.neighborhood_manager.database;
import java.io.File;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;


public class DatabaseConnection {
    private static final String SQL_LITE_URL    =  "jdbc:sqlite:Data/data.db"; 
    private static final String POSTGRESQL_URL  =  "jdbc:postgresql://51.77.245.139:5432/connected_neighbours"; 


    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(SQL_LITE_URL);
    }

   
    public static void startup() {
        try {
            File directory = new File("data");
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
                
                // table pour le cache 
                String sqlUsers = "CREATE TABLE IF NOT EXISTS cached_users (" +
                        "id TEXT PRIMARY KEY," +
                        "fullname TEXT," +
                        "email TEXT," +
                        "is_validated INTEGER DEFAULT 0" +
                        ");";
                String sqlIncidents = "CREATE TABLE IF NOT EXISTS local_incidents (" +
                        "id TEXT PRIMARY KEY," +
                        "description TEXT NOT NULL," +
                        "status TEXT DEFAULT 'PENDING'" +
                        ");";
                stmt.execute(sqlContrats);
                stmt.execute(sqlUsers);
                stmt.execute(sqlIncidents);
                
            }
        } catch (SQLException e) {
            System.err.println("Erreur lors de l'initialisation SQLite : " + e.getMessage());
        }
       
    }
}
