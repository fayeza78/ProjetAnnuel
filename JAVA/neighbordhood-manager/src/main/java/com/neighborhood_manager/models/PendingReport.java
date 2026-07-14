package com.neighborhood_manager.models;

public class PendingReport {
    private int id;
    private String type;        // "signalement" ou "incident"
    private String description;
    private String cibleType;   // pour signalements : type de cible
    private String cibleId;     // pour signalements : id de la cible
    private String createdAt;

    public PendingReport(int id, String type, String description, String cibleType, String cibleId, String createdAt) {
        this.id = id;
        this.type = type != null ? type : "signalement";
        this.description = description != null ? description : "";
        this.cibleType = cibleType != null ? cibleType : "";
        this.cibleId   = cibleId   != null ? cibleId   : "";
        this.createdAt = createdAt != null ? createdAt : "";
    }

    public int    getId()          { return id; }
    public String getType()        { return type; }
    public String getDescription() { return description; }
    public String getCibleType()   { return cibleType; }
    public String getCibleId()     { return cibleId; }
    public String getCreatedAt()   { return createdAt; }
}
