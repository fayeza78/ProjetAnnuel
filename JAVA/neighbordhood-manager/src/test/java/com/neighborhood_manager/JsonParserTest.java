package com.neighborhood_manager;

import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;
import com.neighborhood_manager.models.User;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class JsonParserTest {

    // ── parseSignalements ──────────────────────────────────────────────────

    @Test
    void parseSignalements_retourneListe() {
        String json = """
                [
                  {"id_signalement":1,"motif":"Bruit nocturne","statut":"ouvert"},
                  {"id_signalement":2,"motif":"Poubelles non sorties","statut":"resolu"}
                ]
                """;
        List<Incident> result = JsonParser.parseSignalements(json);
        assertEquals(2, result.size());
    }

    @Test
    void parseSignalements_statutOuvertDevientEnCours() {
        String json = """
                [{"id_signalement":1,"motif":"Test","statut":"ouvert"}]
                """;
        List<Incident> result = JsonParser.parseSignalements(json);
        assertEquals("En cours", result.get(0).getStatut());
    }

    @Test
    void parseSignalements_statutAutreDevientResolu() {
        String json = """
                [{"id_signalement":2,"motif":"Test","statut":"resolu"}]
                """;
        List<Incident> result = JsonParser.parseSignalements(json);
        assertEquals("Résolu", result.get(0).getStatut());
    }

    @Test
    void parseSignalements_motifExtrait() {
        String json = """
                [{"id_signalement":3,"motif":"Tag sur mur","statut":"ouvert"}]
                """;
        List<Incident> result = JsonParser.parseSignalements(json);
        assertEquals("Tag sur mur", result.get(0).getMotif());
    }

    @Test
    void parseSignalements_jsonVideRetourneListeVide() {
        List<Incident> result = JsonParser.parseSignalements("[]");
        assertTrue(result.isEmpty());
    }

    // ── parseIncidents ─────────────────────────────────────────────────────

    @Test
    void parseIncidents_retourneListe() {
        String json = """
                [
                  {"id_incident":10,"description":"Fuite d'eau","statut":"ouvert","email":"a@b.fr","createdAt":"2025-01-15T10:00:00"},
                  {"id_incident":11,"description":"Ascenseur en panne","statut":"en_cours","email":"c@d.fr","createdAt":"2025-02-01T08:30:00"}
                ]
                """;
        List<IncidentEntry> result = JsonParser.parseIncidents(json);
        assertEquals(2, result.size());
    }

    @Test
    void parseIncidents_emailExtrait() {
        String json = """
                [{"id_incident":10,"description":"Test","statut":"ouvert","email":"jean@example.com","createdAt":"2025-01-01T00:00:00"}]
                """;
        List<IncidentEntry> result = JsonParser.parseIncidents(json);
        assertEquals("jean@example.com", result.get(0).getEmail());
    }

    @Test
    void parseIncidents_descriptionExtraite() {
        String json = """
                [{"id_incident":5,"description":"Lampadaire cassé","statut":"ouvert","email":"x@y.fr","createdAt":"2025-03-01T00:00:00"}]
                """;
        List<IncidentEntry> result = JsonParser.parseIncidents(json);
        assertEquals("Lampadaire cassé", result.get(0).getDescription());
    }

    // ── parseUsers ─────────────────────────────────────────────────────────

    @Test
    void parseUsers_retourneListe() {
        String json = """
                [
                  {"id_user":1,"email":"alice@test.fr","role":"habitant","ville":"Paris","nom_quartier":"Centre"},
                  {"id_user":2,"email":"bob@test.fr","role":"admin","ville":"Lyon","nom_quartier":"Nord"}
                ]
                """;
        List<User> result = JsonParser.parseUsers(json);
        assertEquals(2, result.size());
    }

    @Test
    void parseUsers_emailEtRoleExtraits() {
        String json = """
                [{"id_user":1,"email":"alice@test.fr","role":"habitant","ville":"Paris","nom_quartier":"Centre"}]
                """;
        List<User> result = JsonParser.parseUsers(json);
        assertEquals("alice@test.fr", result.get(0).getEmail());
        assertEquals("habitant", result.get(0).getRole());
    }

    @Test
    void parseUsers_adresseAssemblee() {
        String json = """
                [{"id_user":1,"email":"a@b.fr","role":"habitant","ville":"Bordeaux","nom_quartier":"Saint-Michel"}]
                """;
        List<User> result = JsonParser.parseUsers(json);
        assertEquals("Saint-Michel - Bordeaux", result.get(0).getAdresse());
    }

    @Test
    void parseUsers_sansQuartierFallback() {
        String json = """
                [{"id_user":1,"email":"a@b.fr","role":"habitant","ville":"Marseille"}]
                """;
        List<User> result = JsonParser.parseUsers(json);
        assertTrue(result.get(0).getAdresse().contains("Quartier non renseigné"));
    }

    // ── parseRoles ─────────────────────────────────────────────────────────

    @Test
    void parseRoles_compteParRole() {
        String json = """
                [
                  {"id_user":1,"role":"habitant"},
                  {"id_user":2,"role":"habitant"},
                  {"id_user":3,"role":"admin"}
                ]
                """;
        Map<String, Integer> roles = JsonParser.parseRoles(json);
        assertEquals(2, roles.get("habitant"));
        assertEquals(1, roles.get("admin"));
    }

    // ── parseUserEmailsById ────────────────────────────────────────────────

    @Test
    void parseUserEmailsById_associeIdEtEmail() {
        String json = """
                [
                  {"id_user":3,"email":"paul@example.com","role":"habitant"},
                  {"id_user":7,"email":"marie@example.com","role":"admin"}
                ]
                """;
        Map<Integer, String> emails = JsonParser.parseUserEmailsById(json);
        assertEquals("paul@example.com",  emails.get(3));
        assertEquals("marie@example.com", emails.get(7));
    }

    // ── parseParUtilisateur ────────────────────────────────────────────────

    @Test
    void parseParUtilisateur_extraitComptesParUser() {
        String json = """
                {"totalEvenements":10,"confirmed":5,"interested":3,"declined":2,
                 "parUtilisateur":{"3":4,"7":2,"12":1}}
                """;
        Map<Integer, Integer> counts = JsonParser.parseParUtilisateur(json);
        assertEquals(4, counts.get(3));
        assertEquals(2, counts.get(7));
        assertEquals(1, counts.get(12));
    }

    @Test
    void parseParUtilisateur_sansChampRetourneMapVide() {
        String json = """
                {"totalEvenements":0,"confirmed":0}
                """;
        Map<Integer, Integer> counts = JsonParser.parseParUtilisateur(json);
        assertTrue(counts.isEmpty());
    }
}
