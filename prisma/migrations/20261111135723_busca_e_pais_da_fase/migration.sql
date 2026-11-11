-- AlterTable
ALTER TABLE "stage" ADD COLUMN     "country_code" CHAR(2);

ALTER TABLE "stage"
  ADD CONSTRAINT "stage_country_code_check" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------------
-- Busca: normalização (sem acento, minúsculas, só letras e números) + trigramas.
-- Mantido à mão: o Prisma não descreve extensões, funções nem índices por expressão.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent com dicionário explícito é estável; a função pode ser IMMUTABLE e indexada.
CREATE OR REPLACE FUNCTION search_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT lower(regexp_replace(unaccent('unaccent'::regdictionary, t), '[^[:alnum:]]+', '', 'g'))
$$;

CREATE INDEX "team_search_name_trgm" ON "team" USING gin (search_norm("name") gin_trgm_ops);
CREATE INDEX "team_search_acronym_trgm" ON "team" USING gin (search_norm(coalesce("acronym", '')) gin_trgm_ops);
CREATE INDEX "player_search_handle_trgm" ON "player" USING gin (search_norm("handle") gin_trgm_ops);
CREATE INDEX "player_search_fullname_trgm" ON "player"
  USING gin (search_norm(coalesce("first_name", '') || coalesce("last_name", '')) gin_trgm_ops);
