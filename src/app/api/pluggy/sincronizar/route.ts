// Sincroniza a casa do usuário logado com a Pluggy (Meu Pluggy).
// Autentica pela sessão do Supabase (cookies) e grava com ela: o RLS vale.
// As credenciais PLUGGY_* ficam só no servidor e nunca vão para a resposta.
import { NextResponse } from "next/server";
import { conectarPluggy, ErroPluggy } from "@/lib/pluggy/api";
import { itensDoAmbiente } from "@/lib/pluggy/converter";
import { sincronizarCasa } from "@/lib/pluggy/sincronizacao";
import { supabaseServidor } from "@/lib/supabase-servidor";

export const maxDuration = 60;

export async function POST() {
  const sb = await supabaseServidor();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Faça login para sincronizar." }, { status: 401 });

  const { data: membro } = await sb.from("membros").select("id, casa_id").eq("user_id", user.id).maybeSingle();
  if (!membro) return NextResponse.json({ erro: "Você ainda não faz parte de uma casa." }, { status: 403 });
  const { data: membros } = await sb.from("membros").select("id, nome").eq("casa_id", membro.casa_id);

  const itens = itensDoAmbiente(process.env);
  if (!itens.length) {
    return NextResponse.json(
      { erro: "Nenhum banco configurado. Cadastre PLUGGY_ITEMS_<NOME> (e PLUGGY_CLIENT_ID/SECRET) nas variáveis do servidor (.env.local e Vercel)." },
      { status: 400 },
    );
  }

  try {
    const pluggy = await conectarPluggy();
    const resumo = await sincronizarCasa(sb, membro.casa_id, membros ?? [], pluggy, itens);
    return NextResponse.json(resumo);
  } catch (e) {
    const status = e instanceof ErroPluggy ? (e.status >= 400 && e.status < 600 ? e.status : 502) : 500;
    const msg = e instanceof Error ? e.message : "Erro desconhecido";
    console.error("Falha na sincronização Pluggy:", msg);
    return NextResponse.json({ erro: msg }, { status });
  }
}
