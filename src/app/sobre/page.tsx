import type { Metadata } from "next";
import Link from "next/link";
import { PageTitle } from "@/components/ui";

export const metadata: Metadata = {
  title: "Sobre",
  description: "O que é o VALOHUB, de onde vêm os dados e como o site funciona.",
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="mb-3 section-title">{title}</h2>
      <div className="space-y-3 leading-relaxed text-text/90">{children}</div>
    </section>
  );
}

export default function SobrePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageTitle subtitle="Partidas, campeonatos, times e jogadores do VALORANT competitivo, em português.">
        Sobre
      </PageTitle>

      <div className="space-y-6">
        <Block title="O projeto">
          <p>
            O VALOHUB reúne num só lugar a agenda, os resultados, os campeonatos, os times e os jogadores do cenário
            competitivo de VALORANT, com placar das partidas ao vivo e horários de Brasília.
          </p>
          <p>
            É um projeto <strong>acadêmico e experimental</strong>, <strong>totalmente gratuito</strong> e{" "}
            <strong>sem finalidade comercial</strong>: não vende nada, não exibe anúncios e não pede cadastro.
          </p>
          <p>
            O site está em desenvolvimento. Algumas informações podem estar incompletas, atrasadas ou ausentes enquanto
            ele evolui.
          </p>
        </Block>

        <Block title="De onde vêm os dados">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>PandaScore</strong> (API de dados de eSports, plano gratuito): partidas, placares, times e
              elencos, jogadores, campeonatos, fases, classificação, links de transmissão e as artes dos mapas do jogo.
            </li>
            <li>
              <strong>Banco de dados próprio</strong> (PostgreSQL): guarda uma cópia organizada desses dados para o site
              abrir rápido e para montar o que a fonte não entrega pronto, como o histórico de times de cada jogador.
            </li>
            <li>
              <strong>Transmissões</strong>: o player abre direto da plataforma de origem (Twitch ou YouTube), pelo link
              que a PandaScore informa.
            </li>
          </ul>
          <p>
            O site não copia dados de outros sites de eSports. Quando a fonte não informa algo, o VALOHUB mostra que a
            informação não está disponível em vez de preencher por conta própria.
          </p>
        </Block>

        <Block title="Como funciona">
          <ul className="list-disc space-y-2 pl-5">
            <li>A cada 15 minutos o site busca na PandaScore o que mudou e atualiza o banco.</li>
            <li>
              O placar das partidas ao vivo é consultado direto na fonte, renovado a cada cerca de 20 segundos, e a
              página se atualiza sozinha enquanto houver jogo rolando.
            </li>
            <li>
              O histórico de times dos jogadores começa quando o site passou a acompanhar os elencos (novembro de 2026).
              Passagens anteriores não aparecem.
            </li>
            <li>
              A região de times e jogadores na busca vem do país que a fonte informa. Sem país informado, o registro
              aparece em “Outras regiões”.
            </li>
          </ul>
        </Block>

        <Block title="O que ainda não tem">
          <p>
            No plano gratuito da fonte não há agentes escolhidos, mapa sendo jogado, placar de rounds nem estatísticas
            por jogador. Essas informações dependem de um plano pago de dados e podem chegar no futuro.
          </p>
        </Block>

        <Block title="Aviso legal">
          <p>
            VALOHUB foi criado seguindo a política do “Lenga-Lenga Jurídico” da Riot Games com recursos pertencentes à
            Riot Games. A Riot Games não endossa ou patrocina este projeto.
          </p>
          <p className="text-sm text-muted">
            VALORANT e as artes do jogo são propriedade da Riot Games, Inc. Logos e nomes de times pertencem às
            respectivas organizações. Dados de partidas fornecidos pela PandaScore.
          </p>
        </Block>

        <p className="text-sm text-muted">
          <Link href="/" className="text-accent hover:underline">
            Voltar para o início
          </Link>
        </p>
      </div>
    </main>
  );
}
