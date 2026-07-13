package com.neighborhood_manager.models;

public class IncidentEntry {
    private int id;
    private String description;
    private String statut;
    private String email;
    private String createdAt;

    public IncidentEntry() {}

    public IncidentEntry(int id, String description, String statut, String email, String createdAt) {
        this.id = id;
        this.description = description != null ? description : "";
        this.statut = statut != null ? statut : "En cours";
        this.email = email != null ? email : "";
        this.createdAt = createdAt != null ? createdAt : "";
    }

    public int getId() { return id; }
    public void setId(int id) { this.id = id; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getStatut() { return statut; }
    public void setStatut(String statut) { this.statut = statut; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
}
