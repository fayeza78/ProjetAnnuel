package com.neighborhood_manager;

import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

import com.neighborhood_manager.database.DatabaseConnection;

import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

public class PrimaryController {

    // Éléments de navigation
    @FXML private Button btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents;

    // Éléments de contenu et stats
    @FXML private VBox mainContent;
    @FXML private TextField searchField;
    @FXML private Label lblNbVoisins, lblNbAnnonces, lblNbIncidents, lblSyncStatus;

    /**
     * Méthode appelée automatiquement au chargement du FXML
     */
    @FXML
    public void initialize() {
        // 1. Initialiser les statistiques réelles depuis SQLite
        updateDashboardStats();

        // 2. Marquer visuellement le bouton Accueil comme actif
        setActive(btnHome);
    }

    @FXML
    private void goHome() {
        setActive(btnHome);
        updateDashboardStats();

        // Utilise la méthode statique de ta classe App pour rafraîchir la scène proprement
        try {
            App.setRoot("primary");
        } catch (IOException e) {
            System.err.println("Erreur lors du retour à l'accueil : " + e.getMessage());
            e.printStackTrace();
        }
    }

    @FXML
    private void goVoisins() {
        setActive(btnVoisins);
        System.out.println("Chargement de la liste des voisins...");
        loadView("voisins-list");
    }

    @FXML private void goAnnonces() { setActive(btnAnnonces); }
    @FXML private void goMessages() { setActive(btnMessages); }
    @FXML
    private void goIncidents() {
        setActive(btnIncidents);
        System.out.println("Chargement de la liste des incidents...");
        loadView("incidents-list");
    }
    @FXML private void goSettings() { System.out.println("Ouverture des paramètres"); }

    /**
     * Charge une vue FXML de manière dynamique dans le conteneur principal central
     */
    private void loadView(String fxmlName) {
        try {
            // Le "/" initial indique à Java d'aller chercher à la racine de src/main/resources
            String path = "/com/neighborhood_manager/" + fxmlName + ".fxml";

            java.net.URL fxmlUrl = getClass().getResource(path);
            if (fxmlUrl == null) {
                System.err.println("Fichier introuvable au chemin : " + path);
                return;
            }

            FXMLLoader loader = new FXMLLoader(fxmlUrl);
            Parent view = loader.load();

            // On vide la zone centrale et on y injecte le nouveau sous-module
            mainContent.getChildren().clear();
            mainContent.getChildren().add(view);
            System.out.println("Vue " + fxmlName + " chargée avec succès.");

        } catch (IOException e) {
            System.err.println("Erreur de chargement de la vue " + fxmlName + " : " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * Récupère les données depuis la base SQLite pour mettre à jour l'UI
     */
    private void updateDashboardStats() {
        try (Connection conn = DatabaseConnection.getConnection();
             Statement stmt = conn.createStatement()) {

            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as total FROM cached_users");
            if (rs.next()) {
                int count = rs.getInt("total");
                if (lblNbVoisins != null) {
                    lblNbVoisins.setText(count + " connectés");
                }
            }

            if (lblSyncStatus != null) {
                lblSyncStatus.setText("Mode Offline (SQLite)");
            }

        } catch (SQLException e) {
            if (lblNbVoisins != null) lblNbVoisins.setText("Erreur BDD");
            System.err.println("Erreur lors de la mise à jour des stats : " + e.getMessage());
        }
    }

    /**
     * Gère le changement visuel des boutons de navigation via CSS
     */
    private void setActive(Button active) {
        Button[] navButtons = {btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents};

        for (Button b : navButtons) {
            if (b != null) {
                b.getStyleClass().removeAll("nav-button-active");
                if (!b.getStyleClass().contains("nav-button")) {
                    b.getStyleClass().add("nav-button");
                }
            }
        }

        if (active != null) {
            active.getStyleClass().removeAll("nav-button");
            active.getStyleClass().add("nav-button-active");
        }
    }
}