package com.neighborhood_manager.plugins;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class PluginManager {

    private static PluginManager instance;
    private final List<Plugin> plugins = new ArrayList<>();

    private PluginManager() {
        plugins.add(new ExportStatPlugin());
        plugins.add(new AnalyseSocialePlugin());
        plugins.add(new CalendrierPlugin());
    }

    public static synchronized PluginManager getInstance() {
        if (instance == null) {
            instance = new PluginManager();
        }
        return instance;
    }

    public List<Plugin> getPlugins() {
        return Collections.unmodifiableList(plugins);
    }
}
