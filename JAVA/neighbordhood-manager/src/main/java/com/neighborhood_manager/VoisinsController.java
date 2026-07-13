package com.neighborhood_manager;

import com.neighborhood_manager.database.ApiService;
import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.models.User;

import java.util.List;
import javafx.application.Platform;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.scene.control.Alert;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.cell.PropertyValueFactory;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class VoisinsController {

    @FXML private TableView<User> voisinsTable;
    @FXML private TableColumn<User, String> colEmail;
    @FXML private TableColumn<User, String> colNom;    // Affichera le Quartier et la Ville
    @FXML private TableColumn<User, String> colStatus; // Affichera le Rôle

    private final ObservableList<User> voisinList = FXCollections.observableArrayList();

    @FXML
    public void initialize() {
        // Liaison avec les Getters de ton modèle User
        // On redirige la colonne "Nom Complet" (colNom) vers la propriété "adresse" qu'on va formater proprement
        if (colNom != null) colNom.setCellValueFactory(new PropertyValueFactory<>("adresse"));
        if (colEmail != null) colEmail.setCellValueFactory(new PropertyValueFactory<>("email"));
        if (colStatus != null) colStatus.setCellValueFactory(new PropertyValueFactory<>("role"));

        voisinsTable.setItems(voisinList);

        loadVoisins();
    }

    @FXML
    private void loadVoisins() {
        System.out.println("Récupération des utilisateurs depuis l'API...");

        ApiService.fetchVoisinsFromServer()
                .thenAccept(jsonResponse -> {
                    System.out.println("====== VUE VOISINS : BRUT SERVEUR ======");
                    System.out.println(jsonResponse);
                    System.out.println("========================================");

                    ObservableList<User> tempSetupList = parseVoisinsJson(jsonResponse);

                    // Mise en cache des données fraîches pour un usage offline ultérieur
                    DatabaseConnection.cacheUsers(tempSetupList);

                    Platform.runLater(() -> {
                        voisinList.clear();
                        voisinList.addAll(tempSetupList);
                    });
                })
                .exceptionally(ex -> {
                    // Serveur injoignable : repli sur le cache SQLite
                    System.out.println("[Voisins] API injoignable, lecture du cache SQLite...");
                    List<User> cached = DatabaseConnection.loadCachedUsers();
                    Platform.runLater(() -> {
                        voisinList.clear();
                        voisinList.addAll(cached);
                        if (cached.isEmpty()) {
                            Alert alert = new Alert(Alert.AlertType.WARNING,
                                    "Impossible de charger la liste des voisins (aucune donnée en cache).");
                            alert.show();
                        }
                    });
                    return null;
                });
    }

    /**
     * Parseur par blocs adapté pour lier l'id_quartier et la ville
     */
    private ObservableList<User> parseVoisinsJson(String json) {
        ObservableList<User> list = FXCollections.observableArrayList();

        // Découpage du JSON par bloc utilisateur
        String[] blocks = json.split("\\{\\s*\"id_user\"");

        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];

            // 1. Extraction ID utilisateur
            int id = 0;
            Pattern pId = Pattern.compile("^\\s*:\\s*(\\d+)");
            Matcher mId = pId.matcher(block);
            if (mId.find()) id = Integer.parseInt(mId.group(1));

            // 2. Extraction Email
            String email = "";
            Pattern pEmail = Pattern.compile("\"email\"\\s*:\\s*\"([^\"]+)\"");
            Matcher mEmail = pEmail.matcher(block);
            if (mEmail.find()) email = mEmail.group(1);

            // 3. Extraction Rôle
            String role = "";
            Pattern pRole = Pattern.compile("\"role\"\\s*:\\s*\"([^\"]+)\"");
            Matcher mRole = pRole.matcher(block);
            if (mRole.find()) role = mRole.group(1);

            // 4. Extraction de la Ville
            String ville = "";
            Pattern pVille = Pattern.compile("\"ville\"\\s*:\\s*\"([^\"]*)\"");
            Matcher mVille = pVille.matcher(block);
            if (mVille.find() && !mVille.group(1).equalsIgnoreCase("null")) {
                ville = mVille.group(1).trim();
            }

            // 5. Extraction DIRECTE et DYNAMIQUE de "nom_quartier" depuis la BDD
            String nomQuartier = "";
            Pattern pNomQuartier = Pattern.compile("\"nom_quartier\"\\s*:\\s*\"([^\"]+)\"");
            Matcher mNomQuartier = pNomQuartier.matcher(block);
            if (mNomQuartier.find()) {
                nomQuartier = mNomQuartier.group(1); // Intercepte la vraie chaîne (ex: "Quartier Centre")
            }

            // Assemblage propre et cohérent pour ta colonne colNom
            String affichageFinal = nomQuartier;
            if (affichageFinal.isEmpty()) {
                affichageFinal = "Quartier non renseigné";
            }
            if (!ville.isEmpty()) {
                affichageFinal += " - " + ville;
            }

            if (id != 0) {
                // On passe le texte dynamique au modèle
                list.add(new User(id, email, role, affichageFinal, ville));
            }
        }

        System.out.println("🤖 [Parseur Voisins] Nombre d'utilisateurs décodés : " + list.size());
        return list;
    }
}