package com.neighborhood_manager.plugins;

import com.neighborhood_manager.database.ApiService;
import javafx.application.Platform;
import javafx.geometry.Insets;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.*;
import javafx.scene.layout.*;
import javafx.stage.FileChooser;
import javafx.stage.Modality;
import javafx.stage.Stage;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.*;

public class ExportStatPlugin implements Plugin {

    @Override
    public String getName() { return "Export Statistiques"; }

    @Override
    public String getDescription() {
        return "Génère un rapport CSV des incidents et des voisins pour analyse externe.";
    }

    @Override
    public void execute() {
        Stage stage = new Stage();
        stage.initModality(Modality.APPLICATION_MODAL);
        stage.setTitle("Export Statistiques — Rapport CSV");
        stage.setWidth(700);
        stage.setHeight(540);

        Label title = new Label("Génération du rapport");
        title.setStyle("-fx-font-size: 20px; -fx-font-weight: bold; -fx-text-fill: #0CA789;");

        Label statusLabel = new Label("Chargement des données depuis le serveur...");
        statusLabel.setStyle("-fx-text-fill: #8BA0B8;");

        TextArea preview = new TextArea();
        preview.setEditable(false);
        preview.setStyle("-fx-font-family: monospace; -fx-font-size: 12px; -fx-control-inner-background: #1a2638; -fx-text-fill: #8BA0B8;");
        VBox.setVgrow(preview, Priority.ALWAYS);

        Button btnExport = new Button("Exporter en CSV");
        btnExport.setDisable(true);
        btnExport.getStyleClass().add("button-primary");

        Button btnClose = new Button("Fermer");
        btnClose.setStyle("-fx-background-color: #2E435E; -fx-text-fill: white; -fx-cursor: hand; -fx-background-radius: 5; -fx-padding: 8 18;");
        btnClose.setOnAction(e -> stage.close());

        HBox btnBar = new HBox(10, btnExport, btnClose);
        btnBar.setAlignment(Pos.CENTER_RIGHT);

        List<String[]> csvData = new ArrayList<>();

        ApiService.fetchSignalements()
                .thenCombine(ApiService.fetchVoisinsFromServer(), (incJson, usersJson) -> {
                    List<String[]> lines = new ArrayList<>();
                    lines.add(new String[]{"Type", "ID", "Détail", "Statut/Rôle"});

                    String[] incBlocks = incJson.split("\\{\\s*\"id_signalement\"");
                    for (int i = 1; i < incBlocks.length; i++) {
                        String b = incBlocks[i];
                        String id = extractRaw(b, "^\\s*:\\s*(\\d+)");
                        String motif = extractField(b, "motif");
                        String statut = extractField(b, "statut");
                        lines.add(new String[]{"Incident", id, motif.isEmpty() ? "Aucun motif" : motif, statut});
                    }

                    String[] userBlocks = usersJson.split("\\{\\s*\"id_user\"");
                    for (int i = 1; i < userBlocks.length; i++) {
                        String b = userBlocks[i];
                        String id = extractRaw(b, "^\\s*:\\s*(\\d+)");
                        String email = extractField(b, "email");
                        String role = extractField(b, "role");
                        lines.add(new String[]{"Voisin", id, email, role});
                    }
                    return lines;
                })
                .thenAccept(lines -> {
                    csvData.addAll(lines);
                    StringBuilder sb = new StringBuilder();
                    sb.append("RAPPORT QUARTIER \n\n");
                    sb.append(String.format("%-12s %-6s %-35s %-15s%n", "Type", "ID", "Détail", "Statut/Rôle"));
                    sb.append("-".repeat(72)).append("\n");
                    for (int i = 1; i < lines.size(); i++) {
                        String[] row = lines.get(i);
                        sb.append(String.format("%-12s %-6s %-35s %-15s%n",
                                row[0], row[1],
                                row[2].length() > 33 ? row[2].substring(0, 33) + ".." : row[2],
                                row[3]));
                    }
                    Platform.runLater(() -> {
                        preview.setText(sb.toString());
                        btnExport.setDisable(false);
                        int nb = lines.size() - 1;
                        statusLabel.setText(nb + " enregistrements chargés. Prêt à exporter.");
                        statusLabel.setStyle("-fx-text-fill: #0CA789; -fx-font-weight: bold;");
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> {
                        statusLabel.setText("Erreur de chargement : vérifiez votre connexion.");
                        statusLabel.setStyle("-fx-text-fill: #E74C3C;");
                        preview.setText("Impossible de récupérer les données.\n" + ex.getMessage());
                    });
                    return null;
                });

        btnExport.setOnAction(e -> {
            FileChooser fc = new FileChooser();
            fc.setTitle("Enregistrer le rapport CSV");
            fc.getExtensionFilters().add(new FileChooser.ExtensionFilter("Fichier CSV", "*.csv"));
            fc.setInitialFileName("rapport_quartier.csv");
            File file = fc.showSaveDialog(stage);
            if (file != null) {
                try (Writer w = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(file), StandardCharsets.UTF_8))) {
                    w.write("﻿"); // BOM UTF-8 pour Excel
                    w.write("Type;ID;Détail;Statut/Rôle\n");
                    for (int i = 1; i < csvData.size(); i++) {
                        String[] row = csvData.get(i);
                        w.write(String.join(";", row) + "\n");
                    }
                    statusLabel.setText("Fichier exporté : " + file.getName());
                    statusLabel.setStyle("-fx-text-fill: #0CA789; -fx-font-weight: bold;");
                } catch (IOException ex) {
                    statusLabel.setText("Erreur d'écriture : " + ex.getMessage());
                    statusLabel.setStyle("-fx-text-fill: #E74C3C;");
                }
            }
        });

        VBox root = new VBox(15, title, statusLabel, preview, btnBar);
        root.setPadding(new Insets(25));
        root.setStyle("-fx-background-color: #1a2638;");

        Scene scene = new Scene(root);
        applyStylesheet(scene);
        stage.setScene(scene);
        stage.show();
    }

    private String extractRaw(String block, String regex) {
        Matcher m = Pattern.compile(regex).matcher(block);
        return m.find() ? m.group(1) : "";
    }

    private String extractField(String block, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
        return m.find() ? m.group(1) : "";
    }

    private void applyStylesheet(Scene scene) {
        java.net.URL css = getClass().getResource("/com/neighborhood_manager/style.css");
        if (css != null) scene.getStylesheets().add(css.toExternalForm());
    }
}