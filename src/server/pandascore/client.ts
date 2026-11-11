const BASE_URL = "https://api.pandascore.co";
const TIMEOUT_MS = 15_000;
const MAX_ATTEMPTS = 4;
const PAGE_SIZE = 100;

export class PandaScoreError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PandaScoreError";
  }
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

/** Intervalo mínimo entre requisições do processo: o provedor limita rajadas além do limite por hora. */
const MIN_INTERVAL_MS = 250;
const MAX_RETRY_AFTER_MS = 30_000;
let nextSlot = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function throttle() {
  const now = Date.now();
  const wait = nextSlot - now;
  nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL_MS;
  if (wait > 0) await sleep(wait);
}

function retryDelay(res: Response | null, attempt: number) {
  const header = Number(res?.headers.get("retry-after"));
  const base = Number.isFinite(header) && header > 0 ? header * 1_000 : 1_000 * 2 ** (attempt - 1);
  return Math.min(base, MAX_RETRY_AFTER_MS);
}

/**
 * GET autenticado com timeout. Única camada de retry do sync:
 * tenta de novo só em 429/5xx/falha de rede, respeitando o Retry-After do provedor.
 */
async function request(path: string, token: string): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response | null = null;
    try {
      await throttle();
      res = await fetch(`${BASE_URL}${path}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.ok) return res;

      const body = (await res.text()).slice(0, 200);
      const error = new PandaScoreError(`PandaScore respondeu ${res.status} em ${path}: ${body}`, res.status);
      if (!isRetryable(res.status)) throw error;
      lastError = error;
    } catch (err) {
      if (err instanceof PandaScoreError && err.status !== null && !isRetryable(err.status)) throw err;
      lastError = err;
    }

    if (attempt < MAX_ATTEMPTS) await sleep(retryDelay(res, attempt));
  }

  throw new PandaScoreError(`PandaScore indisponível em ${path} após ${MAX_ATTEMPTS} tentativas`, null, {
    cause: lastError,
  });
}

/** Uma página de listagem. 404 vira lista vazia (ex.: fase sem classificação publicada). */
export async function fetchList(path: string, params: Record<string, string>, token: string): Promise<unknown[]> {
  const query = new URLSearchParams({ ...params, per_page: String(PAGE_SIZE) });
  let res: Response;
  try {
    res = await request(`${path}?${query}`, token);
  } catch (err) {
    if (err instanceof PandaScoreError && err.status === 404) return [];
    throw err;
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new PandaScoreError(`Resposta inesperada em ${path}: não é uma lista`, res.status);
  return data;
}

/** Percorre todas as páginas de uma listagem, até `maxPages`. */
export async function fetchAllPages(
  path: string,
  params: Record<string, string>,
  token: string,
  maxPages: number,
): Promise<unknown[]> {
  const items: unknown[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const query = new URLSearchParams({ ...params, per_page: String(PAGE_SIZE), page: String(page) });
    const res = await request(`${path}?${query}`, token);
    const data: unknown = await res.json();
    if (!Array.isArray(data)) {
      throw new PandaScoreError(`Resposta inesperada em ${path}: não é uma lista`, res.status);
    }
    items.push(...data);
    if (data.length < PAGE_SIZE) return items;
  }

  throw new PandaScoreError(`${path} passou de ${maxPages} páginas. Janela de sincronização grande demais.`, null);
}
