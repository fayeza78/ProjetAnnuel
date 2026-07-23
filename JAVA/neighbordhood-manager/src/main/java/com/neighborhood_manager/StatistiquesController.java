package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.chart.*;
import javafx.scene.control.Alert;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonType;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;

import java.sql.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class StatistiquesController {

    @FXML private PieChart pieIncidents;
    @FXML private BarChart<String, Number> barRoles;
    @FXML private BarChart<String, Number> barParticipations;
    @FXML private LineChart<String, Number> lineChart;

    @FXML private Label lblTotalVoisins;
    @FXML private Label lblEnLigneTitre;
    @FXML private Label lblEnLigne;
    @FXML private Label lblIncidentsOuverts;
    @FXML private Label lblTauxResolution;
    @FXML private Label lblDataSource;
    @FXML private Label lblTotalEvenements;
    @FXML private Label lblConfirmed;
    @FXML private Label lblInterested;
    @FXML private Label lblDeclined;
    @FXML private Button btnRefresh;

    @FXML
    public void initialize() {
        refreshStats();
    }

    @FXML
    private void refreshStats() {
        setRefreshing(true);

        if (!SessionManager.getInstance().isLoggedIn()) {
            loadFromSQLite();
            setRefreshing(false);
            return;
        }

        // Signalements + Incidents en parallèle
        CompletableFuture<List<Incident>> futureSignal = ApiService.fetchSignalements()
                .thenApply(this::parseSignalements)
                .exceptionally(ex -> {
                    System.out.println("[Stats] /signalements injoignable, fallback cache.");
                    return DatabaseConnection.loadCachedIncidents();
                });

        CompletableFuture<List<IncidentEntry>> futureIncident = ApiService.fetchIncidents()
                .thenApply(this::parseIncidents)
                .exceptionally(ex -> {
                    System.out.println("[Stats] /incidents injoignable, fallback cache.");
                    return DatabaseConnection.loadCachedIncidentEntries();
                });

        // Voisins — retourne la map id→email pour le graphique de participations
        CompletableFuture<Map<Integer, String>> futureEmails = ApiService.fetchVoisinsFromServer()
                .thenApply(json -> {
                    int total = json.split("\\{\\s*\"id_user\"").length - 1;
                    Map<String, Integer> roles = parseRoles(json);
                    Map<Integer, String> emails = parseUserEmailsById(json);
                    Platform.runLater(() -> {
                        if (lblTotalVoisins != null) lblTotalVoisins.setText(String.valueOf(total));
                        updateBarChart(roles);
                    });
                    return emails;
                })
                .exceptionally(ex -> { Platform.runLater(this::loadVoisinsFromCache); return new LinkedHashMap<>(); });
        CompletableFuture<Void> futureVoisins = futureEmails.thenAccept(ignored -> {});

        // Présence
        CompletableFuture<Void> futurePresence = ApiService.fetchPresenceUsers()
                .thenAccept(json -> {
                    int count = 0;
                    if (json != null && !json.isBlank()) {
                        Matcher mp = Pattern.compile("\"online\"\\s*:\\s*\\[([^\\[\\]]*)\\]").matcher(json);
                        if (mp.find()) {
                            String inner = mp.group(1).trim();
                            count = inner.isEmpty() ? 0 : inner.split("\\{").length - 1;
                        } else if (json.contains("\"id_user\"")) {
                            count = json.split("\"id_user\"").length - 1;
                        }
                    }
                    final int fc = count;
                    Platform.runLater(() -> {
                        if (lblEnLigneTitre != null) lblEnLigneTitre.setText("EN LIGNE");
                        if (lblEnLigne != null)      lblEnLigne.setText(String.valueOf(fc));
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> { if (lblEnLigne != null) lblEnLigne.setText("0"); });
                    return null;
                });

        // Quand signalements + incidents sont prêts, on combine
        CompletableFuture.allOf(futureSignal, futureIncident).thenAccept(v -> {
            List<Incident>      signaux   = futureSignal.join();
            List<IncidentEntry> incidents = futureIncident.join();

            DatabaseConnection.cacheIncidents(signaux);
            DatabaseConnection.cacheIncidentEntries(incidents);

            // Statuts combinés : toutes sources confondues
            List<String> allStatuts = Stream.concat(
                    signaux.stream().map(Incident::getStatut),
                    incidents.stream().map(IncidentEntry::getStatut)
            ).collect(Collectors.toList());

            long ouverts = allStatuts.stream().filter("En cours"::equals).count();
            long resolus = allStatuts.stream().filter("Résolu"::equals).count();

            Platform.runLater(() -> {
                updatePieChart(ouverts, resolus);
                updateLineChart(signaux, incidents);
                updateIncidentCards(ouverts, resolus);
                setDataSource("Données en temps réel — API (" + signaux.size() + " signalements + " + incidents.size() + " incidents)");
            });
        });

        // Participations — retourne la map id→count pour la combiner avec les emails
        CompletableFuture<Map<Integer, Integer>> futurePartCounts = ApiService.fetchStatsParticipations()
                .thenApply(json -> {
                    int total      = extractInt(json, "totalEvenements");
                    int confirmed  = extractInt(json, "confirmed");
                    int interested = extractInt(json, "interested");
                    int declined   = extractInt(json, "declined");
                    Platform.runLater(() -> {
                        if (lblTotalEvenements != null) lblTotalEvenements.setText(String.valueOf(total));
                        if (lblConfirmed != null)       lblConfirmed.setText(String.valueOf(confirmed));
                        if (lblInterested != null)      lblInterested.setText(String.valueOf(interested));
                        if (lblDeclined != null)        lblDeclined.setText(String.valueOf(declined));
                    });
                    return parseParUtilisateur(json);
                })
                .exceptionally(ex -> {
                    System.err.println("[Stats] /stats/participations : " + ex.getMessage());
                    return new LinkedHashMap<>();
                });

        // Graphique participations : attend les 2 futures pour afficher email + clic
        CompletableFuture<Void> futureParticipations = CompletableFuture.allOf(futureEmails, futurePartCounts)
                .thenAccept(v -> {
                    Map<Integer, String>  emails = futureEmails.join();
                    Map<Integer, Integer> counts = futurePartCounts.join();
                    Platform.runLater(() -> updateParticipationChart(counts, emails));
                })
                .exceptionally(ex -> { System.err.println("[Stats] graphique participations : " + ex.getMessage()); return null; });

        // Libère le bouton quand tout est terminé
        CompletableFuture.allOf(futureSignal, futureIncident, futureVoisins, futurePresence, futureParticipations)
                .thenRun(() -> Platform.runLater(() -> setRefreshing(false)));
    }

    // ======================== MODE OFFLINE ========================

    private void loadFromSQLite() {
        setDataSource("Mode hors ligne — données depuis le cache local");
        loadVoisinsFromCache();
        if (lblEnLigneTitre != null) lblEnLigneTitre.setText("HORS LIGNE");
        if (lblEnLigne != null)      lblEnLigne.setText("—");

        List<Incident>      signaux   = DatabaseConnection.loadCachedIncidents();
        List<IncidentEntry> incidents = DatabaseConnection.loadCachedIncidentEntries();

        List<String> allStatuts = Stream.concat(
                signaux.stream().map(Incident::getStatut),
                incidents.stream().map(IncidentEntry::getStatut)
        ).collect(Collectors.toList());

        long ouverts = allStatuts.stream().filter("En cours"::equals).count();
        long resolus = allStatuts.stream().filter("Résolu"::equals).count();

        updatePieChart(ouverts, resolus);
        updateLineChart(signaux, incidents);
        updateIncidentCards(ouverts, resolus);
    }

    private void loadVoisinsFromCache() {
        Map<String, Integer> roles = new LinkedHashMap<>();
        int total = 0;
        try (Connection conn = DatabaseConnection.getConnection();
             Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM cached_users")) {
                if (rs.next()) total = rs.getInt(1);
            }
            try (ResultSet rs = stmt.executeQuery(
                    "SELECT role, COUNT(*) AS cnt FROM cached_users GROUP BY role")) {
                while (rs.next()) {
                    String role = rs.getString("role");
                    roles.put(role != null ? role : "inconnu", rs.getInt("cnt"));
                }
            }
        } catch (SQLException e) {
            System.err.println("[Stats] Erreur SQLite voisins : " + e.getMessage());
        }
        final int finalTotal = total;
        Runnable update = () -> {
            if (lblTotalVoisins != null) lblTotalVoisins.setText(String.valueOf(finalTotal));
            updateBarChart(roles);
        };
        if (Platform.isFxApplicationThread()) update.run();
        else Platform.runLater(update);
    }

    // ======================== MISE À JOUR DES GRAPHIQUES ========================

    private void updatePieChart(long ouverts, long resolus) {
        if (pieIncidents == null) return;
        if (ouverts == 0 && resolus == 0) {
            pieIncidents.getData().setAll(new PieChart.Data("Aucune donnée", 1));
            return;
        }
        pieIncidents.getData().setAll(
                new PieChart.Data("En cours (" + ouverts + ")", ouverts),
                new PieChart.Data("Résolus (" + resolus + ")", resolus)
        );
        Platform.runLater(() -> {
            List<PieChart.Data> data = pieIncidents.getData();
            if (data.size() >= 1 && data.get(0).getNode() != null)
                data.get(0).getNode().setStyle("-fx-pie-color: #F29C38;");
            if (data.size() >= 2 && data.get(1).getNode() != null)
                data.get(1).getNode().setStyle("-fx-pie-color: #0CA789;");
        });
    }

    private void updateBarChart(Map<String, Integer> roles) {
        if (barRoles == null || roles.isEmpty()) return;
        XYChart.Series<String, Number> series = new XYChart.Series<>();
        series.setName("Voisins");
        for (Map.Entry<String, Integer> e : roles.entrySet()) {
            series.getData().add(new XYChart.Data<>(e.getKey(), e.getValue()));
        }
        barRoles.getData().setAll(series);
    }

    private void updateLineChart(List<Incident> signaux, List<IncidentEntry> incidents) {
        if (lineChart == null) return;
        lineChart.getData().clear();

        long sigOuverts  = signaux.stream().filter(i -> "En cours".equals(i.getStatut())).count();
        long sigResolus  = signaux.stream().filter(i -> "Résolu".equals(i.getStatut())).count();
        long incOuverts  = incidents.stream().filter(i -> "En cours".equals(i.getStatut())).count();
        long incResolus  = incidents.stream().filter(i -> "Résolu".equals(i.getStatut())).count();

        XYChart.Series<String, Number> seriesOpen = new XYChart.Series<>();
        seriesOpen.setName("En cours");
        seriesOpen.getData().add(new XYChart.Data<>("Signalements", sigOuverts));
        seriesOpen.getData().add(new XYChart.Data<>("Incidents", incOuverts));

        XYChart.Series<String, Number> seriesResolved = new XYChart.Series<>();
        seriesResolved.setName("Résolus");
        seriesResolved.getData().add(new XYChart.Data<>("Signalements", sigResolus));
        seriesResolved.getData().add(new XYChart.Data<>("Incidents", incResolus));

        lineChart.getData().addAll(seriesOpen, seriesResolved);
    }

    private void updateIncidentCards(long ouverts, long resolus) {
        if (lblIncidentsOuverts != null) lblIncidentsOuverts.setText(String.valueOf(ouverts));
        long total = ouverts + resolus;
        if (lblTauxResolution != null) {
            lblTauxResolution.setText(total > 0
                    ? String.format("%.0f%%", resolus * 100.0 / total)
                    : "N/A");
        }
    }

    // ======================== PARSEURS ========================

    private List<Incident> parseSignalements(String json) {
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

    private List<IncidentEntry> parseIncidents(String json) {
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

            if (!id.isEmpty()) {
                try { list.add(new IncidentEntry(Integer.parseInt(id), description, statut, email, "")); }
                catch (NumberFormatException ignored) {}
            }
        }
        return list;
    }

    private Map<String, Integer> parseRoles(String json) {
        Map<String, Integer> map = new LinkedHashMap<>();
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            Matcher m = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"").matcher(blocks[i]);
            String role = m.find() ? m.group(1) : "inconnu";
            map.merge(role, 1, Integer::sum);
        }
        return map;
    }

    // ======================== UTILITAIRES UI ========================

    private void setRefreshing(boolean loading) {
        if (btnRefresh != null) {
            btnRefresh.setDisable(loading);
            btnRefresh.setText(loading ? "Chargement..." : "Actualiser");
        }
    }

    private void setDataSource(String text) {
        if (lblDataSource != null) lblDataSource.setText(text);
    }

    private int extractInt(String json, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(json);
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private Map<Integer, Integer> parseParUtilisateur(String json) {
        Map<Integer, Integer> map = new LinkedHashMap<>();
        Matcher mBlock = Pattern.compile("\"parUtilisateur\"\\s*:\\s*\\{([^}]*)\\}").matcher(json);
        if (mBlock.find()) {
            Matcher mPair = Pattern.compile("\"(\\d+)\"\\s*:\\s*(\\d+)").matcher(mBlock.group(1));
            while (mPair.find()) {
                map.put(Integer.parseInt(mPair.group(1)), Integer.parseInt(mPair.group(2)));
            }
        }
        return map;
    }

    private Map<Integer, String> parseUserEmailsById(String json) {
        Map<Integer, String> map = new LinkedHashMap<>();
        String[] blocks = json.split("\\{\\s*\"id_user\"");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            Matcher mId    = Pattern.compile("^\\s*:\\s*(\\d+)").matcher(block);
            Matcher mEmail = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mId.find() && mEmail.find()) {
                map.put(Integer.parseInt(mId.group(1)), mEmail.group(1));
            }
        }
        return map;
    }

    private void updateParticipationChart(Map<Integer, Integer> data, Map<Integer, String> emails) {
        if (barParticipations == null || data.isEmpty()) return;
        barParticipations.getData().clear();
        XYChart.Series<String, Number> series = new XYChart.Series<>();
        series.setName("Participations par utilisateur");
        for (Map.Entry<Integer, Integer> e : data.entrySet()) {
            int    userId = e.getKey();
            int    count  = e.getValue();
            String email  = emails.getOrDefault(userId, "U" + userId);
            String label  = email.contains("@") ? email.split("@")[0] : email;

            XYChart.Data<String, Number> bar = new XYChart.Data<>(label, count);
            final String fullEmail = email;
            bar.nodeProperty().addListener((obs, oldNode, newNode) -> {
                if (newNode == null) return;
                newNode.setStyle("-fx-cursor: hand;");
                Tooltip.install(newNode, new Tooltip(fullEmail + "\n" + count + " participation(s)"));
                newNode.setOnMouseClicked(ev -> showUserDialog(userId, fullEmail, count));
            });
            series.getData().add(bar);
        }
        barParticipations.getData().setAll(series);
    }

    private void showUserDialog(int userId, String email, int participations) {
        Alert dialog = new Alert(Alert.AlertType.CONFIRMATION);
        dialog.setTitle("Fiche utilisateur");
        dialog.setHeaderText("Utilisateur #" + userId);
        dialog.setContentText(
                "Email : " + email + "\n" +
                "Participations aux événements : " + participations + "\n\n" +
                "Voir dans la liste des voisins ?");
        dialog.showAndWait().ifPresent(bt -> {
            if (bt == ButtonType.OK && PrimaryController.instance != null) {
                PrimaryController.instance.navigateToVoisins();
            }
        });
    }
}
