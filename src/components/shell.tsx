"use client";

import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { hojeISO } from "@/lib/datas";
import { iniciarOcultar } from "@/lib/ocultar";
import { garantirOcorrencias } from "@/lib/sincronizar";
import { supabase } from "@/lib/supabase";
import { AppProvider, carregarBase, type DadosBase } from "./app-contexto";
import { BarraLateral, NavInferior } from "./nav";
import { Onboarding } from "./onboarding";
import { Botao, Carregando, Erro, formatarErro } from "./ui";

type Estado = { fase: "carregando" } | { fase: "erro"; mensagem: string } | { fase: "onboarding" } | { fase: "pronto"; base: DadosBase };

export function Shell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ fase: "carregando" });

  const iniciar = useEffectEvent(async (usuario: User | null) => {
    try {
      if (!usuario) {
        router.replace("/login");
        return;
      }
      const base = await carregarBase(usuario);
      if ("semCasa" in base) {
        setEstado({ fase: "onboarding" });
        return;
      }
      // Gera as ocorrências que faltam antes de mostrar as telas.
      try {
        await garantirOcorrencias(base.casa.id, hojeISO());
      } catch (e) {
        console.error("Falha ao gerar ocorrências:", e);
      }
      setEstado({ fase: "pronto", base });
    } catch (e) {
      setEstado({ fase: "erro", mensagem: formatarErro(e) });
    }
  });

  useEffect(() => {
    iniciarOcultar();
    supabase()
      .auth.getUser()
      .then(({ data }) => iniciar(data.user))
      .catch((e) => setEstado({ fase: "erro", mensagem: formatarErro(e) }));
    const { data } = supabase().auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") router.replace("/login");
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  if (estado.fase === "carregando") return <Carregando texto="Abrindo..." />;
  if (estado.fase === "erro")
    return (
      <div className="mx-auto flex max-w-md flex-col gap-3 p-6">
        <Erro mensagem={estado.mensagem} />
        <Botao onClick={() => location.reload()}>Tentar de novo</Botao>
      </div>
    );
  if (estado.fase === "onboarding") return <Onboarding aoConcluir={() => location.reload()} />;

  return (
    <AppProvider inicial={estado.base}>
      <BarraLateral />
      <div className="lg:pl-64">
        <div className="mx-auto min-h-dvh max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[calc(7rem+env(safe-area-inset-bottom))] lg:max-w-6xl lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </div>
      </div>
      <NavInferior />
    </AppProvider>
  );
}
