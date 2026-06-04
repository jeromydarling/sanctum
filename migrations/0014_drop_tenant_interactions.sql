-- Cleanup: the relationship log moved to crm_interactions in 0013 (data copied
-- there). The deploy that reads crm_interactions is live, so the legacy table can go.
DROP TABLE IF EXISTS tenant_interactions;
