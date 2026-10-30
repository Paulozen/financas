"use client";

import type { User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
} from "react";
import { mesDe, hojeISO } from "@/lib/datas";
import { checar } from "@/lib/db";
import { garantirOcorrencias } from "@/lib/sincronizar";
import { aplicarRegrasAutomaticas } from "@/lib/caixa-entrada";
import { precisaSincronizar, registrarTentativa, sincronizarBancos, type ResumoSincronizacao } from "@/lib/open-finance";
import { supabase } from "@/lib/supabase";
import { CASAL, type Casa, type Categoria, type Membro, type Visao } from "@/lib/tipos";
import { formatarErro } from "./ui";

export interface Contexto {
  usuario: User;
  membro: Membro;
  membros: Membro[];
  casa: Casa;
  categorias: Categoria[];
  visao: Visao;
  setVisao: (v: Visao) => void;
  mes: string;
  setMes: (m: string) => void;
  /** Muda a cada alteração de dados; as telas recarregam quando muda. */
  versao: number;
  /** Recarrega casa/membros/categorias e avisa as telas. */
  atualizar: () => Promise<void>;
  /** Roda o motor de ocorrências e depois atualiza. */
  sincronizar: () => Promise<void>;
  nomeDono: (membroId: string | null) => string;
  nomeCategoria: (id: string | null) => string;
  /** Open Finance: busca os dados dos bancos e aplica as regras automáticas. */
  sincronizarBancos: () => Promise<ResumoSincronizacao>;
  bancos: EstadoBancos;
}

export interface EstadoBancos {
  sincronizando: boolean;
  erro?: string;
  resumo?: ResumoSincronizacao;
  /** quantas transações foram confirmadas sozinhas por regra aprendida */
  automaticas?: number;
}

const Ctx = createContext<Contexto | null>(null);

export function useApp(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp fora do AppProvider");
  return c;
}

export interface DadosBase {
  usuario: User;
  membro: Membro;
  membros: Membro[];
  casa: Casa;
  categorias: Categoria[];
}

export async function carregarBase(usuario: User): Promise<DadosBase | { semCasa: true }> {
  const sb = supabase();
  const meu = checar(await sb.from("membros").select("*").eq("user_id", usuario.id).maybeSingle()) as Membro | null;
  if (!meu) return { semCasa: true };
  const [casa, membros, categorias] = await Promise.all([
    sb.from("casas").select("*").eq("id", meu.casa_id).single().then(checar),
    sb.from("membros").select("*").eq("casa_id", meu.casa_id).order("criado_em").then(checar),
    sb.from("categorias").select("*").eq("casa_id", meu.casa_id).order("ordem").then(checar),
  ]);
  return {
    usuario,
    membro: meu,
    casa: casa as Casa,
    membros: membros as Membro[],
    categorias: categorias as Categoria[],
  };
}

export function AppProvider({ inicial, children }: { inicial: DadosBase; children: ReactNode }) {
  const [base, setBase] = useState(inicial);
  // O provider só monta no navegador (depois do login), então pode ler o localStorage.
  const [visao, setVisaoEstado] = useState<Visao>(() => {
    const salva = typeof window !== "undefined" ? localStorage.getItem("visao") : null;
    return salva && inicial.membros.some((m) => m.id === salva) ? salva : CASAL;
  });
  const [mes, setMes] = useState(() => mesDe(hojeISO()));
  const [versao, setVersao] = useState(0);

  const setVisao = useCallback((v: Visao) => {
    setVisaoEstado(v);
    localStorage.setItem("visao", v);
  }, []);

  const atualizar = useCallback(async () => {
    const novo = await carregarBase(base.usuario);
    if (!("semCasa" in novo)) setBase(novo);
    setVersao((v) => v + 1);
  }, [base.usuario]);

  const sincronizar = useCallback(async () => {
    try {
      await garantirOcorrencias(base.casa.id, hojeISO());
    } catch (e) {
      console.error("Falha ao gerar ocorrências:", formatarErro(e));
    }
    setVersao((v) => v + 1);
  }, [base.casa.id]);

  const [bancos, setBancos] = useState<EstadoBancos>({ sincronizando: false });

  const sincronizarBancosCtx = useCallback(async () => {
    setBancos((b) => ({ ...b, sincronizando: true, erro: undefined }));
    try {
      const resumo = await sincronizarBancos();
      const automaticas = base.casa.aplicar_regras_auto ? await aplicarRegrasAutomaticas(base.casa, base.membro).catch(() => 0) : 0;
      await garantirOcorrencias(base.casa.id, hojeISO()).catch(() => {});
      setVersao((v) => v + 1);
      setBancos({ sincronizando: false, resumo, automaticas });
      return resumo;
    } catch (e) {
      setBancos((b) => ({ ...b, sincronizando: false, erro: formatarErro(e) }));
      throw e;
    }
  }, [base.casa, base.membro]);

  // Ao abrir o app: sincroniza os bancos em segundo plano se passou de 6 horas.
  const sincronizarSePreciso = useEffectEvent((precisa: boolean) => {
    if (!precisa) return;
    registrarTentativa();
    sincronizarBancosCtx().catch(() => {});
  });
  useEffect(() => {
    precisaSincronizar(inicial.casa.id)
      .then(sincronizarSePreciso)
      .catch(() => {});
  }, [inicial.casa.id]);

  const nomeDono = useCallback(
    (id: string | null) => (id ? (base.membros.find((m) => m.id === id)?.nome ?? "?") : "Casal"),
    [base.membros],
  );
  const nomeCategoria = useCallback(
    (id: string | null) => (id ? (base.categorias.find((c) => c.id === id)?.nome ?? "") : "Sem categoria"),
    [base.categorias],
  );

  return (
    <Ctx.Provider
      value={{
        ...base,
        visao,
        setVisao,
        mes,
        setMes,
        versao,
        atualizar,
        sincronizar,
        nomeDono,
        nomeCategoria,
        sincronizarBancos: sincronizarBancosCtx,
        bancos,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/**
 * Carrega dados assíncronos e recarrega quando `chave` ou a versão global mudam.
 * Mantém os dados anteriores enquanto recarrega.
 */
export function useCarregar<T>(chave: string, carregar: () => Promise<T>) {
  const { versao } = useApp();
  const [extra, setExtra] = useState(0);
  const alvo = `${chave}|${versao}|${extra}`;
  const [estado, setEstado] = useState<{ dados?: T; erro?: string; alvo?: string }>({});

  const executar = useEffectEvent(() => carregar());

  useEffect(() => {
    let vivo = true;
    executar()
      .then((dados) => vivo && setEstado({ dados, alvo }))
      .catch((e) => vivo && setEstado((s) => ({ dados: s.dados, erro: formatarErro(e), alvo })));
    return () => {
      vivo = false;
    };
  }, [alvo]);

  return {
    dados: estado.dados,
    erro: estado.erro,
    carregando: estado.alvo !== alvo,
    recarregar: () => setExtra((x) => x + 1),
  };
}

/** Filtra itens pela visão atual (membro ou casal). */
export function daVisao<T extends { dono_membro_id: string | null }>(itens: T[], visao: Visao): T[] {
  if (visao === CASAL) return itens;
  return itens.filter((i) => i.dono_membro_id === visao);
}
