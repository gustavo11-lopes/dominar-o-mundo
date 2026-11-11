import { describe, expect, it } from "vitest";
import { mapMatch, UnsupportedRecordError } from "@/server/pandascore/map";
import { psMatchSchema, type PsMatch } from "@/server/pandascore/schemas";
import past from "./fixtures/pandascore-matches-past.json";

// Amostras reais da API (10/11/2026): uma final encerrada, uma partida cancelada e um 0-2.
const parsed = psMatchSchema.array().parse(past);
const byId = (id: number): PsMatch => structuredClone(parsed.find((m) => m.id === id)!);

describe("mapMatch", () => {
  it("converte uma série encerrada com placar, vencedor, mapas e transmissão", () => {
    const out = mapMatch(byId(1802840));

    expect(out.match).toMatchObject({
      externalId: "1802840",
      status: "FINISHED",
      bestOf: 3,
      scoreA: 2,
      scoreB: 1,
      winnerExternalId: "139566",
      streamUrl: "https://www.twitch.tv/lendothlive",
    });
    expect(out.match.scheduledAt?.toISOString()).toBe("2026-11-10T18:45:00.000Z");
    expect(out.teamA?.name).toBe("Aurora Gaming");
    expect(out.stage).toMatchObject({ tier: "D", regionCode: "EEU", winnerExternalId: "139566" });
    expect(out.maps.map((m) => [m.position, m.status, m.winnerExternalId])).toEqual([
      [1, "FINISHED", "137123"],
      [2, "FINISHED", "139566"],
      [3, "FINISHED", "139566"],
    ]);
  });

  it("partida cancelada fica sem vencedor e com mapas não iniciados", () => {
    const out = mapMatch(byId(1802841));
    expect(out.match.status).toBe("CANCELED");
    expect(out.match.winnerExternalId).toBeNull();
    expect(out.maps.every((m) => m.status === "SCHEDULED" && m.winnerExternalId === null)).toBe(true);
  });

  it("associa o placar pelo id do time, não pela ordem da lista de resultados", () => {
    const m = byId(1792378);
    m.results.reverse();
    const out = mapMatch(m);
    expect([out.teamA?.externalId, out.match.scoreA]).toEqual(["139526", 0]);
    expect([out.teamB?.externalId, out.match.scoreB]).toEqual(["130398", 2]);
  });

  it("confronto ainda indefinido vira times nulos e placar zerado", () => {
    const m = byId(1802840);
    Object.assign(m, { status: "not_started", opponents: [], results: [], winner_id: null });
    const out = mapMatch(m);
    expect(out.teamA).toBeNull();
    expect(out.teamB).toBeNull();
    expect([out.match.scoreA, out.match.scoreB, out.match.status]).toEqual([0, 0, "SCHEDULED"]);
  });

  it("recusa status desconhecido em vez de adivinhar", () => {
    const m = byId(1802840);
    m.status = "paused";
    expect(() => mapMatch(m)).toThrow(UnsupportedRecordError);
  });

  it("recusa vencedor que não é um dos adversários", () => {
    const m = byId(1802840);
    m.winner_id = 1;
    expect(() => mapMatch(m)).toThrow(UnsupportedRecordError);
  });
});
