/**
 * Hardening tests for confirmation, disambiguation, and sensitive actions.
 * Validates consistent behavior across all v1 write domains.
 *
 * Issue #14: Hardening de confirmação, desambiguação e ações sensíveis
 */

import { describe, it, expect } from "@jest/globals";
import {
  buildPreview,
  buildDisambiguation,
  buildError,
  buildSuccess,
} from "../confirmation.js";
// ─── Confirmation model consistency ─────────────────────────────────────────

describe("Preview model — format consistency", () => {
  it("preview always contains acao, alvo, and confirmation instruction", () => {
    const domains = [
      { acao: "Criar contato", alvo: "Ana (+5511)" },
      { acao: "Atualizar contato", alvo: "ID: abc" },
      { acao: "Atribuir sessão", alvo: "Sessão ID: s1" },
      { acao: "Transferir sessão", alvo: "Sessão ID: s2" },
      { acao: "Concluir sessão", alvo: "Sessão ID: s3" },
      { acao: "Criar card", alvo: "Oportunidade X" },
      { acao: "Mover card", alvo: "Card ID: c1" },
    ];
    for (const preview of domains) {
      const result = buildPreview(preview);
      const text = result.content[0].text;
      expect(text).toContain(preview.acao);
      expect(text).toContain(preview.alvo);
      expect(text).toContain("confirmed: true");
      expect(result.isError).toBeUndefined();
    }
  });

  it("campos are rendered for all domains", () => {
    const scenarios = [
      { acao: "A", alvo: "B", campos: { nome: "João", email: "j@b.com" } },
      { acao: "A", alvo: "B", campos: { agente: "ag1" } },
      { acao: "A", alvo: "B", campos: { painel: "p1", etapa: "e1" } },
      { acao: "A", alvo: "B", campos: { mensagem: "Olá!" } },
    ];
    for (const scenario of scenarios) {
      const text = buildPreview(scenario).content[0].text;
      for (const key of Object.keys(scenario.campos)) {
        expect(text).toContain(key);
      }
    }
  });

  it("isError is never set on a valid preview", () => {
    const result = buildPreview({ acao: "X", alvo: "Y" });
    expect(result.isError).toBeUndefined();
  });
});

// ─── Sensitive action aviso ──────────────────────────────────────────────────

describe("Sensitive action — aviso in preview", () => {
  it("phone update triggers aviso", () => {
    const result = buildPreview({
      acao: "Atualizar contato",
      alvo: "ID: abc",
      campos: { telefone: "+5511999999999" },
      aviso: "Atualização de telefone é uma ação sensível. O número do contato será alterado permanentemente.",
    });
    const text = result.content[0].text;
    expect(text).toContain("Atenção");
    expect(text).toContain("telefone");
    expect(text).toContain("sensível");
  });

  it("session transfer aviso present", () => {
    const result = buildPreview({
      acao: "Transferir sessão",
      alvo: "Sessão ID: s1",
      campos: { "agente destino": "ag2" },
      aviso: "A sessão será removida do atendente atual e transferida.",
    });
    expect(result.content[0].text).toContain("removida do atendente atual");
  });

  it("close session aviso mentions irreversibility", () => {
    const result = buildPreview({
      acao: "Concluir sessão",
      alvo: "Sessão ID: s1",
      aviso: "A sessão será encerrada. Esta ação não pode ser desfeita.",
    });
    expect(result.content[0].text).toContain("não pode ser desfeita");
  });

  it("card move to final stage shows aviso", () => {
    const result = buildPreview({
      acao: "Mover card",
      alvo: "Card ID: c1",
      campos: { "etapa destino": "etapa-final" },
      aviso: "Esta é uma etapa final. Certifique-se de que o movimento é correto.",
    });
    expect(result.content[0].text).toContain("etapa final");
  });

  it("contact creation aviso present", () => {
    const result = buildPreview({
      acao: "Criar contato",
      alvo: "João (+5511999999999)",
      campos: { nome: "João" },
      aviso: "Contato novo será criado na plataforma.",
    });
    expect(result.content[0].text).toContain("Contato novo");
  });

  it("non-sensitive writes have no aviso", () => {
    const noAvisoPreviewTexts = [
      buildPreview({ acao: "Atribuir sessão", alvo: "Sessão ID: s1", campos: { agente: "ag1" } }),
      buildPreview({ acao: "Adicionar nota interna", alvo: "Sessão ID: s1", campos: { nota: "ok" } }),
      buildPreview({ acao: "Criar card", alvo: "(sem título)", campos: { painel: "p1" } }),
    ];
    for (const result of noAvisoPreviewTexts) {
      expect(result.content[0].text).not.toContain("Atenção");
    }
  });
});

// ─── Disambiguation consistency ──────────────────────────────────────────────

describe("Disambiguation — uniform format across domains", () => {
  const candidateFixture = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `id-${i}`,
      name: `Contato ${i}`,
      phone: `+5511999${i.toString().padStart(6, "0")}`,
    }));

  it("returns up to 5 candidates regardless of input size", () => {
    const result = buildDisambiguation("João", candidateFixture(8));
    const text = result.content[0].text;
    // 5 bullet points expected
    expect((text.match(/•/g) ?? []).length).toBe(5);
  });

  it("lists id and phone for each candidate", () => {
    const candidates = candidateFixture(2);
    const text = buildDisambiguation("Ana", candidates).content[0].text;
    for (const c of candidates) {
      expect(text).toContain(c.id);
      expect(text).toContain(c.phone);
    }
  });

  it("instructs user to resubmit with id or phone", () => {
    const text = buildDisambiguation("X", candidateFixture(1)).content[0].text;
    expect(text).toContain("id");
    expect(text).toContain("phone");
  });

  it("isError is not set on disambiguation response", () => {
    const result = buildDisambiguation("X", candidateFixture(2));
    expect(result.isError).toBeUndefined();
  });

  it("includes extra field when provided", () => {
    const candidates = [{ id: "x1", name: "Ana", phone: "+5511", extra: "CS team" }];
    const text = buildDisambiguation("Ana", candidates).content[0].text;
    expect(text).toContain("CS team");
  });
});


// ─── Error and success response format ──────────────────────────────────────

describe("Error and success response format", () => {
  it("buildError marks isError true with message", () => {
    const result = buildError("Falhou por X.");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Falhou por X.");
  });

  it("buildSuccess has no isError flag", () => {
    const result = buildSuccess("Criado com sucesso.");
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain("Criado com sucesso.");
  });

  it("buildSuccess with data serializes JSON", () => {
    const result = buildSuccess("Ok", { id: "abc", name: "João" });
    expect(result.content[0].text).toContain('"id": "abc"');
    expect(result.content[0].text).toContain('"name": "João"');
  });
});
