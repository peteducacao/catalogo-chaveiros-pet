-- Limpeza solicitada: remove exclusivamente as tabelas da antiga função Estatísticas.
-- Não toca nos documentos (chaveiros/config), sessões ou banco do Inventário PET.
DROP INDEX IF EXISTS idx_catalog_analytics_actions_day;
DROP TABLE IF EXISTS analytics_actions;
DROP TABLE IF EXISTS analytics_visitors;
DROP TABLE IF EXISTS analytics_daily;
DROP TABLE IF EXISTS analytics_budget;
