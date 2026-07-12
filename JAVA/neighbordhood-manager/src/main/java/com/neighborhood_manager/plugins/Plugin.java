package com.neighborhood_manager.plugins;

public interface Plugin {
    String getName();

    String getDescription();

    void execute();
}
