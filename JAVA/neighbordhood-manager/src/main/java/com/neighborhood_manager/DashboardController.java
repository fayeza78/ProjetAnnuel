package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import javafx.application.Platform;
import javafx.fxml.FXML;
import javafx.scene.control.Label;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DashboardController {

    @FXML private Label lblTotalIncidents;
    @FXML private Label lblIncidentsOuverts;
    @FXML private Label lblIncidentsResolus;

    @FXML
    public void initialize() {
        refreshDashboardStats();
    }

    private void refreshDashboardStats() {
        System.out.println("Chargement des statistiques du Dashboard...");

        ApiService.fetchStatsIncidents()
                .thenAccept(jsonResponse -> {
                    System.out.println("====== JSON STATS RECUES ======");
                    System.out.println(jsonResponse);
                    System.out.println("===============================");

                    // Extraction des compteurs via Regex (S'adapte à la structure retournée par ton API)
                    // On suppose ici que ton serveur renvoie des clés comme "total", "ouverts", "resolus"
                    int total = extractJsonInt(jsonResponse, "total");
                    int ouverts = extractJsonInt(jsonResponse, "ouverts");
                    int resolus = extractJsonInt(jsonResponse, "resolus");

                    // Si les clés portent des noms différents dans ton Swagger, on ajustera !
                    if (total == 0 && jsonResponse.contains("id_status")) {
                        // Secours si l'API renvoie une liste brute au lieu d'un résumé : on compte les occurrences
                        total = jsonResponse.split("\"id_").length - 1;
                    }

                    final int finalTotal = total;
                    final int finalOuverts = ouverts;
                    final int finalResolus = resolus;

                    // Mise à jour de l'interface graphique sur le Thread JavaFX principal
                    Platform.runLater(() -> {
                        if (lblTotalIncidents != null) lblTotalIncidents.setText(String.valueOf(finalTotal));
                        if (lblIncidentsOuverts != null) lblIncidentsOuverts.setText(String.valueOf(finalOuverts));
                        if (lblIncidentsResolus != null) lblIncidentsResolus.setText(String.valueOf(finalResolus));
                    });
                })
                .exceptionally(ex -> {
                    System.err.println("Impossible de charger les stats : " + ex.getMessage());
                    return null;
                });
    }

    /**
     * Utilitaire d'extraction d'entier dans un JSON brut
     */
    private int extractJsonInt(String json, String key) {
        Pattern pattern = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return Integer.parseInt(matcher.group(1));
        }
        return 0;
    }
}