-- Idempotente de propósito: a primeira tentativa em produção parou no meio (índice sem o schema
-- qualificado) e esta versão precisa conseguir rodar de novo por cima do que ficou aplicado.

-- AlterTable
ALTER TABLE "stage" ADD COLUMN IF NOT EXISTS "country_code" CHAR(2);

ALTER TABLE "stage" DROP CONSTRAINT IF EXISTS "stage_country_code_check";
ALTER TABLE "stage"
  ADD CONSTRAINT "stage_country_code_check" CHECK ("country_code" IS NULL OR "country_code" ~ '^[A-Z]{2}$');

-- ---------------------------------------------------------------------------
-- Busca: normalização (sem acento, minúsculas, só letras e números) + trigramas.
-- Mantido à mão: o Prisma não descreve extensões, funções nem índices por expressão.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- Tudo qualificado com "public": durante a criação de índices o Postgres usa um search_path
-- restrito, e um nome sem schema não é encontrado.
CREATE OR REPLACE FUNCTION public.search_norm(t text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS $$
  SELECT lower(pg_catalog.regexp_replace(public.unaccent('public.unaccent'::regdictionary, t), '[^[:alnum:]]+', '', 'g'))
$$;

CREATE INDEX IF NOT EXISTS "team_search_name_trgm" ON "team" USING gin (public.search_norm("name") public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "team_search_acronym_trgm" ON "team"
  USING gin (public.search_norm(coalesce("acronym", '')) public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "player_search_handle_trgm" ON "player" USING gin (public.search_norm("handle") public.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "player_search_fullname_trgm" ON "player"
  USING gin (public.search_norm(coalesce("first_name", '') || coalesce("last_name", '')) public.gin_trgm_ops);
