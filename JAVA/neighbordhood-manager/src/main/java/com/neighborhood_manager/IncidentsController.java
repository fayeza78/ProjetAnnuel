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

    private final ObservableList<Incident> incidentList = FXCollections.observableArrayList();

    @FXML
    public void initialize() {
        // Liaison avec les Getters d'origine de ton modèle Incident (getDescription et getStatus)
        colDescription.setCellValueFactory(new PropertyValueFactory<>("motif"));
        colStatus.setCellValueFactory(new PropertyValueFactory<>("statut"));

        incidentsTable.setItems(incidentList);

        ajouterBoutonAction();
        refreshIncidents(); // Chargement des données au clic sur le menu
    }

    @FXML
    private void refreshIncidents() {
        if (btnRefresh != null) {
            btnRefresh.setDisable(true);
            btnRefresh.setText("Chargement...");
        }

        ApiService.fetchSignalements()
                .thenAccept(jsonResponse -> {
                    System.out.println("====== REPONSE DU SERVEUR NODE.JS ======");
                    System.out.println(jsonResponse);
                    System.out.println("========================================");

                    ObservableList<Incident> tempSetupList = parseIncidentsJson(jsonResponse);

                    Platform.runLater(() -> {
                        incidentList.clear();
                        incidentList.addAll(tempSetupList);
                        if (btnRefresh != null) {
                            btnRefresh.setDisable(false);
                            btnRefresh.setText("Actualiser les Signalements");
                        }
                    });
                })
                .exceptionally(ex -> {
                    Platform.runLater(() -> {
                        if (btnRefresh != null) {
                            btnRefresh.setDisable(false);
                            btnRefresh.setText("Actualiser les Signalements");
                        }
                        Alert alert = new Alert(Alert.AlertType.WARNING, "Impossible de joindre le serveur pour les incidents.");
                        alert.show();
                    });
                    return null;
                });
    }

    /**
     * Parseur par blocs isolé : découpe le JSON reçu pour extraire proprement
     * id_signalement, motif et statut sans être bloqué par l'objet imbriqué "signaleur"
     */
    private ObservableList<Incident> parseIncidentsJson(String json) {
        ObservableList<Incident> list = FXCollections.observableArrayList();

        // On découpe la chaîne brute reçue par bloc d'incident
        String[] blocks = json.split("\\{\\s*\"id_signalement\"");

        // Le premier index [0] contient le crochet ouvrant "[", on démarre à 1
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];

            // 1. Extraction de l'ID (Juste après le séparateur de split)
            String id = "";
            Pattern pId = Pattern.compile("^\\s*:\\s*(\\d+)");
            Matcher mId = pId.matcher(block);
            if (mId.find()) {
                id = mId.group(1);
            }

            // 2. Extraction du Motif (qui va alimenter le champ description du Java)
            String description = "Aucun motif spécifié";
            Pattern pMotif = Pattern.compile("\"motif\"\\s*:\\s*\"([^\"]+)\"");
            Matcher mMotif = pMotif.matcher(block);
            if (mMotif.find()) {
                description = mMotif.group(1);
            }

            // 3. Extraction du Statut de la BDD ('ouvert' -> 'En cours', sinon 'Résolu')
            String statusAffiche = "En cours";
            Pattern pStatut = Pattern.compile("\"statut\"\\s*:\\s*\"([^\"]+)\"");
            Matcher mStatut = pStatut.matcher(block);
            if (mStatut.find()) {
                String statutBrut = mStatut.group(1);
                statusAffiche = statutBrut.equals("ouvert") ? "En cours" : "Résolu";
            }

            // Si l'ID a bien été trouvé, on instancie l'incident dans ton modèle d'origine
            if (!id.isEmpty()) {
                try {
                    int idInt = Integer.parseInt(id);
                    list.add(new Incident(idInt, description, statusAffiche));
                } catch (NumberFormatException e) {
                    System.err.println("Erreur de conversion de l'ID : " + id);
                }
            }
        }

        System.out.println("[Parseur] Nombre d'incidents décodés avec succès : " + list.size());
        return list;
    }

    /**
     * Génère dynamiquement le bouton "Traiter" sur chaque ligne du tableau
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
                            ApiService.traiterSignalement(String.valueOf(data.getId_signalement()))
                                    .thenAccept(success -> {
                                        Platform.runLater(() -> {
                                            if (success) {
                                                Alert alert = new Alert(Alert.AlertType.INFORMATION, "L'incident a été marqué comme Résolu !");
                                                alert.show();
                                                refreshIncidents(); // Actualiser le tableau à jour
                                            } else {
                                                btn.setDisable(false);
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
                            // Si le statut est à 'Résolu', on cache le bouton de traitement
                            if ("Résolu".equals(incident.getStatut())) {
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