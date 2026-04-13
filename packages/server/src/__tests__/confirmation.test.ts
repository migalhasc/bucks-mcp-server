/**
 * Tests for the confirmation/preview module.
 */

import { describe, it, expect } from "@jest/globals";
import { buildPreview, buildSuccess, buildError, buildDisambiguation } from "../confirmation.js";

describe("buildPreview", () => {
  it("includes acao, alvo and instructions in output", () => {
    const result = buildPreview({ acao: "Criar contato", alvo: "Ana (+5511)" });
    const text = result.content[0].text;
    expect(text).toContain("Criar contato");
    expect(text).toContain("Ana (+5511)");
    expect(text).toContain("confirmed: true");
    expect(result.isError).toBeUndefined();
  });

  it("includes campos when provided", () => {
    const result = buildPreview({
      acao: "Atualizar",
      alvo: "ID: x1",
      campos: { nome: "João", email: "joao@test.com" },
    });
    const text = result.content[0].text;
    expect(text).toContain("nome");
    expect(text).toContain("João");
  });

  it("includes aviso for sensitive actions", () => {
    const result = buildPreview({
      acao: "Criar contato",
      alvo: "X",
      aviso: "Contato novo será criado.",
    });
    expect(result.content[0].text).toContain("Contato novo será criado.");
  });
});

describe("buildSuccess", () => {
  it("includes message in output", () => {
    const result = buildSuccess("Operação concluída.");
    expect(result.content[0].text).toContain("Operação concluída.");
    expect(result.isError).toBeUndefined();
  });

  it("includes serialized data when provided", () => {
    const result = buildSuccess("Ok", { id: "abc" });
    expect(result.content[0].text).toContain('"id": "abc"');
  });
});

describe("buildError", () => {
  it("marks response as error", () => {
    const result = buildError("Algo deu errado.");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Algo deu errado.");
  });
});

describe("buildDisambiguation", () => {
  it("lists up to 5 candidates", () => {
    const candidates = Array.from({ length: 7 }, (_, i) => ({
      id: `id${i}`,
      name: `Pessoa ${i}`,
      phone: `+551199999999${i}`,
    }));
    const result = buildDisambiguation("João", candidates);
    const text = result.content[0].text;
    // Should show max 5
    expect((text.match(/id:/g) ?? []).length).toBe(5);
  });

  it("includes instructions to resubmit", () => {
    const result = buildDisambiguation("Ana", [
      { id: "x1", name: "Ana Silva", phone: "+5511" },
    ]);
    expect(result.content[0].text).toContain("id");
    expect(result.content[0].text).toContain("phone");
  });
});
