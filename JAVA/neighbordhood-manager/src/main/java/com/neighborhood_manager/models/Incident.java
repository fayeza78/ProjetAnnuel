package com.neighborhood_manager.models;

public class Incident {
    private String id;
    private String description;
    private String status; // "PENDING", "RESOLVED"

    public Incident(String id, String description, String status) {
        this.id = id;
        this.description = description;
        this.status = status;
    }

    public String getId() { return id; }
    public String getDescription() { return description; }
    public String getStatus() { return status; }
}