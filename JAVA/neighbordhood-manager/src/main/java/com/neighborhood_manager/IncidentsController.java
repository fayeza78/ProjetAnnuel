package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.models.Incident;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.util.Callback;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class IncidentsController {

    @FXML private TableView<Incident> incidentsTable;
    @FXML private TableColumn<Incident, String> colDescription;
    @FXML private TableColumn<Incident, String> colStatus;
    @FXML private TableColumn<Incident, Void> colAction;
    @FXML private Button btnRefresh;

    @FXML
    public void initialize() {
        colDescription.setCellValueFactory(new PropertyValueFactory<>("description"));
        colStatus.setCellValueFactory(new PropertyValueFactory<>("status"));

        ajouterBoutonAction();
        refreshIncidents(); // Chargement initial au clic sur le menu
    }

    @FXML
    private void refreshIncidents() {
        btnRefresh.setDisable(true);
        btnRefresh.setText("Chargement...");

        ApiService.fetchSignalements()
                .thenAccept(jsonResponse -> {
                    // LINE DE VERIFICATION : On affiche ce que le serveur renvoie réellement
                    System.out.println("====== REPONSE DU SERVEUR NODE.JS ======");
                    System.out.println(jsonResponse);
                    System.out.println("========================================");

                    ObservableList<Incident> list = parseIncidentsJson(jsonResponse);
                    Platform.runLater(() -> {
                        incidentsTable.setItems(list);
                        btnRefresh.setDisable(false);
                        btnRefresh.setText("Actualiser les Signalements");
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> {
                        btnRefresh.setDisable(false);
                        btnRefresh.setText("Actualiser les Signalements");
                        Alert alert = new Alert(Alert.AlertType.WARNING, "Impossible de joindre le serveur pour les incidents.");
                        alert.show();
                    });
                    return null;
                });
    }

    /**
     * Parseur de JSON manuel ultra-robuste adapté à ton Swagger
     */
    private ObservableList<Incident> parseIncidentsJson(String json) {
        ObservableList<Incident> list = FXCollections.observableArrayList();
        // Regex pour attraper l'id, la description et le statut dans le JSON du serveur
        Pattern pattern = Pattern.compile("\\{\\s*\"_id\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"description\"\\s*:\\s*\"([^\"]+)\"\\s*,\\s*\"status\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = pattern.matcher(json);

        while (matcher.find()) {
            String statusValue = matcher.group(3).equals("RESOLVED") ? "Résolu" : "En cours";
            list.add(new Incident(matcher.group(1), matcher.group(2), statusValue));
        }
        return list;
    }

    /**
     * Génère dynamiquement un bouton "Résoudre" sur chaque ligne du tableau
     */
    private void ajouterBoutonAction() {
        Callback<TableColumn<Incident, Void>, TableCell<Incident, Void>> cellFactory = new Callback<>() {
            @Override
            public TableCell<Incident, Void> call(final TableColumn<Incident, Void> param) {
                return new TableCell<>() {
                    private final Button btn = new Button("Traiter");
                    {
                        btn.setStyle("-fx-background-color: #F29C38; -fx-text-fill: white; -fx-font-weight: bold; -fx-background-radius: 5; -fx-cursor: hand;");
                        btn.setOnAction(event -> {
                            Incident data = getTableView().getItems().get(getIndex());
                            btn.setDisable(true);

                            // Appel à l'API Swagger PUT /signalements/{id}/traiter
                            ApiService.traiterSignalement(data.getId())
                                    .thenAccept(success -> {
                                        Platform.runLater(() -> {
                                            if (success) {
                                                Alert alert = new Alert(Alert.AlertType.INFORMATION, "L'incident a été marqué comme Résolu !");
                                                alert.show();
                                                refreshIncidents(); // Rafraîchir le tableau
                                            }
                                        });
                                    });
                        });
                    }

                    @Override
                    public void updateItem(Void item, boolean empty) {
                        super.updateItem(item, empty);
                        if (empty) {
                            setGraphic(null);
                        } else {
                            Incident incident = getTableView().getItems().get(getIndex());
                            // Si déjà résolu, on cache le bouton
                            if ("Résolu".equals(incident.getStatus())) {
                                setGraphic(null);
                            } else {
                                setGraphic(btn);
                            }
                        }
                    }
                };
            }
        };
        colAction.setCellFactory(cellFactory);
    }
}