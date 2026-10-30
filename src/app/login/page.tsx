"use client";

import { Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Botao, Campo, Cartao, Erro, formatarErro } from "@/components/ui";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEntrando(true);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password: senha });
    setEntrando(false);
    if (error) return setErro(formatarErro(error));
    router.replace("/");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="rounded-2xl bg-emerald-600 p-3 text-white">
          <Wallet className="size-8" aria-hidden />
        </div>
        <h1 className="text-2xl font-bold">Finanças da Casa</h1>
      </div>
      <Cartao>
        <form onSubmit={entrar} className="flex flex-col gap-4">
          <Campo rotulo="E-mail" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Campo
            rotulo="Senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <Erro mensagem={erro} />
          <Botao type="submit" carregando={entrando}>
            Entrar
          </Botao>
        </form>
      </Cartao>
    </main>
  );
}
