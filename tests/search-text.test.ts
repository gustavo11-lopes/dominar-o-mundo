import { describe, expect, it } from "vitest";
import { regionOf } from "@/lib/regions";
import { highlightRange, normalize } from "@/lib/search";

describe("normalize", () => {
  it("ignora acentos, maiúsculas, espaços e símbolos", () => {
    expect(normalize("Luk Xo")).toBe("lukxo");
    expect(normalize("  KRÜ  Blaze!! ")).toBe("krublaze");
    expect(normalize("São-Paulo")).toBe("saopaulo");
    expect(normalize("100 Thieves")).toBe("100thieves");
  });
});

describe("highlightRange", () => {
  it("acha o trecho no texto original mesmo com espaço e acento no meio", () => {
    expect(highlightRange("luk xo", "Lukxo")).toEqual([0, 6]);
    expect(highlightRange("KRÜ Blaze", "kru")).toEqual([0, 3]);
    expect(highlightRange("Team Vitality", "vita")).toEqual([5, 9]);
  });
  it("não destaca quando o resultado veio por semelhança, não por trecho", () => {
    expect(highlightRange("Sentinels", "sentinls")).toBeNull();
    expect(highlightRange("qualquer", "")).toBeNull();
  });
});

describe("regionOf", () => {
  it("classifica pelo país informado", () => {
    expect(regionOf("BR")).toBe("sa");
    expect(regionOf("US")).toBe("na");
    expect(regionOf("TR")).toBe("emea");
    expect(regionOf("JP")).toBe("asia");
    expect(regionOf("AU")).toBe("oce");
  });
  it("sem país ou país fora das listas vai para outras regiões", () => {
    expect(regionOf(null)).toBe("outras");
    expect(regionOf("AQ")).toBe("outras");
  });
});
