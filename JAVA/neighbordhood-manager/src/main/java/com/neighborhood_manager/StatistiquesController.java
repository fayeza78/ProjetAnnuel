package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;

import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.chart.*;
import javafx.scene.control.Button;
import javafx.scene.control.Label;

import java.sql.*;
import java.util.*;
import java.util.regex.*;

public class StatistiquesController {

    // Graphiques
    @FXML private PieChart pieIncidents;
    @FXML private BarChart<String, Number> barRoles;
    @FXML private LineChart<String, Number> lineChart;

    // Cartes de synthèse
    @FXML private Label lblTotalVoisins;
    @FXML private Label lblEnLigne;
    @FXML private Label lblIncidentsOuverts;
    @FXML private Label lblTauxResolution;

    // Indicateurs
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

        // Incidents → PieChart + LineChart + cartes incidents
        ApiService.fetchSignalements()
                .thenAccept(json -> {
                    List<Incident> all = parseIncidents(json);
                    DatabaseConnection.cacheIncidents(all); // met à jour le cache offline
                    long ouverts  = all.stream().filter(i -> "En cours".equals(i.getStatut())).count();
                    long resolus  = all.stream().filter(i -> "Résolu".equals(i.getStatut())).count();
                    Platform.runLater(() -> {
                        updatePieChart(ouverts, resolus);
                        updateLineChart(all);
                        updateIncidentCards(ouverts, resolus);
                        setDataSource("Données en temps réel — API");
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(this::loadIncidentsFromCache);
                    return null;
                });

        // Voisins → BarChart + carte total
        ApiService.fetchVoisinsFromServer()
                .thenAccept(json -> {
                    int total = json.split("\\{\\s*\"id_user\"").length - 1;
                    Map<String, Integer> roles = parseRoles(json);
                    Platform.runLater(() -> {
                        if (lblTotalVoisins != null) lblTotalVoisins.setText(String.valueOf(total));
                        updateBarChart(roles);
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(this::loadVoisinsFromCache);
                    return null;
                });

        // Présence → carte en ligne
        ApiService.fetchPresenceUsers()
                .thenAccept(json -> {
                    int count = 0;
                    if (json != null && !json.equals("[]") && !json.isBlank()) {
                        count = json.contains("{") ? json.split("\\{").length - 1 : 1;
                    }
                    final int finalCount = count;
                    Platform.runLater(() -> {
                        if (lblEnLigne != null) lblEnLigne.setText(String.valueOf(finalCount));
                        setRefreshing(false);
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> {
                        if (lblEnLigne != null) lblEnLigne.setText("0");
                        setRefreshing(false);
                    });
                    return null;
                });
    }

    // ======================== MODE OFFLINE ========================

    private void loadFromSQLite() {
        setDataSource("Mode hors ligne — données depuis le cache local");
        loadIncidentsFromCache();
        loadVoisinsFromCache();
        if (lblEnLigne != null) lblEnLigne.setText("0");
    }

    private void loadIncidentsFromCache() {
        List<Incident> all = DatabaseConnection.loadCachedIncidents();
        long ouverts = all.stream().filter(i -> "En cours".equals(i.getStatut())).count();
        long resolus = all.stream().filter(i -> "Résolu".equals(i.getStatut())).count();
        updatePieChart(ouverts, resolus);
        updateLineChart(all);
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
        // Couleurs appliquées au prochain pulse (les nœuds ne sont créés qu'après setAll)
        Platform.runLater(() -> {
            List<PieChart.Data> data = pieIncidents.getData();
            if (data.size() >= 1 && data.get(0).getNode() != null)
                data.get(0).getNode().setStyle("-fx-pie-color: #F29C38;");
            if (data.size() >= 2 && data.get(1).getNode() != null)
                data.get(1).getNode().setStyle("-fx-pie-color: #0CA789;");
        });
    }

    private void updateBarChart(Map<String, Integer> roles) {
        if (barRoles == null) return;
        barRoles.getData().clear();
        if (roles.isEmpty()) return;
        XYChart.Series<String, Number> series = new XYChart.Series<>();
        series.setName("Voisins");
        for (Map.Entry<String, Integer> entry : roles.entrySet()) {
            series.getData().add(new XYChart.Data<>(entry.getKey(), entry.getValue()));
        }
        barRoles.getData().setAll(series);
    }

    private void updateLineChart(List<Incident> all) {
        if (lineChart == null) return;
        lineChart.getData().clear();
        if (all.isEmpty()) return;

        // Découpe en 5 lots maximum pour visualiser la tendance
        int batchSize = Math.max(1, (all.size() + 4) / 5);
        XYChart.Series<String, Number> seriesOpen     = new XYChart.Series<>();
        XYChart.Series<String, Number> seriesResolved = new XYChart.Series<>();
        seriesOpen.setName("En cours");
        seriesResolved.setName("Résolus");

        int batchIdx = 1;
        for (int i = 0; i < all.size(); i += batchSize) {
            List<Incident> batch = all.subList(i, Math.min(i + batchSize, all.size()));
            long open     = batch.stream().filter(inc -> "En cours".equals(inc.getStatut())).count();
            long resolved = batch.stream().filter(inc -> "Résolu".equals(inc.getStatut())).count();
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

    private List<Incident> parseIncidents(String json) {
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
