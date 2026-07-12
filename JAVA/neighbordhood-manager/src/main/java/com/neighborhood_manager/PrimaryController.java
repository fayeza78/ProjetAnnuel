package com.neighborhood_manager;

import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.control.TextField;
import javafx.scene.layout.VBox;

public class PrimaryController {

    @FXML private Button btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents, btnPlugins, btnProfil;
    @FXML private VBox mainContent;
    @FXML private TextField searchField;
    @FXML private Label lblNbVoisins, lblNbAnnonces, lblNbIncidents, lblSyncStatus;

    // Contenu d'accueil sauvegardé une seule fois au démarrage
    private List<Node> homeNodes;

    @FXML
    public void initialize() {
        setActive(btnHome);

        // Sauvegarde du contenu d'accueil défini dans primary.fxml
        homeNodes = new ArrayList<>(mainContent.getChildren());

        if (SessionManager.getInstance().isLoggedIn()) {
            if (btnIncidents != null) btnIncidents.setDisable(false);
            if (lblSyncStatus != null) lblSyncStatus.setText("En ligne (API REST Active)");
            updateDashboardStatsOnline();
        } else {
            updateDashboardStatsOffline();
        }
    }

    @FXML
    private void goHome() {
        setActive(btnHome);
        // Restaure le contenu d'accueil sans recharger le FXML (évite un nouveau login)
        if (homeNodes != null) {
            mainContent.getChildren().setAll(homeNodes);
        }
        if (SessionManager.getInstance().isLoggedIn()) {
            updateDashboardStatsOnline();
        } else {
            updateDashboardStatsOffline();
        }
    }

    private void updateDashboardStatsOnline() {
        ApiService.fetchStatsIncidents()
                .thenAccept(json -> {
                    int nb = extractJsonInt(json, "ouverts");
                    if (nb == 0 && json.contains("id_status")) nb = json.split("\\{\\s*\"id_").length - 1;
                    final String txt = nb + " en cours";
                    Platform.runLater(() -> { if (lblNbIncidents != null) lblNbIncidents.setText(txt); });
                })
                .exceptionally(ex -> { System.err.println("[Stats] " + ex.getMessage()); return null; });

        ApiService.fetchPresenceUsers()
                .thenAccept(json -> {
                    int nb = 0;
                    if (json != null && !json.equals("[]") && !json.isEmpty()) {
                        if (json.contains("{")) nb = json.split("\\{").length - 1;
                        else if (json.contains(",")) nb = json.split(",").length;
                        else nb = 1;
                    }
                    final String txt = nb + " en ligne";
                    Platform.runLater(() -> { if (lblNbVoisins != null) lblNbVoisins.setText(txt); });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> { if (lblNbVoisins != null) lblNbVoisins.setText("1 en ligne"); });
                    return null;
                });
    }

    private void updateDashboardStatsOffline() {
        System.out.println("[Dashboard] Mode secours SQLite.");
        if (lblSyncStatus != null) lblSyncStatus.setText("Mode Offline (SQLite)");
        if (lblNbIncidents != null) lblNbIncidents.setText("0 en cours");

        try (Connection conn = DatabaseConnection.getConnection();
             Statement stmt = conn.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) as total FROM cached_users");
            if (rs.next()) {
                int count = rs.getInt("total");
                if (lblNbVoisins != null) lblNbVoisins.setText(count + " connectés");
            }
        } catch (SQLException e) {
            if (lblNbVoisins != null) lblNbVoisins.setText("N/A");
        }
    }

    private int extractJsonInt(String json, String key) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    @FXML private void goVoisins()   { setActive(btnVoisins);   loadView("voisins-list");   }
    @FXML private void goAnnonces()  { setActive(btnAnnonces);  }
    @FXML private void goMessages()  { setActive(btnMessages);  }
    @FXML private void goIncidents() { setActive(btnIncidents); loadView("incidents-list"); }
    @FXML private void goPlugins()   { setActive(btnPlugins);   loadView("plugins-panel");  }
    @FXML private void goSettings()  { setActive(null); loadView("settings-panel"); }
    @FXML private void goProfile()   { setActive(null); loadView("profile-panel"); }

    private void loadView(String fxmlName) {
        try {
            String path = "/com/neighborhood_manager/" + fxmlName + ".fxml";
            java.net.URL url = getClass().getResource(path);
            if (url == null) { System.err.println("FXML introuvable : " + path); return; }
            FXMLLoader loader = new FXMLLoader(url);
            Parent view = loader.load();
            mainContent.getChildren().setAll(view);
        } catch (IOException e) {
            System.err.println("Erreur chargement vue " + fxmlName + " : " + e.getMessage());
        }
    }

    private void setActive(Button active) {
        Button[] nav = {btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents, btnPlugins};
        for (Button b : nav) {
            if (b == null) continue;
            b.getStyleClass().removeAll("nav-button-active");
            if (!b.getStyleClass().contains("nav-button")) b.getStyleClass().add("nav-button");
        }
        if (active != null) {
            active.getStyleClass().removeAll("nav-button");
            active.getStyleClass().add("nav-button-active");
        }
    }
}