package com.neighborhood_manager;

import com.neighborhood_manager.database.DatabaseConnection;
import com.neighborhood_manager.models.User;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;
import javafx.fxml.FXML;
import javafx.scene.control.*;
import javafx.scene.control.cell.PropertyValueFactory;
import java.sql.*;

public class VoisinsController {
    @FXML private TableView<User> voisinsTable;
    @FXML private TableColumn<User, String> colNom, colEmail, colStatus;

    public void initialize() {
        colNom.setCellValueFactory(new PropertyValueFactory<>("name"));
        colEmail.setCellValueFactory(new PropertyValueFactory<>("email"));
        colStatus.setCellValueFactory(new PropertyValueFactory<>("status"));

        loadVoisinsFromDb();
    }

    private void loadVoisinsFromDb() {
        ObservableList<User> users = FXCollections.observableArrayList();
        try (Connection conn = DatabaseConnection.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT * FROM cached_users")) {

            while (rs.next()) {
                users.add(new User(
                        rs.getString("id"),
                        rs.getString("fullname"),
                        rs.getString("email"),
                        rs.getInt("is_validated") == 1 ? "Validé" : "En attente"
                ));
            }
            voisinsTable.setItems(users);
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    @FXML private void refreshFromApi() {
        System.out.println("Appel API Node.js pour mise à jour...");
    }
}