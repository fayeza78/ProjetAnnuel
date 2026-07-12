module com.neighborhood_manager {
    requires javafx.controls;
    requires javafx.fxml;
    requires java.net.http;

    requires org.kordamp.ikonli.javafx;
    requires org.kordamp.ikonli.fontawesome5;

    requires java.sql;           // JDBC
    // requires sqlite.jdbc;        // driver SQLite (nom automatique)
    requires java.prefs;

    opens com.neighborhood_manager to javafx.fxml;
    opens com.neighborhood_manager.models to javafx.base;
    exports com.neighborhood_manager;
}
