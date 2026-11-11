import { z } from "zod";

// Só os campos que o site usa. O resto do payload é ignorado de propósito:
// um campo novo ou removido no provedor não quebra o sync.

const id = z.number().int().positive();
const isoDate = z.iso.datetime({ offset: true });

export const psTeamSchema = z.object({
  id,
  name: z.string().min(1),
  slug: z.string().min(1).nullable(),
  acronym: z.string().nullable(),
  location: z.string().nullable(),
  image_url: z.url().nullable(),
});

export const psLeagueSchema = z.object({
  id,
  name: z.string().min(1),
  slug: z.string().min(1),
  image_url: z.url().nullable(),
});

export const psSerieSchema = z.object({
  id,
  name: z.string().nullable(),
  full_name: z.string().nullable(),
  slug: z.string().min(1),
  begin_at: isoDate.nullable(),
  end_at: isoDate.nullable(),
});

export const psTournamentSchema = z.object({
  id,
  name: z.string().min(1),
  slug: z.string().min(1),
  begin_at: isoDate.nullable(),
  end_at: isoDate.nullable(),
  tier: z.string().nullable(),
  region: z.string().nullable(),
  prizepool: z.string().nullable(),
  winner_id: id.nullable(),
  winner_type: z.string().nullable(),
});

export const psGameSchema = z.object({
  id,
  position: z.number().int().positive(),
  status: z.string(),
  begin_at: isoDate.nullable(),
  end_at: isoDate.nullable(),
  winner: z.object({ id: id.nullable(), type: z.string().nullable() }).nullable(),
});

export const psMatchSchema = z.object({
  id,
  name: z.string().min(1),
  status: z.string(),
  scheduled_at: isoDate.nullable(),
  begin_at: isoDate.nullable(),
  end_at: isoDate.nullable(),
  number_of_games: z.number().int(),
  forfeit: z.boolean(),
  winner_id: id.nullable(),
  winner_type: z.string().nullable(),
  opponents: z.array(z.object({ type: z.string(), opponent: psTeamSchema })),
  results: z.array(z.object({ team_id: id, score: z.number().int() })),
  games: z.array(psGameSchema),
  streams_list: z.array(
    z.object({ main: z.boolean(), official: z.boolean(), raw_url: z.url().nullable() }),
  ),
  league: psLeagueSchema,
  serie: psSerieSchema,
  tournament: psTournamentSchema,
});

export type PsTeam = z.infer<typeof psTeamSchema>;
export type PsMatch = z.infer<typeof psMatchSchema>;
