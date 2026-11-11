# esports-hub

Plataforma de eSports com foco em VALORANT. Nome provisório.

## Rodar localmente

Requisitos: Node 22+, PostgreSQL 16+ e um token gratuito da [PandaScore](https://pandascore.co).

```bash
cp .env.example .env        # preencha DATABASE_URL, PANDASCORE_TOKEN e CRON_SECRET
npm install                 # também gera o Prisma Client
npx prisma migrate deploy   # cria as tabelas
npm run sync                # primeira carga: próximas partidas + últimos 30 dias
npm run dev                 # http://localhost:3000/partidas
```

Comandos:

| Comando | O que faz |
|---|---|
| `npm run sync` | Sincroniza partidas com a PandaScore. Depois da primeira carga, busca só o que mudou. |
| `npm test` | Testes. Os de integração rodam só com `TEST_DATABASE_URL` definido. |
| `npm run typecheck` / `npm run lint` | Tipos e lint. |

## Arquitetura

- **Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4.** Páginas são Server Components que leem do Postgres com `use cache` (tag `matches`, perfil `minutes`).
- **PostgreSQL + Prisma 7.** O banco é a única fonte de leitura do site.
- **Sincronização** (`src/server/sync/matches.ts`):
  - Primeira carga: partidas futuras e resultados dos últimos 30 dias.
  - Depois: tudo que mudou desde a última execução (com 5 min de sobreposição) e as partidas ao vivo.
  - Upsert por `(source, externalId)`: rodar de novo não duplica nada.
  - Registro inválido é ignorado e registrado em `sync_state.last_error`; não derruba os outros.
  - Só uma execução por vez (lease em `sync_state`).
- **`GET /api/sync`**: mesma sincronização, protegida por `Authorization: Bearer CRON_SECRET`. É o que o agendador chama em produção. Invalida o cache das páginas quando há mudança.
- O token da PandaScore nunca chega ao navegador.

## O que os dados permitem (plano gratuito da PandaScore)

Tem: agenda, resultados (placar da série e vencedor de cada mapa), times com logo, campeonatos, fases, tier, região e premiação divulgada.
Não tem: nome do mapa, placar de rounds, estatísticas de jogador e de time, dados ao vivo round a round.

## Banco

Schema em `prisma/schema.prisma`. CHECKs e o índice parcial de `player_team_stint` estão no SQL da migração,
porque o Prisma não os descreve. Ao criar novas migrações, não remova esse bloco.

A conexão força `TimeZone=UTC` (`src/lib/db.ts`). Sem isso, num Postgres com fuso diferente de UTC, as datas
gravadas ficam deslocadas.

Prisma está fixado na versão 7. `npm install prisma` sem versão instala a 8 (release candidate), que não lê este schema.
