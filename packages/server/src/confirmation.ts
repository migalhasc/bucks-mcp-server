/**
 * Shared preview/confirmation helpers for write operations.
 *
 * Pattern (stateless, two-step):
 *  1. Tool called WITHOUT confirmed=true → returns preview + instructions
 *  2. Tool called WITH confirmed=true → executes
 */

export interface WritePreview {
  /** Human-readable action label, e.g. "Criar contato" */
  acao: string;
  /** Human-readable target, e.g. "João Silva (+5511999999999)" */
  alvo: string;
  /** Key/value fields being written */
  campos?: Record<string, unknown>;
  /** Extra warning for sensitive actions */
  aviso?: string;
}

/** MCP response shape */
export type McpContent = { type: "text"; text: string };
export type McpResult = { content: McpContent[]; isError?: boolean };

/**
 * Returns a preview response asking the user to confirm.
 * Returned when `confirmed` is falsy.
 */
export function buildPreview(preview: WritePreview): McpResult {
  const lines: string[] = [
    "📋 **Prévia da ação — confirme antes de prosseguir**",
    "",
    `**Ação:** ${preview.acao}`,
    `**Alvo:** ${preview.alvo}`,
  ];

  if (preview.campos && Object.keys(preview.campos).length > 0) {
    lines.push("**Campos:**");
    for (const [k, v] of Object.entries(preview.campos)) {
      lines.push(`  • ${k}: ${JSON.stringify(v)}`);
    }
  }

  if (preview.aviso) {
    lines.push("", `⚠️ **Atenção:** ${preview.aviso}`);
  }

  lines.push("", "Para confirmar, chame novamente esta tool com `confirmed: true`.");

  return {
    content: [{ type: "text", text: lines.join("\n") }],
  };
}

/** Returns a success response after execution. */
export function buildSuccess(message: string, data?: unknown): McpResult {
  const text = data
    ? `${message}\n\n${JSON.stringify(data, null, 2)}`
    : message;
  return { content: [{ type: "text", text }] };
}

/** Returns an error response. */
export function buildError(message: string): McpResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

/**
 * Returns disambiguation response when multiple candidates exist.
 * Caller should pass up to 5 candidates.
 */
export function buildDisambiguation(
  action: string,
  candidates: Array<{ id: string; name: string; phone: string; extra?: string }>,
): McpResult {
  const lines = [
    `Encontrei ${candidates.length} contato(s) possível(is) para "${action}". Especifique o alvo pelo ID ou telefone:`,
    "",
  ];
  for (const c of candidates.slice(0, 5)) {
    const extra = c.extra ? ` — ${c.extra}` : "";
    lines.push(`• **${c.name}** | telefone: ${c.phone} | id: ${c.id}${extra}`);
  }
  lines.push("", "Reenvie o pedido especificando o campo `id` ou `phone` do contato correto.");
  return { content: [{ type: "text", text: lines.join("\n") }] };
}
