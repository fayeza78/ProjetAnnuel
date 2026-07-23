package com.neighborhood_manager.plugins;

import com.neighborhood_manager.database.ApiService;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.chart.*;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.Modality;
import javafx.stage.Stage;

import java.util.regex.*;

public class AnalyseSocialePlugin implements Plugin {

    @Override
    public String getName() { return "Analyse Sociale"; }

    @Override
    public String getDescription() {
        return "Analyse l'activité des habitants : présence, incidents, répartition des rôles.";
    }

    @Override
    public void execute() {
        Stage stage = new Stage();
        stage.initModality(Modality.APPLICATION_MODAL);
        stage.setTitle("Analyse Sociale du Quartier");
        stage.setWidth(780);
        stage.setHeight(600);

        Label title = new Label("Analyse Sociale");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold; -fx-text-fill: #0CA789;");

        Label statusLabel = new Label("Chargement des données en cours...");
        statusLabel.setStyle("-fx-text-fill: #8BA0B8;");

        HBox statsRow = new HBox(12);
        statsRow.setAlignment(Pos.CENTER);

        CategoryAxis xAxis = new CategoryAxis();
        NumberAxis yAxis = new NumberAxis();
        xAxis.setLabel("Catégorie");
        yAxis.setLabel("Nombre");
        BarChart<String, Number> barChart = new BarChart<>(xAxis, yAxis);
        barChart.setTitle("Répartition du quartier");
        barChart.setLegendVisible(false);
        barChart.setPrefHeight(280);
        barChart.setStyle("-fx-background-color: transparent;");
        VBox.setVgrow(barChart, Priority.ALWAYS);

        Button btnRefresh = new Button("Actualiser");
        btnRefresh.getStyleClass().add("button-primary");
        Button btnClose = new Button("Fermer");
        btnClose.setStyle("-fx-background-color: #2E435E; -fx-text-fill: white; -fx-cursor: hand; -fx-background-radius: 5; -fx-padding: 8 18;");
        btnClose.setOnAction(e -> stage.close());
        HBox btnBar = new HBox(10, btnRefresh, btnClose);
        btnBar.setAlignment(Pos.CENTER_RIGHT);

        VBox root = new VBox(15, title, statusLabel, statsRow, barChart, btnBar);
        root.setPadding(new Insets(25));
        root.setStyle("-fx-background-color: #1a2638;");

        Runnable loadData = () -> {
            btnRefresh.setDisable(true);
            statusLabel.setText("Chargement...");
            statusLabel.setStyle("-fx-text-fill: #8BA0B8;");

            ApiService.fetchSignalements()
                    .thenCombine(ApiService.fetchVoisinsFromServer(), (incJson, usersJson) -> {
                        String[] incBlocks = incJson.split("\\{\\s*\"id_signalement\"");
                        int totalInc = incBlocks.length - 1;
                        int ouverts = 0, resolus = 0;
                        for (int i = 1; i < incBlocks.length; i++) {
                            Matcher m = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"").matcher(incBlocks[i]);
                            if (m.find()) {
                                if ("ouvert".equalsIgnoreCase(m.group(1))) ouverts++;
                                else resolus++;
                            }
                        }

                        String[] userBlocks = usersJson.split("\\{\\s*\"id_user\"");
                        int totalUsers = userBlocks.length - 1;
                        int admins = 0, residents = 0;
                        for (int i = 1; i < userBlocks.length; i++) {
                            Matcher m = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"").matcher(userBlocks[i]);
                            if (m.find()) {
                                if (m.group(1).toLowerCase().contains("admin")) admins++;
                                else residents++;
                            }
                        }
                        return new int[]{totalInc, ouverts, resolus, totalUsers, admins, residents};
                    })
                    .thenCombine(ApiService.fetchPresenceUsers(), (stats, presenceJson) -> {
                        int connectes = 0;
                        if (presenceJson != null && !presenceJson.isEmpty()) {
                            java.util.regex.Matcher mp = java.util.regex.Pattern
                                    .compile("\"online\"\\s*:\\s*\\[([^\\[\\]]*)\\]")
                                    .matcher(presenceJson);
                            if (mp.find()) {
                                String inner = mp.group(1).trim();
                                connectes = inner.isEmpty() ? 0 : inner.split("\\{").length - 1;
                            } else if (presenceJson.contains("\"id_user\"")) {
                                connectes = presenceJson.split("\"id_user\"").length - 1;
                            }
                        }
                        return new int[]{stats[0], stats[1], stats[2], stats[3], stats[4], stats[5], connectes};
                    })
                    .thenAccept(data -> {
                        int totalInc = data[0], ouverts = data[1], resolus = data[2];
                        int totalUsers = data[3], admins = data[4], residents = data[5], connectes = data[6];
                        double taux = totalInc > 0 ? (resolus * 100.0 / totalInc) : 0;

                        Platform.runLater(() -> {
                            statsRow.getChildren().setAll(
                                    buildCard("Voisins", String.valueOf(totalUsers), "#0CA789"),
                                    buildCard("En ligne", String.valueOf(connectes), "#2ECC71"),
                                    buildCard("Admins", String.valueOf(admins), "#F29C38"),
                                    buildCard("Incidents", String.valueOf(totalInc), "#E74C3C"),
                                    buildCard("Résolus", String.format("%.0f%%", taux), "#8AC6C7")
                            );

                            XYChart.Series<String, Number> series = new XYChart.Series<>();
                            series.getData().add(new XYChart.Data<>("Résidents", residents));
                            series.getData().add(new XYChart.Data<>("Admins", admins));
                            series.getData().add(new XYChart.Data<>("Connectés", connectes));
                            series.getData().add(new XYChart.Data<>("Inc. ouverts", ouverts));
                            series.getData().add(new XYChart.Data<>("Inc. résolus", resolus));
                            barChart.getData().setAll(series);

                            statusLabel.setText("Analyse terminée — données en temps réel.");
                            statusLabel.setStyle("-fx-text-fill: #0CA789; -fx-font-weight: bold;");
                            btnRefresh.setDisable(false);
                        });
                    })
                    .exceptionally(ex -> {
                        Platform.runLater(() -> {
                            statusLabel.setText("Erreur de chargement : " + ex.getMessage());
                            statusLabel.setStyle("-fx-text-fill: #E74C3C;");
                            btnRefresh.setDisable(false);
                        });
                        return null;
                    });
        };

        btnRefresh.setOnAction(e -> loadData.run());
        loadData.run();

        Scene scene = new Scene(root);
        applyStylesheet(scene);
        stage.setScene(scene);
        stage.show();
    }

    private VBox buildCard(String label, String value, String color) {
        VBox card = new VBox(5);
        card.setAlignment(Pos.CENTER);
        card.setStyle("-fx-background-color: #233348; -fx-background-radius: 12; -fx-padding: 18; -fx-min-width: 120;");
        Label lbl = new Label(label);
        lbl.setStyle("-fx-text-fill: #8BA0B8; -fx-font-size: 12px;");
        Label val = new Label(value);
        val.setStyle("-fx-text-fill: " + color + "; -fx-font-size: 26px; -fx-font-weight: bold;");
        card.getChildren().addAll(lbl, val);
        return card;
    }

    private void applyStylesheet(Scene scene) {
        java.net.URL css = getClass().getResource("/com/neighborhood_manager/style.css");
        if (css != null) scene.getStylesheets().add(css.toExternalForm());
    }
}