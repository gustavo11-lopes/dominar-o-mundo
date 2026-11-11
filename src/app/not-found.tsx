import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold">Página não encontrada</h1>
      <p className="mb-6 text-muted">O endereço pode ter mudado ou o registro não existe mais.</p>
      <Link href="/partidas" className="rounded-full bg-text px-4 py-2 text-sm text-bg hover:opacity-90">
        Ver partidas
      </Link>
    </main>
  );
}
