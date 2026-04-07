package com.neighborhood_manager.database;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;


public class DatabaseConnection {
    private static final String SQL_LITE_URL    =  "jdbc:sqlite:Data/data.db"; 
    private static final String POSTGRESQL_URL  =  "jdbc:postgresql://51.77.245.139:5432/connected_neighbours"; 


    public static Connection getConnection() throws SQLException {
        return DriverManager.getConnection(SQL_LITE_URL);
    }

   
    public static void startup() {
       
    }
}
