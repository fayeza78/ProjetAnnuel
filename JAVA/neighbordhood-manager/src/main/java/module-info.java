module com.neighborhood_manager {
    requires javafx.controls;
    requires javafx.fxml;

    requires org.kordamp.ikonli.javafx;
    requires org.kordamp.ikonli.fontawesome5;

    requires java.sql;           // ← JDBC
   // requires sqlite.jdbc;        // ← driver SQLite (nom automatique)

    opens com.neighborhood_manager to javafx.fxml;
    exports com.neighborhood_manager;
}
