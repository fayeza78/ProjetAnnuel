package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.chart.*;
import javafx.scene.control.Button;
import javafx.scene.control.Label;

import java.sql.*;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.regex.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class StatistiquesController {

    @FXML private PieChart pieIncidents;
    @FXML private BarChart<String, Number> barRoles;
    @FXML private LineChart<String, Number> lineChart;

    @FXML private Label lblTotalVoisins;
    @FXML private Label lblEnLigne;
    @FXML private Label lblIncidentsOuverts;
    @FXML private Label lblTauxResolution;
    @FXML private Label lblDataSource;
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

        // Voisins
        CompletableFuture<Void> futureVoisins = ApiService.fetchVoisinsFromServer()
                .thenAccept(json -> {
                    int total = json.split("\\{\\s*\"id_user\"").length - 1;
                    Map<String, Integer> roles = parseRoles(json);
                    Platform.runLater(() -> {
                        if (lblTotalVoisins != null) lblTotalVoisins.setText(String.valueOf(total));
                        updateBarChart(roles);
                    });
                })
                .exceptionally(ex -> { Platform.runLater(this::loadVoisinsFromCache); return null; });

        // Présence
        CompletableFuture<Void> futurePresence = ApiService.fetchPresenceUsers()
                .thenAccept(json -> {
                    int count = (json != null && !json.equals("[]") && !json.isBlank() && json.contains("{"))
                            ? json.split("\\{").length - 1 : 0;
                    final int fc = count;
                    Platform.runLater(() -> { if (lblEnLigne != null) lblEnLigne.setText(String.valueOf(fc)); });
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
                updateLineChart(allStatuts);
                updateIncidentCards(ouverts, resolus);
                setDataSource("Données en temps réel — API (" + signaux.size() + " signalements + " + incidents.size() + " incidents)");
            });
        });

        // Libère le bouton quand tout est terminé
        CompletableFuture.allOf(futureSignal, futureIncident, futureVoisins, futurePresence)
                .thenRun(() -> Platform.runLater(() -> setRefreshing(false)));
    }

    // ======================== MODE OFFLINE ========================

    private void loadFromSQLite() {
        setDataSource("Mode hors ligne — données depuis le cache local");
        loadVoisinsFromCache();
        if (lblEnLigne != null) lblEnLigne.setText("0");

        List<Incident>      signaux   = DatabaseConnection.loadCachedIncidents();
        List<IncidentEntry> incidents = DatabaseConnection.loadCachedIncidentEntries();

        List<String> allStatuts = Stream.concat(
                signaux.stream().map(Incident::getStatut),
                incidents.stream().map(IncidentEntry::getStatut)
        ).collect(Collectors.toList());

        long ouverts = allStatuts.stream().filter("En cours"::equals).count();
        long resolus = allStatuts.stream().filter("Résolu"::equals).count();

        updatePieChart(ouverts, resolus);
        updateLineChart(allStatuts);
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

    /**
     * Découpe la liste combinée de statuts en 5 lots max et trace deux séries :
     * "En cours" et "Résolus".
     */
    private void updateLineChart(List<String> allStatuts) {
        if (lineChart == null) return;
        lineChart.getData().clear();
        if (allStatuts.isEmpty()) return;

        int batchSize = Math.max(1, (allStatuts.size() + 4) / 5);
        XYChart.Series<String, Number> seriesOpen     = new XYChart.Series<>();
        XYChart.Series<String, Number> seriesResolved = new XYChart.Series<>();
        seriesOpen.setName("En cours");
        seriesResolved.setName("Résolus");

        int batchIdx = 1;
        for (int i = 0; i < allStatuts.size(); i += batchSize) {
            List<String> batch = allStatuts.subList(i, Math.min(i + batchSize, allStatuts.size()));
            long open     = batch.stream().filter("En cours"::equals).count();
            long resolved = batch.stream().filter("Résolu"::equals).count();
            String label  = "Lot " + batchIdx++;
            seriesOpen.getData().add(new XYChart.Data<>(label, open));
            seriesResolved.getData().add(new XYChart.Data<>(label, resolved));
        }
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
}
