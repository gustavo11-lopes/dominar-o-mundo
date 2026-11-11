"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Recarrega os dados da página a cada `seconds` enquanto a aba estiver visível. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}

/** Número de placar que acende quando muda (ex.: um mapa acabou de ser vencido). */
export function Score({ value, className = "" }: { value: number; className?: string }) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setFlash(true);
    const id = setTimeout(() => setFlash(false), 1600);
    return () => clearTimeout(id);
  }, [value]);
  return <span className={`${className} ${flash ? "score-flash" : ""}`}>{value}</span>;
}
