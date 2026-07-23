package com.neighborhood_manager;

import com.neighborhood_manager.models.Incident;
import com.neighborhood_manager.models.IncidentEntry;
import com.neighborhood_manager.models.User;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModelTest {

    // ── Incident ───────────────────────────────────────────────────────────

    @Test
    void incident_getters() {
        Incident i = new Incident(42, "Bruit", "En cours");
        assertEquals(42, i.getId_signalement());
        assertEquals("Bruit", i.getMotif());
        assertEquals("En cours", i.getStatut());
    }

    @Test
    void incident_setters() {
        Incident i = new Incident();
        i.setId_signalement(5);
        i.setMotif("Tag");
        i.setStatut("Résolu");
        assertEquals(5,        i.getId_signalement());
        assertEquals("Tag",    i.getMotif());
        assertEquals("Résolu", i.getStatut());
    }

    // ── IncidentEntry ──────────────────────────────────────────────────────

    @Test
    void incidentEntry_getters() {
        IncidentEntry e = new IncidentEntry(7, "Fuite d'eau", "En cours", "a@b.fr", "2025-01-15");
        assertEquals(7,            e.getId());
        assertEquals("Fuite d'eau",e.getDescription());
        assertEquals("En cours",   e.getStatut());
        assertEquals("a@b.fr",     e.getEmail());
        assertEquals("2025-01-15", e.getCreatedAt());
    }

    @Test
    void incidentEntry_nullsRemplacesParDefaut() {
        IncidentEntry e = new IncidentEntry(1, null, null, null, null);
        assertNotNull(e.getDescription());
        assertNotNull(e.getStatut());
        assertNotNull(e.getEmail());
        assertNotNull(e.getCreatedAt());
    }

    @Test
    void incidentEntry_setters() {
        IncidentEntry e = new IncidentEntry();
        e.setId(99);
        e.setDescription("Test");
        e.setStatut("Résolu");
        e.setEmail("z@z.fr");
        e.setCreatedAt("2025-06-01");
        assertEquals(99,          e.getId());
        assertEquals("Test",      e.getDescription());
        assertEquals("Résolu",    e.getStatut());
        assertEquals("z@z.fr",    e.getEmail());
        assertEquals("2025-06-01",e.getCreatedAt());
    }

    // ── User ───────────────────────────────────────────────────────────────

    @Test
    void user_getters() {
        User u = new User(3, "alice@example.com", "habitant", "Centre - Paris", "Paris");
        assertEquals(3,                   u.getId_user());
        assertEquals("alice@example.com", u.getEmail());
        assertEquals("habitant",          u.getRole());
        assertEquals("Centre - Paris",    u.getAdresse());
        assertEquals("Paris",             u.getVille());
    }
}
