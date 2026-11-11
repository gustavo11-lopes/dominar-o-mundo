/*
  Regiões competitivas usadas para organizar a busca. A região de um time vem do país que o
  provedor informa para ele; a de um jogador, do país do time atual (ou da nacionalidade,
  se estiver sem time). Sem país informado, o registro vai para "Outras regiões".
*/

export type RegionId = "sa" | "na" | "emea" | "asia" | "oce" | "outras";

// prettier-ignore
export const REGIONS: { id: RegionId; label: string; countries: string[] }[] = [
  {
    id: "sa",
    label: "Brasil / América do Sul",
    countries: ["BR", "AR", "CL", "CO", "PE", "UY", "PY", "BO", "EC", "VE", "GY", "SR"],
  },
  {
    id: "na",
    label: "América do Norte",
    countries: [
      "US", "CA", "MX", "GT", "HN", "SV", "NI", "CR", "PA", "CU", "DO", "PR", "JM", "HT", "TT", "BS", "BZ",
      "BB",
    ],
  },
  {
    id: "emea",
    label: "Europa / EMEA",
    countries: [
      // Europa
      "AL", "AD", "AT", "BY", "BE", "BA", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
      "IS", "IE", "IT", "XK", "LV", "LI", "LT", "LU", "MT", "MD", "MC", "ME", "NL", "MK", "NO", "PL", "PT",
      "RO", "RU", "SM", "RS", "SK", "SI", "ES", "SE", "CH", "UA", "GB", "VA", "TR", "GE", "AM", "AZ",
      // Oriente Médio
      "AE", "SA", "QA", "KW", "BH", "OM", "JO", "LB", "IL", "PS", "IQ", "IR", "SY", "YE",
      // África
      "ZA", "EG", "MA", "DZ", "TN", "LY", "NG", "KE", "GH", "SN", "CI", "CM", "ET", "TZ", "UG", "AO", "MZ",
      "ZW",
      // Ásia Central (circuitos da EMEA/CIS)
      "KZ", "UZ", "KG", "TJ", "TM",
    ],
  },
  {
    id: "asia",
    label: "Ásia",
    countries: [
      "CN", "JP", "KR", "TW", "HK", "MO", "MN", "TH", "VN", "ID", "PH", "MY", "SG", "MM", "KH", "LA", "BN",
      "TL", "IN", "PK", "BD", "LK", "NP", "BT", "MV", "AF",
    ],
  },
  {
    id: "oce",
    label: "Pacífico / Oceania",
    countries: ["AU", "NZ", "PG", "FJ", "WS", "TO", "SB", "VU", "NC", "PF", "GU"],
  },
  { id: "outras", label: "Outras regiões", countries: [] },
];

const byCountry = new Map(REGIONS.flatMap((r) => r.countries.map((c) => [c, r.id] as const)));

export function regionOf(countryCode: string | null): RegionId {
  return (countryCode && byCountry.get(countryCode)) || "outras";
}

export const regionLabel = (id: RegionId) => REGIONS.find((r) => r.id === id)!.label;

export const isRegionId = (v: unknown): v is RegionId => REGIONS.some((r) => r.id === v);

/** Todos os países com região conhecida (para filtrar "Outras regiões" no banco). */
export const KNOWN_COUNTRIES = [...byCountry.keys()];
