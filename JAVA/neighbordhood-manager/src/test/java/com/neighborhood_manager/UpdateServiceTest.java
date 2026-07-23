package com.neighborhood_manager;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UpdateServiceTest {

    @Test
    void getCurrentVersion_retourneVersionNonNulle() {
        String version = UpdateService.getCurrentVersion();
        assertNotNull(version);
        assertFalse(version.isBlank());
    }

    @Test
    void getCurrentVersion_retourneValeurNumerique() {
        String version = UpdateService.getCurrentVersion();
        assertDoesNotThrow(() -> Double.parseDouble(version));
    }

    @Test
    void checkForUpdate_neJamaisPlanterSiServeurInjoignable() {
        // L'endpoint n'existe pas encore — doit retourner null sans exception
        UpdateService.UpdateInfo result = UpdateService.checkForUpdate().join();
        assertNull(result);
    }
}
