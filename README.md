# esports-hub

Plataforma de eSports com foco em VALORANT. Nome provisório.

## Rodar localmente

Requisitos: Node 22+, PostgreSQL 16+ e um token gratuito da [PandaScore](https://pandascore.co).

```bash
cp .env.example .env        # preencha DATABASE_URL, PANDASCORE_TOKEN e CRON_SECRET
npm install                 # também gera o Prisma Client
npx prisma migrate deploy   # cria as tabelas
npm run sync                # primeira carga: partidas (futuras + 30 dias), times com elencos e classificação
npm run dev                 # http://localhost:3000
```

Comandos:

| Comando | O que faz |
|---|---|
| `npm run sync` | Sincroniza partidas, times/elencos e classificação. Depois da primeira carga, busca só o que mudou. |
| `npm test` | Testes. Os de integração rodam só com `TEST_DATABASE_URL` definido. |
| `npm run typecheck` / `npm run lint` | Tipos e lint. |

## Arquitetura

- **Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind 4.** Páginas são Server Components que leem do Postgres com `use cache` (tag `matches`, perfil `minutes`).
- **PostgreSQL + Prisma 7.** O banco é a única fonte de leitura do site.
- **Sincronização** (`src/server/sync/`), em ordem, cada etapa com relatório próprio:
  - **Partidas:** primeira carga = futuras + resultados dos últimos 30 dias; depois, tudo que mudou desde a última execução (5 min de sobreposição) e as ao vivo.
  - **Times e elencos:** primeira carga = catálogo inteiro; depois, só times alterados. Saída e entrada de jogador viram passagens (`player_team_stint`). Na primeira carga a data de entrada não é conhecida (`start_observed = false`).
  - **Classificação:** fases que tiveram partida alterada. Chave eliminatória só traz a posição.
  - Upsert por `(source, externalId)`: rodar de novo não duplica nada. Registro inválido é ignorado e anotado em `sync_state.last_error`.
  - Uma execução por vez por etapa (lease em `sync_state`). O cliente respeita o `Retry-After` e espaça as chamadas (o provedor limita rajadas).
- **`GET /api/sync`**: mesma sincronização, protegida por `Authorization: Bearer CRON_SECRET`. É o que o agendador chama em produção. Invalida o cache das páginas quando há mudança.
- O token da PandaScore nunca chega ao navegador.

## O que os dados permitem (plano gratuito da PandaScore)

Tem: agenda, resultados (placar da série e vencedor de cada mapa), times com logo e elenco atual, jogadores, campeonatos, fases, classificação, tier, região e premiação divulgada.
Não tem: nome do mapa, placar de rounds, estatísticas de jogador e de time, escalação por partida, histórico de transferências anterior ao início do acompanhamento.

## Páginas

`/partidas`, `/campeonatos` e `/campeonatos/[slug]`, `/times` e `/times/[slug]`, `/jogadores` e `/jogadores/[slug]`. A home redireciona para `/partidas` até a Fase 4.

## Banco

Schema em `prisma/schema.prisma`. CHECKs e o índice parcial de `player_team_stint` estão no SQL da migração,
porque o Prisma não os descreve. Ao criar novas migrações, não remova esse bloco.

A conexão força `TimeZone=UTC` (`src/lib/db.ts`). Sem isso, num Postgres com fuso diferente de UTC, as datas
gravadas ficam deslocadas.

Prisma está fixado na versão 7. `npm install prisma` sem versão instala a 8 (release candidate), que não lê este schema.
