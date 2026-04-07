package com.neighborhood_manager;
import java.sql.Connection;
import java.sql.SQLException;
import com.neighborhood_manager.database.DatabaseConnection;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;



public class PrimaryController {

    @FXML private Button btnHome, btnVoisins, btnAnnonces, btnMessages, btnSettings;
    @FXML private TextField searchField;

   
    @FXML private void goVoisins() { setActive(btnVoisins); }
    @FXML private void goAnnonces() { setActive(btnAnnonces); }
    @FXML private void goMessages() { setActive(btnMessages); }
    

    private void setActive(Button active) {
        String inactive = "-fx-background-color: transparent; -fx-text-fill: #a8b2d8; -fx-font-size: 13px; -fx-padding: 8 16 8 16; -fx-background-radius: 8; -fx-cursor: hand;";
        String activeStyle = "-fx-background-color: #e94560; -fx-text-fill: white; -fx-font-size: 13px; -fx-padding: 8 16 8 16; -fx-background-radius: 8; -fx-cursor: hand;";

        for (Button b : new Button[]{btnHome, btnVoisins, btnAnnonces, btnMessages, btnSettings}) {
            b.setStyle(inactive);
        }
        active.setStyle(activeStyle);
    }

    @FXML
    private void goHome() {
        setActive(btnHome);
       try (Connection conn = DatabaseConnection.getConnection()) {
            System.out.println(conn != null ? "Connexion réussie à la base de données!" : "Échec de la connexion à la base de données.");
     
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
    @FXML 
    private void goSettings() 
    { 
        setActive(btnSettings); 



    }
}
