"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";
import { formatarNumero, formatarReais, mascararDigitos } from "@/lib/dinheiro";

type Variante = "primario" | "secundario" | "perigo" | "fantasma";

const estilosBotao: Record<Variante, string> = {
  primario: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-600/50",
  secundario: "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700",
  perigo: "bg-red-600 text-white hover:bg-red-700",
  fantasma: "hover:bg-slate-200 dark:hover:bg-slate-800",
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
          !/(^|\s)text-(red|emerald|slate|sky|amber)-/.test(className ?? "") &&
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
  "w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

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
      <input type="checkbox" checked={marcado} onChange={(e) => aoMudar(e.target.checked)} className="size-5 accent-emerald-600" />
      {rotulo}
    </label>
  );
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={clsx(
        "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900",
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
      <h2 className="text-base font-semibold">{children}</h2>
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
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
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
        "whitespace-nowrap tabular-nums",
        sinal && valor < 0 && "text-red-600 dark:text-red-400",
        sinal && valor > 0 && "text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      {formatarReais(valor)}
    </span>
  );
}

export function Barra({ valor, total, cor = "bg-emerald-500" }: { valor: number; total: number; cor?: string }) {
  const pct = total > 0 ? Math.min(100, Math.max(0, (valor / total) * 100)) : 0;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
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
      <div className="absolute inset-0 bg-black/50" onClick={aoFechar} />
      <div className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-3xl dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-full p-2 hover:bg-slate-100 dark:hover:bg-slate-800"
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
    <div role="tablist" className="mb-4 flex gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
      {abas.map((a) => (
        <button
          key={a.valor}
          type="button"
          role="tab"
          aria-selected={atual === a.valor}
          onClick={() => aoMudar(a.valor)}
          className={clsx(
            "min-h-9 flex-1 rounded-lg px-2 text-sm font-medium",
            atual === a.valor ? "bg-white shadow-sm dark:bg-slate-950" : "text-slate-600 dark:text-slate-400",
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
    azul: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
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
