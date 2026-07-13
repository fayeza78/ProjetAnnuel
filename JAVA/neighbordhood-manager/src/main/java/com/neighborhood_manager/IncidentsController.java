package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
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

    // ===== Tableau Signalements =====
    @FXML private TableView<Incident> signalTable;
    @FXML private TableColumn<Incident, String> colSignalDescription;
    @FXML private TableColumn<Incident, String> colSignalStatus;
    @FXML private TableColumn<Incident, Void>   colSignalAction;

    // ===== Tableau Incidents =====
    @FXML private TableView<IncidentEntry> incidentTable;
    @FXML private TableColumn<IncidentEntry, String> colIncidentDescription;
    @FXML private TableColumn<IncidentEntry, String> colIncidentEmail;
    @FXML private TableColumn<IncidentEntry, String> colIncidentDate;
    @FXML private TableColumn<IncidentEntry, String> colIncidentStatus;
    @FXML private TableColumn<IncidentEntry, Void>   colIncidentAction;

    // ===== Communs =====
    @FXML private Button btnRefresh;
    @FXML private Label lblDataSource;

    private final ObservableList<Incident>      signalList   = FXCollections.observableArrayList();
    private final ObservableList<IncidentEntry> incidentList = FXCollections.observableArrayList();

    @FXML
    public void initialize() {
        colSignalDescription.setCellValueFactory(new PropertyValueFactory<>("motif"));
        colSignalStatus.setCellValueFactory(new PropertyValueFactory<>("statut"));
        signalTable.setItems(signalList);
        ajouterBoutonSignal();

        colIncidentDescription.setCellValueFactory(new PropertyValueFactory<>("description"));
        colIncidentEmail.setCellValueFactory(new PropertyValueFactory<>("email"));
        colIncidentDate.setCellValueFactory(new PropertyValueFactory<>("createdAt"));
        colIncidentStatus.setCellValueFactory(new PropertyValueFactory<>("statut"));
        incidentTable.setItems(incidentList);
        ajouterBoutonIncident();

        refreshAll();
    }

    @FXML
    private void refreshAll() {
        setLoading(true);

        if (!SessionManager.getInstance().isLoggedIn()) {
            loadFromCache("Mode hors ligne — données depuis le cache local");
            return;
        }

        // Fetch signalements et incidents en parallèle
        CompletableFuture<List<Incident>> futureSignal = ApiService.fetchSignalements()
                .thenApply(this::parseSignalements)
                .exceptionally(ex -> {
                    System.out.println("[Incidents] /signalements injoignable, fallback cache.");
                    return DatabaseConnection.loadCachedIncidents();
                });

        CompletableFuture<List<IncidentEntry>> futureIncident = ApiService.fetchIncidents()
                .thenApply(this::parseIncidents)
                .exceptionally(ex -> {
                    System.out.println("[Incidents] /incidents injoignable, fallback cache.");
                    return DatabaseConnection.loadCachedIncidentEntries();
                });

        CompletableFuture.allOf(futureSignal, futureIncident).thenAccept(v -> {
            List<Incident>      signaux   = futureSignal.join();
            List<IncidentEntry> incidents = futureIncident.join();
            DatabaseConnection.cacheIncidents(signaux);
            DatabaseConnection.cacheIncidentEntries(incidents);
            Platform.runLater(() -> {
                afficherSignalements(FXCollections.observableArrayList(signaux));
                afficherIncidents(FXCollections.observableArrayList(incidents));
                setDataSource("Données en temps réel — API");
                setLoading(false);
            });
        });
    }

    private void loadFromCache(String source) {
        List<Incident>      signaux   = DatabaseConnection.loadCachedIncidents();
        List<IncidentEntry> incidents = DatabaseConnection.loadCachedIncidentEntries();
        afficherSignalements(FXCollections.observableArrayList(signaux));
        afficherIncidents(FXCollections.observableArrayList(incidents));
        setDataSource(source);
        setLoading(false);
    }

    private void afficherSignalements(ObservableList<Incident> liste) {
        signalList.setAll(liste);
    }

    private void afficherIncidents(ObservableList<IncidentEntry> liste) {
        incidentList.setAll(liste);
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

            String motif = "Aucun motif spécifié";
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
        System.out.println("[Incidents] " + list.size() + " signalements parsés.");
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

            // email dans l'objet "user" imbriqué
            String email = "";
            Matcher mEmail = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"").matcher(block);
            if (mEmail.find()) email = mEmail.group(1);

            // createdAt → on garde uniquement la partie date (yyyy-MM-dd)
            String createdAt = "";
            Matcher mDate = Pattern.compile("\"createdAt\"\\s*:\\s*\"([^\"T]+)").matcher(block);
            if (mDate.find()) createdAt = mDate.group(1);

            if (!id.isEmpty()) {
                try { list.add(new IncidentEntry(Integer.parseInt(id), description, statut, email, createdAt)); }
                catch (NumberFormatException ignored) {}
            }
        }
        System.out.println("[Incidents] " + list.size() + " incidents parsés.");
        return list;
    }

    // ======================== BOUTONS ACTION ========================

    private void ajouterBoutonSignal() {
        boolean online = SessionManager.getInstance().isLoggedIn();
        Callback<TableColumn<Incident, Void>, TableCell<Incident, Void>> factory = param -> new TableCell<>() {
            private final Button btn = new Button("Traiter");
            {
                btn.setStyle("-fx-background-color: #F29C38; -fx-text-fill: white; -fx-font-weight: bold; -fx-background-radius: 5; -fx-cursor: hand;");
                btn.setOnAction(e -> {
                    Incident data = getTableView().getItems().get(getIndex());
                    btn.setDisable(true);
                    ApiService.traiterSignalement(String.valueOf(data.getId_signalement()))
                            .thenAccept(success -> Platform.runLater(() -> {
                                if (success) {
                                    new Alert(Alert.AlertType.INFORMATION, "Signalement marqué comme Résolu !").show();
                                    refreshAll();
                                } else {
                                    btn.setDisable(false);
                                }
                            }));
                });
            }
            @Override
            public void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setGraphic(null); return; }
                Incident inc = getTableView().getItems().get(getIndex());
                setGraphic(online && !"Résolu".equals(inc.getStatut()) ? btn : null);
            }
        };
        colSignalAction.setCellFactory(factory);
    }

    private void ajouterBoutonIncident() {
        boolean online = SessionManager.getInstance().isLoggedIn();
        Callback<TableColumn<IncidentEntry, Void>, TableCell<IncidentEntry, Void>> factory = param -> new TableCell<>() {
            private final Button btn = new Button("Traiter");
            {
                btn.setStyle("-fx-background-color: #F29C38; -fx-text-fill: white; -fx-font-weight: bold; -fx-background-radius: 5; -fx-cursor: hand;");
                btn.setOnAction(e -> {
                    IncidentEntry data = getTableView().getItems().get(getIndex());
                    btn.setDisable(true);
                    ApiService.updateIncidentStatut(data.getId())
                            .thenAccept(success -> Platform.runLater(() -> {
                                if (success) {
                                    new Alert(Alert.AlertType.INFORMATION, "Incident marqué comme Résolu !").show();
                                    refreshAll();
                                } else {
                                    btn.setDisable(false);
                                }
                            }));
                });
            }
            @Override
            public void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setGraphic(null); return; }
                IncidentEntry inc = getTableView().getItems().get(getIndex());
                setGraphic(online && !"Résolu".equals(inc.getStatut()) ? btn : null);
            }
        };
        colIncidentAction.setCellFactory(factory);
    }

    // ======================== UTILITAIRES ========================

    private void setLoading(boolean loading) {
        if (btnRefresh == null) return;
        btnRefresh.setDisable(loading);
        btnRefresh.setText(loading ? "Chargement..." : "Actualiser");
    }

    private void setDataSource(String text) {
        if (lblDataSource != null) lblDataSource.setText(text);
    }
}
