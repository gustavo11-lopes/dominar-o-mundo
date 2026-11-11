import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { KNOWN_COUNTRIES, REGIONS, regionOf, type RegionId } from "@/lib/regions";
import { DATA_TAG } from "./tags";

/*
  Busca de times e jogadores. A normalização acontece no banco (search_norm: sem acento,
  minúsculas, só letras e números), com índices de trigramas para trechos e erros de digitação.
  Relevância: igual > começa com > contém > parecido (similaridade de trigramas).
*/

export const SEARCH_LIMIT = 60;
export const BROWSE_PER_REGION = 12;
export const REGION_PAGE_SIZE = 48;
const ACTIVE_WINDOW_MS = 30 * 86_400_000;

export type TeamHit = {
  slug: string;
  name: string;
  acronym: string | null;
  countryCode: string | null;
  logoUrl: string | null;
  region: RegionId;
};

export type PlayerHit = {
  slug: string;
  handle: string;
  fullName: string | null;
  countryCode: string | null;
  imageUrl: string | null;
  region: RegionId;
  team: { slug: string; name: string; logoUrl: string | null } | null;
};

/** Condição SQL de região sobre uma expressão de país. */
function regionCondition(countryExpr: Prisma.Sql, region: RegionId): Prisma.Sql {
  if (region === "outras") {
    return Prisma.sql`(${countryExpr} IS NULL OR NOT (${countryExpr} = ANY(${KNOWN_COUNTRIES}::text[])))`;
  }
  const countries = REGIONS.find((r) => r.id === region)!.countries;
  return Prisma.sql`${countryExpr} = ANY(${countries}::text[])`;
}

/** Ordem fixa das regiões na listagem sem busca. */
function regionRank(countryExpr: Prisma.Sql): Prisma.Sql {
  const cases = REGIONS.filter((r) => r.countries.length).map(
    (r, i) => Prisma.sql`WHEN ${countryExpr} = ANY(${r.countries}::text[]) THEN ${i}`,
  );
  return Prisma.sql`CASE ${Prisma.join(cases, " ")} ELSE ${REGIONS.length} END`;
}

type TeamRow = {
  slug: string;
  name: string;
  acronym: string | null;
  country_code: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
};

const toTeamHit = (r: TeamRow): TeamHit => ({
  slug: r.slug,
  name: r.name,
  acronym: r.acronym,
  countryCode: r.country_code,
  logoUrl: r.logo_dark_url ?? r.logo_url,
  region: regionOf(r.country_code),
});

/** Times por relevância. `region` restringe; sem ela, a busca cobre todas. */
export async function searchTeams(query: string, region: RegionId | null): Promise<TeamHit[]> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const rows = await db.$queryRaw<TeamRow[]>`
    WITH q AS (SELECT search_norm(${query}) AS k),
    c AS (
      SELECT t.*, search_norm(t."name") AS n, search_norm(coalesce(t."acronym", '')) AS a,
             search_norm(t."slug") AS s
      FROM "team" t, q
      WHERE length(q.k) > 0
        AND (
          search_norm(t."name") LIKE '%' || q.k || '%'
          OR search_norm(coalesce(t."acronym", '')) LIKE q.k || '%'
          OR search_norm(t."name") % q.k
          OR q.k <% search_norm(t."name")
        )
        AND ${region ? regionCondition(Prisma.sql`t."country_code"`, region) : Prisma.sql`TRUE`}
    )
    SELECT c."slug", c."name", c."acronym", c."country_code", c."logo_url", c."logo_dark_url"
    FROM c, q
    ORDER BY GREATEST(
      CASE WHEN c.n = q.k THEN 1 WHEN c.n LIKE q.k || '%' THEN 0.92 WHEN strpos(c.n, q.k) > 0 THEN 0.8 ELSE 0 END,
      CASE WHEN c.a = q.k THEN 0.97 WHEN c.a <> '' AND c.a LIKE q.k || '%' THEN 0.85 ELSE 0 END,
      CASE WHEN c.s LIKE q.k || '%' THEN 0.8 ELSE 0 END,
      similarity(c.n, q.k) * 0.75,
      word_similarity(q.k, c.n) * 0.7
    ) DESC, length(c."name"), c."name"
    LIMIT ${SEARCH_LIMIT}`;
  return rows.map(toTeamHit);
}

/** Sem busca: times em atividade (jogaram ou jogam nos ±30 dias), em ordem de região e nome. */
export async function browseTeams(
  region: RegionId | null,
  page: number,
): Promise<{ items: TeamHit[]; hasNext: boolean }> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const now = Date.now();
  const from = new Date(now - ACTIVE_WINDOW_MS);
  const to = new Date(now + ACTIVE_WINDOW_MS);
  const limit = region ? REGION_PAGE_SIZE : 1000;
  const offset = region ? (page - 1) * REGION_PAGE_SIZE : 0;

  const rows = await db.$queryRaw<TeamRow[]>`
    SELECT t."slug", t."name", t."acronym", t."country_code", t."logo_url", t."logo_dark_url"
    FROM "team" t
    WHERE EXISTS (
        SELECT 1 FROM "match" m
        WHERE (m."team_a_id" = t."id" OR m."team_b_id" = t."id") AND m."scheduled_at" BETWEEN ${from} AND ${to}
      )
      AND ${region ? regionCondition(Prisma.sql`t."country_code"`, region) : Prisma.sql`TRUE`}
    ORDER BY ${regionRank(Prisma.sql`t."country_code"`)}, lower(t."name"), t."id"
    LIMIT ${limit + 1} OFFSET ${offset}`;
  return { items: rows.slice(0, limit).map(toTeamHit), hasNext: rows.length > limit };
}

type PlayerRow = {
  slug: string;
  handle: string;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  image_url: string | null;
  team_slug: string | null;
  team_name: string | null;
  team_logo: string | null;
  region_country: string | null;
};

const toPlayerHit = (r: PlayerRow): PlayerHit => ({
  slug: r.slug,
  handle: r.handle,
  fullName: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
  countryCode: r.country_code,
  imageUrl: r.image_url,
  region: regionOf(r.region_country),
  team: r.team_slug ? { slug: r.team_slug, name: r.team_name!, logoUrl: r.team_logo } : null,
});

/** Jogador + time atual; a região é a do país do time, ou a nacionalidade se estiver sem time. */
const playerBase = Prisma.sql`
  SELECT p.*, t."slug" AS team_slug, t."name" AS team_name,
         coalesce(t."logo_dark_url", t."logo_url") AS team_logo,
         coalesce(t."country_code", p."country_code") AS region_country
  FROM "player" p
  LEFT JOIN "player_team_stint" s ON s."player_id" = p."id" AND s."ended_at" IS NULL
  LEFT JOIN "team" t ON t."id" = s."team_id"`;

export async function searchPlayers(query: string, region: RegionId | null): Promise<PlayerHit[]> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const rows = await db.$queryRaw<PlayerRow[]>`
    WITH q AS (SELECT search_norm(${query}) AS k),
    base AS (${playerBase}),
    c AS (
      SELECT b.*, search_norm(b."handle") AS h,
             search_norm(coalesce(b."first_name", '') || coalesce(b."last_name", '')) AS f,
             search_norm(coalesce(b."last_name", '') || coalesce(b."first_name", '')) AS l
      FROM base b, q
      WHERE length(q.k) > 0
        AND (
          search_norm(b."handle") LIKE '%' || q.k || '%'
          OR search_norm(b."handle") % q.k
          OR q.k <% search_norm(b."handle")
          OR search_norm(coalesce(b."first_name", '') || coalesce(b."last_name", '')) LIKE '%' || q.k || '%'
          OR search_norm(coalesce(b."last_name", '') || coalesce(b."first_name", '')) LIKE '%' || q.k || '%'
        )
        AND ${region ? regionCondition(Prisma.sql`b.region_country`, region) : Prisma.sql`TRUE`}
    )
    SELECT c."slug", c."handle", c."first_name", c."last_name", c."country_code", c."image_url",
           c.team_slug, c.team_name, c.team_logo, c.region_country
    FROM c, q
    ORDER BY GREATEST(
      CASE WHEN c.h = q.k THEN 1 WHEN c.h LIKE q.k || '%' THEN 0.92 WHEN strpos(c.h, q.k) > 0 THEN 0.8 ELSE 0 END,
      CASE WHEN c.f = q.k OR c.l = q.k THEN 0.9 WHEN strpos(c.f, q.k) > 0 OR strpos(c.l, q.k) > 0 THEN 0.7 ELSE 0 END,
      similarity(c.h, q.k) * 0.75,
      word_similarity(q.k, c.h) * 0.7
    ) DESC, (c.team_slug IS NULL), length(c."handle"), c."handle"
    LIMIT ${SEARCH_LIMIT}`;
  return rows.map(toPlayerHit);
}

/** Sem busca: jogadores com time atual, em ordem de região e nick. */
export async function browsePlayers(
  region: RegionId | null,
  page: number,
): Promise<{ items: PlayerHit[]; hasNext: boolean }> {
  "use cache";
  cacheTag(DATA_TAG);
  cacheLife("hours");

  const limit = region ? REGION_PAGE_SIZE : 1000;
  const offset = region ? (page - 1) * REGION_PAGE_SIZE : 0;
  const rows = await db.$queryRaw<PlayerRow[]>`
    WITH base AS (${playerBase})
    SELECT b."slug", b."handle", b."first_name", b."last_name", b."country_code", b."image_url",
           b.team_slug, b.team_name, b.team_logo, b.region_country
    FROM base b
    WHERE b.team_slug IS NOT NULL
      AND ${region ? regionCondition(Prisma.sql`b.region_country`, region) : Prisma.sql`TRUE`}
    ORDER BY ${regionRank(Prisma.sql`b.region_country`)}, lower(b."handle"), b."slug"
    LIMIT ${limit + 1} OFFSET ${offset}`;
  return { items: rows.slice(0, limit).map(toPlayerHit), hasNext: rows.length > limit };
}

/** Agrupa preservando a ordem: com busca, a região do melhor resultado vem primeiro. */
export function groupByRegion<T extends { region: RegionId }>(items: T[]) {
  const groups = new Map<RegionId, T[]>();
  for (const item of items) {
    const list = groups.get(item.region) ?? [];
    list.push(item);
    groups.set(item.region, list);
  }
  return [...groups.entries()].map(([region, list]) => ({ region, items: list }));
}
