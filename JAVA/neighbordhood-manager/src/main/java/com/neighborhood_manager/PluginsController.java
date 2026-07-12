package com.neighborhood_manager;

import com.neighborhood_manager.plugins.Plugin;
import com.neighborhood_manager.plugins.PluginManager;
import javafx.fxml.FXML;
import javafx.geometry.Pos;
import javafx.scene.control.Button;
import javafx.scene.control.Label;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Priority;
import javafx.scene.layout.VBox;

public class PluginsController {

    @FXML private VBox pluginListContainer;

    @FXML
    public void initialize() {
        for (Plugin plugin : PluginManager.getInstance().getPlugins()) {
            pluginListContainer.getChildren().add(buildPluginCard(plugin));
        }
    }

    private HBox buildPluginCard(Plugin plugin) {
        VBox info = new VBox(5);
        Label name = new Label(plugin.getName());
        name.setStyle("-fx-font-size: 15px; -fx-font-weight: bold; -fx-text-fill: white;");
        Label desc = new Label(plugin.getDescription());
        desc.setStyle("-fx-text-fill: #8BA0B8; -fx-font-size: 12px;");
        desc.setWrapText(true);
        info.getChildren().addAll(name, desc);
        HBox.setHgrow(info, Priority.ALWAYS);

        Button btn = new Button("Exécuter");
        btn.getStyleClass().add("button-primary");
        btn.setOnAction(e -> plugin.execute());

        HBox card = new HBox(20, info, btn);
        card.setStyle("-fx-background-color: #233348; -fx-background-radius: 12; -fx-padding: 20; -fx-border-color: #2E435E; -fx-border-radius: 12; -fx-border-width: 1;");
        card.setAlignment(Pos.CENTER_LEFT);
        return card;
    }
}
