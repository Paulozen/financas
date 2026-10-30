import { describe, expect, it } from "vitest";
import { avisosConexao, descreverEstado, type EstadoItem } from "./conexoes";

const item = (p: Partial<EstadoItem>): EstadoItem => ({
  pluggy_item_id: "item-1",
  dono_membro_id: "m1",
  banco: "Banco Exemplo",
  status: "UPDATED",
  erro_codigo: null,
  consent_expires_at: "2027-10-30T00:00:00.000Z",
  ultima_sincronizacao: "2026-10-30T12:00:00.000Z",
  ultimo_erro: null,
  ...p,
});

describe("conexões com os bancos", () => {
  it("descreve o estado em português", () => {
    expect(descreverEstado(item({}))).toBe("Em dia");
    expect(descreverEstado(item({ status: "LOGIN_ERROR", erro_codigo: "USER_AUTHORIZATION_EXPIRED" }))).toBe("A autorização de leitura expirou");
    expect(descreverEstado(item({ ultimo_erro: "Item not found" }))).toMatch(/itemId mudou/);
    expect(descreverEstado(item({ status: null, ultima_sincronizacao: null }))).toBe("Ainda não sincronizado");
  });

  it("avisa quando faltam menos de 30 dias, quando expirou e quando há erro", () => {
    const hoje = "2026-10-30";
    expect(avisosConexao([item({})], hoje)).toEqual([]);
    expect(avisosConexao([item({ consent_expires_at: "2026-11-20T00:00:00.000Z" })], hoje)[0]).toMatchObject({ tipo: "expirando", texto: "A autorização de leitura vence em 21 dias." });
    expect(avisosConexao([item({ consent_expires_at: "2026-10-01T00:00:00.000Z" })], hoje)[0].tipo).toBe("expirado");
    expect(avisosConexao([item({ status: "LOGIN_ERROR", erro_codigo: "USER_AUTHORIZATION_EXPIRED" })], hoje)[0].tipo).toBe("expirado");
    expect(avisosConexao([item({ ultimo_erro: "Falha de rede" })], hoje)[0]).toMatchObject({ tipo: "erro" });
  });
});
