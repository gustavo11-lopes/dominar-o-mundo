"use client";

import { useEffect } from "react";

export default function PartidasError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold">Não foi possível carregar as partidas</h1>
      <p className="mb-6 text-muted">O problema é do nosso lado. Tente de novo em instantes.</p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-full bg-text px-4 py-2 text-sm text-bg hover:opacity-90"
      >
        Tentar de novo
      </button>
    </main>
  );
}
