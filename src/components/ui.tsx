"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { formatarNumero, formatarReais, mascararDigitos } from "@/lib/dinheiro";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const estilosBotao: Record<Variante, string> = {
  primario: "bg-marca-600 text-white shadow-sm shadow-marca-600/25 hover:bg-marca-700 disabled:bg-marca-600/50",
  secundario: "bg-marca-50 text-marca-800 hover:bg-marca-100 dark:bg-marca-950/60 dark:text-marca-200 dark:hover:bg-marca-900/60",
  perigo: "bg-red-600 text-white hover:bg-red-700",
  fantasma: "hover:bg-slate-100 dark:hover:bg-slate-800",
};

export function Botao({
  variante = "primario",
  carregando,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; carregando?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || carregando}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        estilosBotao[variante],
        variante === "fantasma" &&
          !/(^|\s)text-(red|emerald|slate|sky|amber|marca)-/.test(className ?? "") &&
          "text-slate-700 dark:text-slate-200",
        className,
      )}
    >
      {carregando && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

const estiloInput =
  "w-full min-h-11 rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 outline-none focus:border-marca-500 focus:bg-white focus:ring-2 focus:ring-marca-500/25 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:focus:bg-slate-900";

function Rotulo({ id, rotulo, children, dica }: { id: string; rotulo: string; children: ReactNode; dica?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {rotulo}
      </label>
      {children}
      {dica && <p className="text-xs text-slate-500">{dica}</p>}
    </div>
  );
}

export function Campo({
  rotulo,
  dica,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { rotulo: string; dica?: string }) {
  const id = useId();
  return (
    <Rotulo id={id} rotulo={rotulo} dica={dica}>
      <input id={id} {...props} className={clsx(estiloInput, className)} />
    </Rotulo>
  );
}

export function AreaTexto({ rotulo, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { rotulo: string }) {
  const id = useId();
  return (
    <Rotulo id={id} rotulo={rotulo}>
      <textarea id={id} rows={2} {...props} className={clsx(estiloInput, "py-2")} />
    </Rotulo>
  );
}

export function Selecao({
  rotulo,
  opcoes,
  vazio,
  ...props
}: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> & {
  rotulo: string;
  opcoes: { valor: string; rotulo: string }[];
  vazio?: string;
}) {
  const id = useId();
  return (
    <Rotulo id={id} rotulo={rotulo}>
      <select id={id} {...props} className={estiloInput}>
        {vazio !== undefined && <option value="">{vazio}</option>}
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Rotulo>
  );
}

/** Input de dinheiro com máscara brasileira. Valor em centavos. */
export function CampoValor({
  rotulo,
  valor,
  aoMudar,
  dica,
  autoFocus,
}: {
  rotulo: string;
  valor: number;
  aoMudar: (centavos: number) => void;
  dica?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Rotulo id={id} rotulo={rotulo} dica={dica}>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-500">R$</span>
        <input
          id={id}
          inputMode="numeric"
          autoFocus={autoFocus}
          value={formatarNumero(valor)}
          onChange={(e) => aoMudar(mascararDigitos(e.target.value))}
          className={clsx(estiloInput, "pl-10 text-right tabular-nums")}
        />
      </div>
    </Rotulo>
  );
}

export function Interruptor({ rotulo, marcado, aoMudar }: { rotulo: string; marcado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} className="size-5 accent-marca-600" />
      {rotulo}
    </label>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "min-w-0 rounded-3xl border border-transparent bg-white p-4 shadow-folha sm:p-5 dark:border-white/5 dark:bg-slate-900 dark:shadow-none",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Titulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-base font-semibold tracking-tight">{children}</h2>
      {acao}
    </div>
  );
}

export function Carregando({ texto = "Carregando..." }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-slate-500">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      {texto}
    </div>
  );
}

export function Erro({ mensagem }: { mensagem: string | null | undefined }) {
  if (!mensagem) return null;
  return (
    <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      {mensagem}
    </p>
  );
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white/60 p-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <p className="font-medium">{titulo}</p>
      {texto && <p className="text-sm text-slate-500">{texto}</p>}
      {acao}
    </div>
  );
}

export function Dinheiro({
  valor,
  className,
  sinal,
}: {
  valor: number;
  className?: string;
  /** colore verde/vermelho conforme o sinal */
  sinal?: boolean;
}) {
  return (
    <span
      className={clsx(
        "valor-oculto whitespace-nowrap tabular-nums",
        sinal && valor < 0 && "text-red-600 dark:text-red-400",
        sinal && valor > 0 && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {formatarReais(valor)}
    </span>
  );
}

export function Barra({ valor, total, cor = "bg-marca-500" }: { valor: number; total: number; cor?: string }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={clsx("h-full rounded-full", cor)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Modal({
  aberto,
  aoFechar,
  titulo,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && aoFechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal aria-label={titulo}>
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={aoFechar} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full bg-slate-100 p-2 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Abas simples controladas. */
export function Abas<T extends string>({
  abas,
  atual,
  aoMudar,
}: {
  abas: { valor: T; rotulo: string }[];
  atual: T;
  aoMudar: (v: T) => void;
}) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 rounded-2xl bg-slate-200/70 p-1 dark:bg-slate-800/80">
      {abas.map((a) => (
        <button
          key={a.valor}
          type="button"
          role="tab"
          aria-selected={atual === a.valor}
          onClick={() => aoMudar(a.valor)}
          className={clsx(
            "min-h-9 flex-1 rounded-xl px-2 text-sm font-semibold transition-colors",
            atual === a.valor ? "bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400",
          )}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
}

export function Selo({ children, cor = "slate" }: { children: ReactNode; cor?: "slate" | "verde" | "vermelho" | "amarelo" | "azul" }) {
  const cores = {
    slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    verde: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    vermelho: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    amarelo: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    azul: "bg-marca-50 text-marca-700 dark:bg-marca-950 dark:text-marca-300",
  };
  return <span className={clsx("inline-block rounded-full px-2 py-0.5 text-xs font-medium", cores[cor])}>{children}</span>;
}

export function formatarErro(e: unknown): string {
  if (!e) return "Erro desconhecido";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e && typeof e.message === "string") {
    const m = e.message;
    if (m.includes("Failed to fetch")) return "Sem conexão com o servidor. Verifique sua internet.";
    if (m.includes("row-level security")) return "Você não tem permissão para esta ação.";
    if (m.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
    return m;
  }
  return "Erro desconhecido";
}
