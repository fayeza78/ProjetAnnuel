package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.database.SessionManager;
import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;
import com.neighborhood_manager.models.PendingReport;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.geometry.Insets;
import javafx.scene.control.*;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.layout.GridPane;
import javafx.scene.layout.HBox;
import javafx.util.Callback;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class IncidentsController {

    // ===== Barre de synchronisation =====
    @FXML private HBox pendingBar;
    @FXML private Label lblPendingCount;
    @FXML private Button btnSync;

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
        appliquerStyleLigneSignal();
        ajouterBoutonSignal();

        colIncidentDescription.setCellValueFactory(new PropertyValueFactory<>("description"));
        colIncidentEmail.setCellValueFactory(new PropertyValueFactory<>("email"));
        colIncidentDate.setCellValueFactory(new PropertyValueFactory<>("createdAt"));
        colIncidentStatus.setCellValueFactory(new PropertyValueFactory<>("statut"));
        incidentTable.setItems(incidentList);
        appliquerStyleLigneIncident();
        ajouterBoutonIncident();

        if (pendingBar != null) pendingBar.managedProperty().bind(pendingBar.visibleProperty());

        rafraichirPending();

        // Auto-sync au démarrage uniquement (pas dans refreshAll pour éviter la boucle)
        if (SessionManager.getInstance().isLoggedIn()
                && DatabaseConnection.countPendingReports() > 0) {
            syncPending();
        } else {
            recargerDonnees();
        }
    }

    // ======================== CHARGEMENT DES DONNÉES ========================

    /**
     * Rafraîchissement complet déclenché par le bouton "Actualiser".
     * N'appelle JAMAIS syncPending() pour éviter une boucle récursive.
     */
    @FXML
    private void refreshAll() {
        recargerDonnees();
    }

    /** Charge les données depuis l'API (ou cache) sans déclencher de sync. */
    private void recargerDonnees() {
        setLoading(true);

        if (!SessionManager.getInstance().isLoggedIn()) {
            loadFromCache("Mode hors ligne — données depuis le cache local");
            return;
        }

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

        for (PendingReport p : DatabaseConnection.loadPendingReports()) {
            if ("signalement".equals(p.getType())) {
                signaux.add(0, new Incident(p.getId(), p.getDescription(), "Hors ligne"));
            } else {
                incidents.add(0, new IncidentEntry(p.getId(), p.getDescription(), "Hors ligne", "", p.getCreatedAt()));
            }
        }

        afficherSignalements(FXCollections.observableArrayList(signaux));
        afficherIncidents(FXCollections.observableArrayList(incidents));
        setDataSource(source);
        setLoading(false);
    }

    private void afficherSignalements(ObservableList<Incident> liste) { signalList.setAll(liste); }
    private void afficherIncidents(ObservableList<IncidentEntry> liste) { incidentList.setAll(liste); }

    // ======================== CRÉATION OFFLINE/ONLINE ========================

    @FXML
    private void nouveauSignalement() {
        // Formulaire avec les 3 champs requis par l'API
        Dialog<String[]> dialog = new Dialog<>();
        dialog.setTitle("Nouveau signalement");
        dialog.setHeaderText("Remplir les champs requis");
        dialog.getDialogPane().setStyle("-fx-background-color: #233348;");

        ButtonType btnEnvoyer = new ButtonType("Envoyer", ButtonBar.ButtonData.OK_DONE);
        dialog.getDialogPane().getButtonTypes().addAll(btnEnvoyer, ButtonType.CANCEL);

        GridPane grid = new GridPane();
        grid.setHgap(12);
        grid.setVgap(10);
        grid.setPadding(new Insets(20, 20, 10, 20));
        grid.setStyle("-fx-background-color: #233348;");

        TextField tfMotif   = styledField("Ex : Bruit excessif au 3e étage");
        TextField tfCibleId = styledField("Ex : 42");

        ComboBox<String> cbCibleType = new ComboBox<>(
                FXCollections.observableArrayList("message", "service", "evenement", "user"));
        cbCibleType.setPromptText("Sélectionner un type");
        cbCibleType.setMinWidth(280);
        cbCibleType.setStyle("-fx-background-color: #1A2639; -fx-text-fill: white; -fx-border-color: #2E435E;" +
                             "-fx-border-radius: 4; -fx-background-radius: 4;");

        grid.add(label("Motif *"),       0, 0); grid.add(tfMotif,     1, 0);
        grid.add(label("Cible type *"),  0, 1); grid.add(cbCibleType, 1, 1);
        grid.add(label("Cible ID *"),    0, 2); grid.add(tfCibleId,   1, 2);

        dialog.getDialogPane().setContent(grid);

        // Désactive le bouton Envoyer tant que les champs sont vides
        Button sendBtn = (Button) dialog.getDialogPane().lookupButton(btnEnvoyer);
        sendBtn.setDisable(true);
        Runnable checkFields = () -> sendBtn.setDisable(
                tfMotif.getText().isBlank() || cbCibleType.getValue() == null || tfCibleId.getText().isBlank());
        tfMotif.textProperty().addListener((o, a, b) -> checkFields.run());
        cbCibleType.valueProperty().addListener((o, a, b) -> checkFields.run());
        tfCibleId.textProperty().addListener((o, a, b) -> checkFields.run());

        dialog.setResultConverter(btn -> btn == btnEnvoyer
                ? new String[]{tfMotif.getText().trim(), cbCibleType.getValue(), tfCibleId.getText().trim()}
                : null);

        Optional<String[]> result = dialog.showAndWait();
        result.ifPresent(fields -> {
            String motif = fields[0], cibleType = fields[1], cibleId = fields[2];
            if (!SessionManager.getInstance().isLoggedIn()) {
                sauvegarderOffline("signalement", motif, cibleType, cibleId);
                return;
            }
            setLoading(true);
            ApiService.postSignalement(motif, cibleType, cibleId)
                    .thenAccept(success -> Platform.runLater(() -> {
                        setLoading(false);
                        if (success) {
                            new Alert(Alert.AlertType.INFORMATION, "Signalement envoyé avec succès !").showAndWait();
                            recargerDonnees();
                        } else {
                            new Alert(Alert.AlertType.ERROR,
                                    "Le serveur a refusé le signalement.\nConsultez la console pour le détail.").show();
                        }
                    }))
                    .exceptionally(ex -> {
                        System.out.println("[Incidents] Réseau injoignable pour POST signalement : " + ex.getMessage());
                        Platform.runLater(() -> sauvegarderOffline("signalement", motif, cibleType, cibleId));
                        return null;
                    });
        });
    }

    @FXML
    private void nouvelIncident() {
        TextInputDialog dialog = new TextInputDialog();
        dialog.setTitle("Nouvel incident");
        dialog.setHeaderText("Décrire l'incident");
        dialog.setContentText("Description :");
        styleDialog(dialog);

        Optional<String> result = dialog.showAndWait();
        result.filter(s -> !s.isBlank()).ifPresent(description -> {
            if (!SessionManager.getInstance().isLoggedIn()) {
                sauvegarderOffline("incident", description);
                return;
            }
            setLoading(true);
            ApiService.postIncident(description)
                    .thenAccept(success -> Platform.runLater(() -> {
                        setLoading(false);
                        if (success) {
                            new Alert(Alert.AlertType.INFORMATION, "Incident envoyé avec succès !").showAndWait();
                            recargerDonnees();
                        } else {
                            new Alert(Alert.AlertType.ERROR,
                                    "Le serveur a refusé l'incident (vérifiez les champs ou les droits).\n" +
                                    "Consultez la console pour le code d'erreur.").show();
                        }
                    }))
                    .exceptionally(ex -> {
                        System.out.println("[Incidents] Réseau injoignable pour POST incident : " + ex.getMessage());
                        Platform.runLater(() -> sauvegarderOffline("incident", description));
                        return null;
                    });
        });
    }

    private void sauvegarderOffline(String type, String description) {
        sauvegarderOffline(type, description, "", "");
    }

    private void sauvegarderOffline(String type, String description, String cibleType, String cibleId) {
        DatabaseConnection.savePendingReport(type, description, cibleType, cibleId);
        rafraichirPending();
        if ("signalement".equals(type)) {
            signalList.add(0, new Incident(0, description, "Hors ligne"));
        } else {
            incidentList.add(0, new IncidentEntry(0, description, "Hors ligne", "", ""));
        }
        setLoading(false);
        new Alert(Alert.AlertType.INFORMATION,
                "Sauvegardé hors ligne.\nIl sera synchronisé automatiquement à la prochaine connexion.").show();
    }

    // ======================== SYNCHRONISATION ========================

    @FXML
    private void syncPending() {
        List<PendingReport> pending = DatabaseConnection.loadPendingReports();
        if (pending.isEmpty()) {
            rafraichirPending();
            return;
        }
        if (btnSync != null) {
            btnSync.setDisable(true);
            btnSync.setText("Sync en cours...");
        }
        syncNext(pending, 0, 0);
    }

    private void syncNext(List<PendingReport> pending, int index, int synced) {
        if (index >= pending.size()) {
            // FIN de la sync — affiche le résultat PUIS recharge les données
            // showAndWait() bloque jusqu'à la fermeture du dialog (pas de boucle possible)
            int finalSynced = synced;
            Platform.runLater(() -> {
                rafraichirPending();
                new Alert(Alert.AlertType.INFORMATION,
                        finalSynced + "/" + pending.size() + " rapport(s) synchronisé(s).").showAndWait();
                recargerDonnees(); // safe : pas de syncPending() à l'intérieur
            });
            return;
        }

        PendingReport report = pending.get(index);
        CompletableFuture<Boolean> future = "signalement".equals(report.getType())
                ? ApiService.postSignalement(report.getDescription(), report.getCibleType(), report.getCibleId())
                : ApiService.postIncident(report.getDescription());

        future.thenAccept(success -> {
            if (success) DatabaseConnection.deletePendingReport(report.getId());
            else System.out.println("[Sync] Échec serveur pour rapport #" + report.getId());
            syncNext(pending, index + 1, success ? synced + 1 : synced);
        }).exceptionally(ex -> {
            System.out.println("[Sync] Erreur réseau rapport #" + report.getId() + " : " + ex.getMessage());
            syncNext(pending, index + 1, synced);
            return null;
        });
    }

    private void rafraichirPending() {
        int count = DatabaseConnection.countPendingReports();
        Runnable update = () -> {
            if (pendingBar != null) pendingBar.setVisible(count > 0);
            if (lblPendingCount != null)
                lblPendingCount.setText(count + " rapport(s) en attente de synchronisation");
            if (btnSync != null) {
                btnSync.setDisable(false);
                btnSync.setText("Synchroniser maintenant");
            }
        };
        if (Platform.isFxApplicationThread()) update.run();
        else Platform.runLater(update);
    }

    // ======================== STYLE DES LIGNES ========================

    private void appliquerStyleLigneSignal() {
        signalTable.setRowFactory(tv -> new TableRow<>() {
            @Override
            protected void updateItem(Incident item, boolean empty) {
                super.updateItem(item, empty);
                setStyle("Hors ligne".equals(item != null ? item.getStatut() : "")
                        ? "-fx-background-color: rgba(242,156,56,0.12);" : "");
            }
        });
    }

    private void appliquerStyleLigneIncident() {
        incidentTable.setRowFactory(tv -> new TableRow<>() {
            @Override
            protected void updateItem(IncidentEntry item, boolean empty) {
                super.updateItem(item, empty);
                setStyle("Hors ligne".equals(item != null ? item.getStatut() : "")
                        ? "-fx-background-color: rgba(242,156,56,0.12);" : "");
            }
        });
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
                                if (success) { new Alert(Alert.AlertType.INFORMATION, "Signalement résolu !").show(); recargerDonnees(); }
                                else btn.setDisable(false);
                            }));
                });
            }
            @Override
            public void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setGraphic(null); return; }
                Incident inc = getTableView().getItems().get(getIndex());
                boolean show = online && !"Résolu".equals(inc.getStatut()) && !"Hors ligne".equals(inc.getStatut());
                setGraphic(show ? btn : null);
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
                                if (success) { new Alert(Alert.AlertType.INFORMATION, "Incident résolu !").show(); recargerDonnees(); }
                                else btn.setDisable(false);
                            }));
                });
            }
            @Override
            public void updateItem(Void item, boolean empty) {
                super.updateItem(item, empty);
                if (empty) { setGraphic(null); return; }
                IncidentEntry inc = getTableView().getItems().get(getIndex());
                boolean show = online && !"Résolu".equals(inc.getStatut()) && !"Hors ligne".equals(inc.getStatut());
                setGraphic(show ? btn : null);
            }
        };
        colIncidentAction.setCellFactory(factory);
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
        System.out.println("[Incidents] " + list.size() + " incidents parsés.");
        return list;
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

    private void styleDialog(Dialog<?> dialog) {
        dialog.getDialogPane().setStyle("-fx-background-color: #233348;");
    }

    private TextField styledField(String prompt) {
        TextField tf = new TextField();
        tf.setPromptText(prompt);
        tf.setMinWidth(280);
        tf.setStyle("-fx-background-color: #1A2639; -fx-text-fill: white; -fx-prompt-text-fill: #8BA0B8;" +
                    "-fx-border-color: #2E435E; -fx-border-radius: 4; -fx-background-radius: 4; -fx-padding: 6 10;");
        return tf;
    }

    private Label label(String text) {
        Label lbl = new Label(text);
        lbl.setStyle("-fx-text-fill: #8BA0B8; -fx-font-size: 12px;");
        return lbl;
    }
}
