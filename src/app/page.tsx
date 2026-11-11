import { redirect } from "next/navigation";

// A home de verdade é a Fase 4. Até lá, a entrada do site é a página de partidas.
export default function Home() {
  redirect("/partidas");
}
