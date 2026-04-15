import { describe, it, expect } from "@jest/globals";
import {
  isValidPhone,
  validateOutboundInput,
  buildOutboundPreview,
  OutboundPolicyError,
} from "../outbound-policy.js";

describe("isValidPhone", () => {
  it("accepts valid international numbers", () => {
    expect(isValidPhone("+5511999999999")).toBe(true);
    expect(isValidPhone("+1 650 555 0100")).toBe(true); // spaces stripped
    expect(isValidPhone("+447911123456")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(isValidPhone("11999999999")).toBe(false); // missing +
    expect(isValidPhone("+55")).toBe(false); // too short
    expect(isValidPhone("+0011999999999")).toBe(false); // leading 0 after +
    expect(isValidPhone("")).toBe(false);
  });
});


describe("validateOutboundInput", () => {
  const base = {
    phone: "+5511999999999",
    channel: "whatsapp-1",
    message: "Olá, tudo bem?",
  };

  it("returns null for valid input", () => {
    expect(validateOutboundInput(base)).toBeNull();
  });

  it("errors on invalid phone", () => {
    const result = validateOutboundInput({ ...base, phone: "11999" });
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toMatch(/telefone inválido/i);
  });

  it("errors when no channel available", () => {
    const result = validateOutboundInput({ ...base, channel: undefined, defaultChannel: undefined });
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toMatch(/canal/i);
  });

  it("uses defaultChannel when channel not specified", () => {
    const result = validateOutboundInput({ ...base, channel: undefined, defaultChannel: "default-ch" });
    expect(result).toBeNull();
  });

  it("errors on empty message", () => {
    const result = validateOutboundInput({ ...base, message: "  " });
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toMatch(/message/i);
  });

  it("errors when new contact missing name", () => {
    const result = validateOutboundInput({
      ...base,
      newContact: { name: "", origin: "evento" },
    });
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toMatch(/name/i);
  });

  it("errors when new contact missing origin", () => {
    const result = validateOutboundInput({
      ...base,
      newContact: { name: "João", origin: "" },
    });
    expect(result?.isError).toBe(true);
    expect(result?.content[0].text).toMatch(/origin/i);
  });

  it("accepts valid new contact data", () => {
    const result = validateOutboundInput({
      ...base,
      newContact: { name: "João", origin: "evento", tags: ["lead"] },
    });
    expect(result).toBeNull();
  });
});

describe("buildOutboundPreview", () => {
  it("builds standard preview for existing contact", () => {
    const result = buildOutboundPreview(
      { phone: "+5511999999999", channel: "ch-1", message: "Oi" },
      "João Silva",
    );
    expect(result.isError).toBeUndefined();
    const text = result.content[0].text;
    expect(text).toMatch(/Enviar mensagem outbound/);
    expect(text).toMatch(/João Silva/);
    expect(text).not.toMatch(/CONTATO NOVO/);
  });

  it("builds reinforced preview for new contact", () => {
    const result = buildOutboundPreview(
      {
        phone: "+5511999999999",
        channel: "ch-1",
        message: "Oi",
        newContact: { name: "Maria", origin: "evento" },
      },
      "Maria",
    );
    const text = result.content[0].text;
    expect(text).toMatch(/CONTATO NOVO/);
    expect(text).toMatch(/⚠️/);
    expect(text).toMatch(/Criar contato \+ enviar mensagem outbound/);
  });

  it("falls back to defaultChannel when channel not set", () => {
    const result = buildOutboundPreview(
      { phone: "+5511999999999", defaultChannel: "default-ch", message: "Oi" },
      "Ana",
    );
    expect(result.content[0].text).toMatch(/default-ch/);
  });
});
