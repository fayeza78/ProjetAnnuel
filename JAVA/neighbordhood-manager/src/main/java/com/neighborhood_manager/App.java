package com.neighborhood_manager;

import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.plugins.PluginManager;
import javafx.application.Application;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.Scene;
import javafx.stage.Stage;

import java.io.IOException;

public class App extends Application {

    private static Scene scene;

    @Override
    public void start(Stage stage) throws IOException {
        DatabaseConnection.startup();
        PluginManager.getInstance();

        stage.setTitle("Petits secrets Entre Voisins");
        scene = new Scene(loadFXML("login"), 1024, 768);


        // Applique le thème sauvegardé (ou Nuit par défaut)
        ThemeManager.getInstance().applyTo(scene);

        stage.setScene(scene);
        stage.show();
    }

    /** Retourne la scène principale (pour ThemeManager). */
    public static Scene getScene() {
        return scene;
    }

    static void setRoot(String fxml) throws IOException {
        scene.setRoot(loadFXML(fxml));
    }

    private static Parent loadFXML(String fxml) throws IOException {
        FXMLLoader fxmlLoader = new FXMLLoader(App.class.getResource(fxml + ".fxml"));
        return fxmlLoader.load();
    }

    public static void main(String[] args) {
        launch();

    }
}