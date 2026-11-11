-- O adapter do Prisma envia datas como horário UTC sem fuso. Com o banco em UTC, toda conexão
-- (direta ou pelo pooler) grava e lê os valores certos, sem depender de opção na conexão.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET "TimeZone" TO %L', current_database(), 'UTC');
END
$$;
