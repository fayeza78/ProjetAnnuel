package com.neighborhood_manager;

import java.sql.Connection;
import java.sql.SQLException;
import com.neighborhood_manager.database.DatabaseConnection;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;

public class PrimaryController {


    @FXML private Button btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents, btnSettings, btnProfil;
    @FXML private TextField searchField;

    @FXML
    private void goHome() {
        setActive(btnHome);
        try (Connection conn = DatabaseConnection.getConnection()) {
            System.out.println(conn != null ? "Connexion réussie à la base de données!" : "Échec de la connexion à la base de données.");
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    @FXML private void goVoisins() { setActive(btnVoisins); }
    @FXML private void goAnnonces() { setActive(btnAnnonces); }
    @FXML private void goMessages() { setActive(btnMessages); }

    @FXML private void goIncidents() {
        setActive(btnIncidents);
        System.out.println("Clic sur Incidents !");
    }
    @FXML
    private void goSettings() {
        System.out.println("Clic sur Paramètres !");
        // On n'appelle pas setActive() ici car le bouton paramètres a son propre style fixe.
    }

    /**
     * Change le style du bouton actif et remet les autres en inactif.
     */
    private void setActive(Button active) {
        // NOUVEAUX STYLES (Orange et nouveau Bleu/Gris)
        String inactiveStyle = "-fx-background-color: transparent; -fx-text-fill: #8BA0B8; -fx-font-size: 14px; -fx-font-weight: bold; -fx-padding: 8 16; -fx-cursor: hand;";
        String activeStyle = "-fx-background-color: #F29C38; -fx-text-fill: white; -fx-font-size: 14px; -fx-font-weight: bold; -fx-padding: 8 18; -fx-background-radius: 8; -fx-cursor: hand;";

        // On liste UNIQUEMENT les boutons de la barre de navigation principale (pas les paramètres ni profil)
        Button[] navButtons = {btnHome, btnVoisins, btnAnnonces, btnMessages};

        // On remet tout le monde en "inactif"
        for (Button b : navButtons) {
            if (b != null) {
                b.setStyle(inactiveStyle);
            }
        }

        // On met le bouton cliqué en "actif"
        if (active != null) {
            active.setStyle(activeStyle);
        }
    }
}