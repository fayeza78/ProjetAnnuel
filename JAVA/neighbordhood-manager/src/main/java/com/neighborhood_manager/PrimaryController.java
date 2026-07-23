package com.neighborhood_manager;

import java.io.IOException;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.fxml.FXMLLoader;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.Region;
import javafx.scene.layout.VBox;
import javafx.scene.paint.Color;
import javafx.scene.shape.Circle;

public class PrimaryController {

    public static PrimaryController instance;

    @FXML private Button btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents, btnStats, btnPlugins, btnProfil;
    @FXML private VBox mainContent;

    @FXML private Label lblNbVoisins;
    @FXML private Label lblNbVoisinsOnline;
    @FXML private Label lblNbIncidents;
    @FXML private Label lblNbIncidentsResolus;
    @FXML private Label lblSyncStatus;
    @FXML private Label lblInfoEmail;
    @FXML private Label lblInfoAdminEmail;
    @FXML private Label lblInfoMode;
    @FXML private VBox recentIncidentsBox;

    private List<Node> homeNodes;

    @FXML
    public void initialize() {
        instance = this;
        setActive(btnHome);
        homeNodes = new ArrayList<>(mainContent.getChildren());

        String email = SessionManager.getInstance().getAdminEmail();
        if (lblInfoEmail != null)      lblInfoEmail.setText(email);
        if (lblInfoAdminEmail != null) lblInfoAdminEmail.setText(email);

        if (SessionManager.getInstance().isLoggedIn()) {
            setSyncStatus(true);
            if (lblInfoMode != null) lblInfoMode.setText("API REST (en ligne)");
            updateDashboardStatsOnline();
        } else {
            setSyncStatus(false);
            if (lblInfoMode != null) lblInfoMode.setText("SQLite (hors ligne)");
            updateDashboardStatsOffline();
        }
    }

    @FXML
    private void goHome() {
        setActive(btnHome);
        if (homeNodes != null) mainContent.getChildren().setAll(homeNodes);
        if (SessionManager.getInstance().isLoggedIn()) updateDashboardStatsOnline();
        else updateDashboardStatsOffline();
    }

    // ======================== CHARGEMENT DES STATS ========================

    private void updateDashboardStatsOnline() {

        // Voisins inscrits
        ApiService.fetchVoisinsFromServer()
                .thenAccept(json -> {
                    int count = json.split("\\{\\s*\"id_user\"").length - 1;
                    Platform.runLater(() -> { if (lblNbVoisins != null) lblNbVoisins.setText(String.valueOf(count)); });
                })
                .exceptionally(ex -> {
                    int cached = countSqlite("SELECT COUNT(*) FROM cached_users");
                    Platform.runLater(() -> { if (lblNbVoisins != null) lblNbVoisins.setText(String.valueOf(cached)); });
                    return null;
                });

        // Voisins en ligne
        ApiService.fetchPresenceUsers()
                .thenAccept(json -> {
                    int count = 0;
                    if (json != null && !json.isBlank()) {
                        java.util.regex.Matcher m = java.util.regex.Pattern
                                .compile("\"online\"\\s*:\\s*\\[([^\\[\\]]*)\\]")
                                .matcher(json);
                        if (m.find()) {
                            String inner = m.group(1).trim();
                            count = inner.isEmpty() ? 0 : inner.split("\\{").length - 1;
                        } else if (json.contains("\"id_user\"")) {
                            count = json.split("\"id_user\"").length - 1;
                        }
                    }
                    final int fc = count;
                    Platform.runLater(() -> { if (lblNbVoisinsOnline != null) lblNbVoisinsOnline.setText(String.valueOf(fc)); });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> { if (lblNbVoisinsOnline != null) lblNbVoisinsOnline.setText("0"); });
                    return null;
                });

        // Signalements + Incidents en parallèle → compteurs combinés + liste récente
        CompletableFuture<List<Incident>> futureSignal = ApiService.fetchSignalements()
                .thenApply(json -> {
                    List<Incident> list = parseSignalementsJson(json);
                    DatabaseConnection.cacheIncidents(list);
                    return list;
                })
                .exceptionally(ex -> DatabaseConnection.loadCachedIncidents());

        CompletableFuture<List<IncidentEntry>> futureIncident = ApiService.fetchIncidents()
                .thenApply(json -> {
                    List<IncidentEntry> list = parseIncidentsJson(json);
                    DatabaseConnection.cacheIncidentEntries(list);
                    return list;
                })
                .exceptionally(ex -> DatabaseConnection.loadCachedIncidentEntries());

        CompletableFuture.allOf(futureSignal, futureIncident).thenAccept(v -> {
            List<Incident>      signaux   = futureSignal.join();
            List<IncidentEntry> incidents = futureIncident.join();

            long ouvertsSig = signaux.stream().filter(i -> "En cours".equals(i.getStatut())).count();
            long resolusSig = signaux.stream().filter(i -> "Résolu".equals(i.getStatut())).count();
            long ouvertsInc = incidents.stream().filter(i -> "En cours".equals(i.getStatut())).count();
            long resolusInc = incidents.stream().filter(i -> "Résolu".equals(i.getStatut())).count();
            long totalOuverts = ouvertsSig + ouvertsInc;
            long totalResolus = resolusSig + resolusInc;

            List<Incident>      recentSig = signaux.stream().limit(3).collect(Collectors.toList());
            List<IncidentEntry> recentInc = incidents.stream().limit(2).collect(Collectors.toList());

            Platform.runLater(() -> {
                if (lblNbIncidents != null)        lblNbIncidents.setText(String.valueOf(totalOuverts));
                if (lblNbIncidentsResolus != null) lblNbIncidentsResolus.setText(String.valueOf(totalResolus));
                loadRecentCombined(recentSig, recentInc);
            });
        });
    }

    private void updateDashboardStatsOffline() {
        System.out.println("[Dashboard] Mode SQLite.");

        int ouvertsSig = countSqlite("SELECT COUNT(*) FROM local_incidents WHERE status != 'Résolu'");
        int resolusSig = countSqlite("SELECT COUNT(*) FROM local_incidents WHERE status = 'Résolu'");
        int ouvertsInc = countSqlite("SELECT COUNT(*) FROM local_incidents_api WHERE status != 'Résolu'");
        int resolusInc = countSqlite("SELECT COUNT(*) FROM local_incidents_api WHERE status = 'Résolu'");

        if (lblNbVoisins != null)          lblNbVoisins.setText(String.valueOf(countSqlite("SELECT COUNT(*) FROM cached_users")));
        if (lblNbVoisinsOnline != null)    lblNbVoisinsOnline.setText("0");
        if (lblNbIncidents != null)        lblNbIncidents.setText(String.valueOf(ouvertsSig + ouvertsInc));
        if (lblNbIncidentsResolus != null) lblNbIncidentsResolus.setText(String.valueOf(resolusSig + resolusInc));

        List<Incident>      recentSig = DatabaseConnection.loadCachedIncidents().stream().limit(3).collect(Collectors.toList());
        List<IncidentEntry> recentInc = DatabaseConnection.loadCachedIncidentEntries().stream().limit(2).collect(Collectors.toList());
        loadRecentCombined(recentSig, recentInc);
    }

    private int countSqlite(String sql) {
        try (Connection conn = DatabaseConnection.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {
            return rs.next() ? rs.getInt(1) : 0;
        } catch (SQLException e) {
            System.err.println("[Dashboard] Erreur SQLite : " + e.getMessage());
            return 0;
        }
    }

    // ======================== PANNEAU SIGNALEMENTS RÉCENTS ========================

    private void loadRecentCombined(List<Incident> signaux, List<IncidentEntry> incidents) {
        if (recentIncidentsBox == null) return;
        recentIncidentsBox.getChildren().clear();

        if (signaux.isEmpty() && incidents.isEmpty()) {
            Label empty = new Label("Aucun signalement récent.");
            empty.getStyleClass().add("empty-state-text");
            recentIncidentsBox.getChildren().add(empty);
            return;
        }

        for (Incident s : signaux) {
            recentIncidentsBox.getChildren().add(buildRow(s.getMotif(), s.getStatut()));
        }
        for (IncidentEntry i : incidents) {
            recentIncidentsBox.getChildren().add(buildRow(i.getDescription(), i.getStatut()));
        }
    }

    private HBox buildRow(String description, String statut) {
        HBox row = new HBox(12);
        row.getStyleClass().add("incident-row");
        row.setAlignment(Pos.CENTER_LEFT);
        row.setPadding(new Insets(10, 14, 10, 14));

        boolean isOpen = "En cours".equals(statut);

        Circle dot = new Circle(5);
        dot.setFill(Color.web(isOpen ? "#F29C38" : "#0CA789"));

        Label motifLbl = new Label(description);
        motifLbl.getStyleClass().add("incident-row-motif");
        HBox.setHgrow(motifLbl, Priority.ALWAYS);

        Label badge = new Label(statut);
        badge.getStyleClass().add(isOpen ? "badge-open" : "badge-resolved");

        row.getChildren().addAll(dot, motifLbl, badge);
        return row;
    }

    // ======================== PARSEURS ========================

    private List<Incident> parseSignalementsJson(String json) {
        List<Incident> list = new ArrayList<>();
        String[] blocks = json.split("\\{\\s*\"id_signalement\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            String id = "";
            Matcher mId = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            if (mId.find()) id = mId.group(1);

            String motif = "Aucun motif";
            Matcher mMotif = Pattern.compile("\"motif\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mMotif.find()) motif = mMotif.group(1);

            String statut = "En cours";
            Matcher mStatut = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mStatut.find()) statut = mStatut.group(1).equals("ouvert") ? "En cours" : "Résolu";

            if (!id.isEmpty()) {
                try { list.add(new Incident(Integer.parseInt(id), motif, statut)); }
                catch (NumberFormatException ignored) {}
            }
        }
        return list;
    }

    private List<IncidentEntry> parseIncidentsJson(String json) {
        List<IncidentEntry> list = new ArrayList<>();
        String[] blocks = json.split("\\{\\s*\"id_incident\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            String id = "";
            Matcher mId = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            if (mId.find()) id = mId.group(1);

            String description = "Aucune description";
            Matcher mDesc = Pattern.compile("\"description\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mDesc.find()) description = mDesc.group(1);

            String statut = "En cours";
            Matcher mStatut = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mStatut.find()) statut = mStatut.group(1).equals("ouvert") ? "En cours" : "Résolu";

            String email = "";
            Matcher mEmail = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mEmail.find()) email = mEmail.group(1);

            String createdAt = "";
            Matcher mDate = Pattern.compile("\"createdAt\"\\s*:\\s*\"([^\"T]+)").matcher(block);
            if (mDate.find()) createdAt = mDate.group(1);

            if (!id.isEmpty()) {
                try { list.add(new IncidentEntry(Integer.parseInt(id), description, statut, email, createdAt)); }
                catch (NumberFormatException ignored) {}
            }
        }
        return list;
    }

    // ======================== UTILITAIRES ========================

    private void setSyncStatus(boolean online) {
        if (lblSyncStatus == null) return;
        lblSyncStatus.setText(online ? "En ligne" : "Hors ligne");
        lblSyncStatus.getStyleClass().removeAll("sync-badge-online", "sync-badge-offline");
        lblSyncStatus.getStyleClass().add(online ? "sync-badge-online" : "sync-badge-offline");
    }

    // ======================== NAVIGATION ========================

    @FXML private void goVoisins()   { navigateToVoisins(); }

    public void navigateToVoisins() { setActive(btnVoisins); loadView("voisins-list"); }
    @FXML private void goAnnonces()  { setActive(btnAnnonces);  }
    @FXML private void goMessages()  { setActive(btnMessages);  }
    @FXML private void goIncidents() { setActive(btnIncidents); loadView("incidents-list");      }
    @FXML private void goStats()     { setActive(btnStats);     loadView("statistiques-panel");  }
    @FXML private void goPlugins()   { setActive(btnPlugins);   loadView("plugins-panel");       }
    @FXML private void goSettings()  { setActive(null);         loadView("settings-panel");      }
    @FXML private void goProfile()   { setActive(null);         loadView("profile-panel");       }

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
        Button[] nav = {btnHome, btnVoisins, btnAnnonces, btnMessages, btnIncidents, btnStats, btnPlugins};
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
