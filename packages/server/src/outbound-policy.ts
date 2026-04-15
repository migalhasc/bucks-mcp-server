/**
 * Outbound policy enforcement for v1.
 *
 * Rules:
 * - Only `commercial` and `admin` roles may initiate outbound.
 * - Phone must be in international format.
 * - A channel must be resolved (explicit or default).
 * - New-contact outbound requires phone + name + origin.
 * - Confirmation (confirmed=true) is always required.
 */

import { buildPreview, buildError, McpResult } from "./confirmation.js";

// ─── Phone validation ────────────────────────────────────────────────────────

/** E.164-ish: starts with +, 7–15 digits. */
const PHONE_RE = /^\+[1-9]\d{6,14}$/;

export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.replace(/\s/g, ""));
}

export class OutboundPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundPolicyError";
  }
}

// ─── Input validation ────────────────────────────────────────────────────────

export interface OutboundInput {
  phone: string;
  channel?: string;
  defaultChannel?: string;
  message: string;
  /** Present when creating a new contact in the same flow */
  newContact?: {
    name: string;
    origin: string;
    tags?: string[];
  };
}

/** Returns an error result if outbound input is invalid, otherwise null. */
export function validateOutboundInput(input: OutboundInput): McpResult | null {
  if (!isValidPhone(input.phone)) {
    return buildError(
      `Telefone inválido: '${input.phone}'. Use formato internacional: +5511999999999.`,
    );
  }

  const channel = input.channel ?? input.defaultChannel;
  if (!channel) {
    return buildError(
      "Canal de envio não definido. Configure o canal padrão ou informe o campo 'channel'.",
    );
  }

  if (!input.message || input.message.trim().length === 0) {
    return buildError("O campo 'message' é obrigatório para outbound.");
  }

  if (input.newContact) {
    if (!input.newContact.name || input.newContact.name.trim().length === 0) {
      return buildError("Campo 'name' é obrigatório ao criar contato novo.");
    }
    if (!input.newContact.origin || input.newContact.origin.trim().length === 0) {
      return buildError("Campo 'origin' é obrigatório ao criar contato novo.");
    }
  }

  return null;
}

// ─── Preview builders ────────────────────────────────────────────────────────

/**
 * Builds a standard or reinforced preview depending on whether a new contact
 * is being created.
 */
export function buildOutboundPreview(
  input: OutboundInput,
  contactName: string,
): McpResult {
  const channel = input.channel ?? input.defaultChannel ?? "canal padrão";

  if (input.newContact) {
    return buildPreview({
      acao: "Criar contato + enviar mensagem outbound",
      alvo: `${contactName} (${input.phone}) — CONTATO NOVO`,
      campos: {
        origem: input.newContact.origin,
        canal: channel,
        mensagem: input.message,
        ...(input.newContact.tags?.length ? { tags: input.newContact.tags.join(", ") } : {}),
      },
      aviso:
        "Esta ação criará um contato NOVO e enviará uma mensagem outbound. Verifique os dados antes de confirmar.",
    });
  }

  return buildPreview({
    acao: "Enviar mensagem outbound",
    alvo: `${contactName} (${input.phone})`,
    campos: {
      canal: channel,
      mensagem: input.message,
    },
  });
}
