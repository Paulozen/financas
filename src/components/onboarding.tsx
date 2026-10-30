"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Abas, Botao, Campo, Cartao, Erro, formatarErro } from "./ui";

export function Onboarding({ aoConcluir }: { aoConcluir: () => void }) {
  const [modo, setModo] = useState<"criar" | "entrar">("criar");
  const [nome, setNome] = useState("");
  const [nomeCasa, setNomeCasa] = useState("Nossa casa");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!nome.trim()) return setErro("Informe como você quer ser chamado(a).");
    if (modo === "entrar" && !codigo.trim()) return setErro("Informe o código de convite.");
    setSalvando(true);
    const { error } =
      modo === "criar"
        ? await supabase().rpc("criar_casa", { p_nome_casa: nomeCasa, p_nome_membro: nome })
        : await supabase().rpc("entrar_casa", { p_codigo: codigo, p_nome_membro: nome });
    setSalvando(false);
    if (error) return setErro(formatarErro(error));
    aoConcluir();
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Bem-vindo(a)!</h1>
      <p className="text-slate-600 dark:text-slate-400">
        Para começar, crie a casa ou entre com o código de convite que a outra pessoa recebeu.
      </p>
      <Cartao>
        <form onSubmit={enviar} className="flex flex-col gap-4">
          <Abas
            abas={[
              { valor: "criar", rotulo: "Criar casa" },
              { valor: "entrar", rotulo: "Entrar com código" },
            ]}
            atual={modo}
            aoMudar={setModo}
          />
          <Campo rotulo="Seu nome de exibição" placeholder="Ex.: Ana" value={nome} onChange={(e) => setNome(e.target.value)} />
          {modo === "criar" ? (
            <Campo rotulo="Nome da casa" value={nomeCasa} onChange={(e) => setNomeCasa(e.target.value)} />
          ) : (
            <Campo
              rotulo="Código de convite"
              placeholder="Ex.: K7P2QX"
              autoCapitalize="characters"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            />
          )}
          <Erro mensagem={erro} />
          <Botao type="submit" carregando={salvando}>
            {modo === "criar" ? "Criar casa" : "Entrar"}
          </Botao>
        </form>
      </Cartao>
      <Botao variante="fantasma" onClick={() => supabase().auth.signOut()}>
        Sair
      </Botao>
    </main>
  );
}
