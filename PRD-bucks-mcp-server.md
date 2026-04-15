# PRD — bucks-mcp-server

Data: 2026-04-15
Status: Documento único consolidado (v1 + v2 + audit completo)
Fonte de API: `flwchat_docs_everything.md` (93 endpoints)
Ubiquitous Language: `UBIQUITOUS_LANGUAGE.md`

---

## Problem Statement

O time da Blank School quer usar Claude, ChatGPT, Codex, Cursor e outros clientes compatíveis com MCP para consultar e operar o CRM/WhatsApp da FlwChat de forma natural, sem depender de uso direto da API ou de automações separadas. A documentação da API existe, mas não há um MCP remoto padronizado, seguro e sempre ativo que traduza pedidos do time em operações confiáveis sobre contatos, sessões, mensagens, cards do CRM e automações.

O problema não é apenas integração técnica. O time precisa de uma camada operacional com lista de acesso por email cadastrado, confirmação antes de escrita, desambiguação segura quando houver múltiplos alvos, e compatibilidade ampla com clientes MCP remotos. A solução deve rodar no VPS atual sem banco de dados próprio.

---

## Solution

Servidor MCP remoto `bucks-mcp-server`, TypeScript/Node.js, SDK oficial MCP, transporte `Streamable HTTP`, deploy no VPS via EasyPanel, publicado via ngrok em `https://bucks-mcp.ngrok.dev/mcp`.

Stateless, sem banco próprio. Auth via OAuth/tokens permanentes. Backend usa token de serviço FlwChat. Acesso livre a todas as tools para qualquer email cadastrado em `roles.yaml` — sem separação por papel. Tools prefixadas `bucks_`, descrições em português, preview + confirmação explícita antes de toda escrita.

---

## Bugs Ativos

### BUG-01 — `fetchAllPages` envia `page`, API espera `pageNumber` (CRÍTICO)
- `src/flwchat/client.ts:247` — `{ ...baseQuery, page, pageSize }` → `{ ...baseQuery, pageNumber: page, pageSize }`
- Impacto: toda auto-paginação retorna página 1 repetida até 5x em todos os domínios

### BUG-02 — `listChatbots()` sem paginação
- `src/flwchat/chatbots.ts` — GET simples, ignora `hasMorePages`. Retorna ~15 itens.
- Fix: substituir por `fetchAllPages`

### BUG-03 — `contacts.search` com filtros faz GET em endpoint POST
- `src/flwchat/contacts.ts:115` — `fetchAllPages` usa `flwchat.get()` mas `/contact/filter` é POST
- Páginas 2+ fazem GET sem body → resultados errados ou 405
- Fix: loop manual `postAllPages` que faz POST com body em cada página

### BUG-04 — `listMessages` sem auto-paginação
- `src/flwchat/sessions.ts` — single page. Sessões com 200+ mensagens perdem histórico.
- Fix: adicionar auto-paginação com `pageNumber`

### BUG-05 — `listCardNotes` sem paginação
- `src/flwchat/crm.ts` — assume resposta como array completo. Endpoint é paginado.
- Fix: `fetchAllPages` com `pageNumber`

---

## User Stories

### Time comercial

1. Buscar contato por telefone, para localizar rapidamente o lead correto.
2. Pesquisar contatos por nome ou filtros, para encontrar leads sem o identificador exato.
3. Buscar contato por ID, para recuperar dados quando já tenho o identificador.
4. Atualizar contato por ID, para manter o CRM consistente.
5. Atualizar contato por telefone, para editar sem buscar o ID previamente.
6. Aplicar etiquetas em contato por ID, para segmentar leads.
7. Aplicar etiquetas em contato por telefone, para etiquetar sem buscar o ID.
8. Criar contato, para iniciar fluxo comercial sem sair do cliente MCP.
9. Criar ou atualizar contatos em lote (até 100), para sincronizar listas de leads.
10. Consultar sessões de um contato, para entender o histórico antes de responder.
11. Responder sessão existente, para continuar conversas ativas com contexto.
12. Responder sessão em modo síncrono, para receber confirmação de entrega imediata.
13. Iniciar mensagem outbound para contato, para fazer prospecção e retomadas.
14. Iniciar outbound em modo síncrono, para obter status de entrega imediato.
15. Ver mensagens recentes, para acompanhar o que aconteceu sem montar filtros complexos.
16. Buscar mensagem por ID, para localizar item referenciado.
17. Consultar status de envio de mensagem, para saber se foi entregue ou falhou.
18. Listar cards do CRM por painel e etapa, para visualizar oportunidades em aberto.
19. Criar card de oportunidade, para registrar negociações sem abrir a interface web.
20. Atualizar card, para refletir mudanças em campos, etapa ou responsável.
21. Mover card entre etapas, para refletir avanço no pipeline.
22. Duplicar card, para clonar oportunidade com configuração similar.
23. Adicionar nota em card, para registrar contexto comercial.
24. Remover nota de card, para corrigir registros.
25. Listar sequências disponíveis, para escolher cadência de follow-up.
26. Listar contatos de uma sequência, para ver quem está em cada cadência.
27. Adicionar contato a sequência, para iniciar fluxo automático de prospecção.
28. Remover contato de sequência, para cancelar fluxo automático.

### Time de CS

29. Consultar sessões, mensagens, contatos e cards, para ver histórico completo do cliente.
30. Atribuir sessão a agente, para organizar ownership do caso.
31. Transferir sessão entre equipes ou responsáveis, para encaminhar atendimento.
32. Alterar status de sessão, para refletir andamento operacional.
33. Concluir atendimento, para sinalizar encerramento de forma explícita.
34. Atualizar atributos parciais de sessão, para ajustar campos sem sobrescrever tudo.
35. Adicionar nota interna à sessão, para registrar contexto não visível ao contato.
36. Listar notas internas de sessão, para revisar histórico da equipe.
37. Obter nota interna por ID, para verificar conteúdo exato.
38. Deletar nota interna de sessão, para corrigir registros incorretos.
39. Disparar chatbot em conversa, para automatizar respostas sem acesso direto à API.

### Lookup (todos os papéis)

40. Listar chatbots cadastrados (com paginação completa), para ver todos os bots disponíveis.
41. Listar agentes cadastrados, para obter IDs ao atribuir sessões e cards.
42. Obter agente por ID, para confirmar dados antes de atribuir.
43. Listar equipes (departamentos), para obter IDs ao transferir sessões.
44. Obter equipe por ID, para confirmar nome e canais vinculados.
45. Listar canais de uma equipe, para saber por qual canal atende.
46. Listar canais globais, para saber qual canal usar em outbound.
47. Listar tags cadastradas, para saber quais etiquetas aplicar a contatos.
48. Listar templates aprovados, para escolher modelo válido em outbound fora da janela de 24h.
49. Listar campos customizados globais, para conhecer o schema antes de criar/atualizar.
50. Listar campos customizados de contato, para saber quais campos extras o contato suporta.
51. Listar campos customizados de painel, para preencher corretamente campos de cards.

### Admin / Carteiras

52. Listar carteiras, para ver distribuição de contatos por responsável.
53. Listar contatos de uma carteira, para inspecionar quem está em cada grupo.
54. Adicionar contato a carteira, para reorganizar distribuição de leads.
55. Remover contato de carteira, para corrigir atribuições erradas.

### Infra / operação

56. Servidor sempre ativo no VPS, sem depender de execução local por usuário.
57. RBAC aplicado por papel (commercial, cs, admin), para reduzir risco operacional.
58. Confirmação antes de toda escrita, para evitar mudanças acidentais.
59. Preview claro da ação antes de confirmar, para entender exatamente o impacto.
60. Confirmação reforçada em ações sensíveis, para reduzir risco em operações críticas.
61. Desambiguação quando houver múltiplos alvos possíveis, para evitar alvo errado.
62. Até 5 candidatos em caso de ambiguidade, para decidir rápido sem excesso de ruído.
63. Consultas recentes com janela padrão de 24h, sem precisar informar datas toda vez.
64. Auto-paginação em leituras amplas, para receber resultados melhores sem esforço extra.
65. Erros claros e acionáveis, para corrigir o problema rapidamente.
66. Respostas em português, para facilitar o uso pelo time.
67. Logs estruturados, healthcheck e métricas básicas, para monitorar disponibilidade.

---

## Full API Coverage Map

Legenda: ✅ Implementado | 🔨 A implementar | 🔜 v3+

### FILES

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔜 | GET | `/core/v2/file` | `bucks_get_file_upload_url` |
| 🔜 | POST | `/core/v2/file` | `bucks_save_file` |

### CUSTOM FIELDS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/core/v1/custom-field` | `bucks_list_custom_fields` |
| 🔨 | GET | `/core/v1/contact/custom-field` | `bucks_list_contact_custom_fields` |

### PORTFOLIOS / CARTEIRAS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/core/v1/portfolio` | `bucks_list_portfolios` |
| 🔨 | GET | `/core/v1/portfolio/{id}/contact` | `bucks_list_portfolio_contacts` |
| 🔨 | POST | `/core/v1/portfolio/{id}/contact` | `bucks_add_portfolio_contact` |
| 🔨 | DELETE | `/core/v1/portfolio/{id}/contact` | `bucks_remove_portfolio_contact` |
| 🔜 | POST | `/core/v1/portfolio/{id}/contact/batch` | `bucks_batch_add_portfolio_contacts` |
| 🔜 | DELETE | `/core/v1/portfolio/{id}/contact/batch` | `bucks_batch_remove_portfolio_contacts` |

### CONTACTS / CONTATOS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ | GET | `/core/v1/contact` | `bucks_search_contacts` |
| ✅ | POST | `/core/v1/contact/filter` | `bucks_search_contacts` (filtrado) |
| ✅ | GET | `/core/v1/contact/phonenumber/{phone}` | `bucks_find_contact_by_phone` |
| 🔨 | PUT | `/core/v1/contact/phonenumber/{phone}` | `bucks_update_contact_by_phone` |
| 🔨 | POST | `/core/v1/contact/phonenumber/{phone}/tags` | `bucks_update_contact_tags_by_phone` |
| 🔨 | GET | `/core/v1/contact/{id}` | `bucks_get_contact` |
| ✅ | POST | `/core/v1/contact` | `bucks_create_contact` |
| ✅ | PUT | `/core/v2/contact/{id}` | `bucks_update_contact` |
| ✅ | POST | `/core/v1/contact/{id}/tags` | `bucks_update_contact_tags` |
| 🔨 | POST | `/core/v2/contact/batch` | `bucks_batch_save_contacts` |

### DEPARTMENTS / EQUIPES

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/core/v2/department` | `bucks_list_departments` |
| 🔨 | GET | `/core/v1/department/{id}` | `bucks_get_department` |
| 🔨 | GET | `/core/v1/department/{id}/channel` | `bucks_list_department_channels` |
| 🔜 | POST | `/core/v1/department` | `bucks_create_department` |
| 🔜 | PUT | `/core/v1/department/{id}` | `bucks_update_department` |
| 🔜 | DELETE | `/core/v1/department/{id}` | `bucks_delete_department` |
| 🔜 | PUT | `/core/v1/department/{id}/agents` | `bucks_update_department_agents` |

### TAGS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/core/v1/tag` | `bucks_list_tags` |

### OFFICE HOURS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔜 | GET | `/core/v1/company/officehours` | `bucks_get_office_hours` |

### AGENTS / AGENTES

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/core/v1/agent` | `bucks_list_agents` |
| 🔨 | GET | `/core/v1/agent/{id}` | `bucks_get_agent` |
| 🔜 | POST | `/core/v1/agent` | `bucks_create_agent` |
| 🔜 | PUT | `/core/v1/agent/{id}` | `bucks_update_agent` |
| 🔜 | DELETE | `/core/v1/agent/{id}` | `bucks_delete_agent` |
| 🔜 | POST | `/core/v1/agent/{id}/departments` | `bucks_update_agent_departments` |
| 🔜 | POST | `/core/v1/agent/{id}/status` | `bucks_set_agent_status` |
| 🔜 | POST | `/core/v1/agent/{id}/logout` | `bucks_logout_agent` |

### WEBHOOKS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔜 | GET | `/core/v1/webhook/event` | `bucks_list_webhook_events` |
| 🔜 | GET | `/core/v1/webhook/subscription` | `bucks_list_webhook_subscriptions` |
| 🔜 | POST | `/core/v1/webhook/subscription` | `bucks_create_webhook_subscription` |
| 🔜 | GET | `/core/v1/webhook/subscription/{id}` | `bucks_get_webhook_subscription` |
| 🔜 | PUT | `/core/v1/webhook/subscription/{id}` | `bucks_update_webhook_subscription` |
| 🔜 | DELETE | `/core/v1/webhook/subscription/{id}` | `bucks_delete_webhook_subscription` |

### CHANNELS / CANAIS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/chat/v1/channel` | `bucks_list_channels` |

### CHATBOTS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ BUG-02 | GET | `/chat/v1/chatbot` | `bucks_list_chatbots` |
| 🔨 | POST | `/chat/v1/chatbot/send` | `bucks_send_chatbot` |

### SESSIONS / CONVERSAS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ | GET | `/chat/v2/session` | `bucks_list_sessions` |
| ✅ | GET | `/chat/v2/session/{id}` | `bucks_get_session` |
| ✅ | PUT | `/chat/v1/session/{id}/transfer` | `bucks_transfer_session` |
| ✅ | PUT | `/chat/v1/session/{id}/assignee` | `bucks_assign_session` |
| ✅ | PUT | `/chat/v1/session/{id}/complete` | `bucks_close_session` |
| ✅ | PUT | `/chat/v1/session/{id}/status` | `bucks_set_session_status` |
| 🔨 | PUT | `/chat/v2/session/{id}/partial` | `bucks_update_session` |
| ✅ BUG-04 | GET | `/chat/v1/session/{id}/message` | `bucks_list_messages` |
| ✅ | POST | `/chat/v1/session/{id}/message` | `bucks_reply_session` |
| 🔨 | POST | `/chat/v1/session/{id}/message/sync` | `bucks_reply_session_sync` |
| ✅ | POST | `/chat/v1/session/{id}/note` | `bucks_add_session_note` |
| 🔨 | GET | `/chat/v1/session/{id}/note` | `bucks_list_session_notes` |
| 🔨 | GET | `/chat/v1/session/note/{id}` | `bucks_get_session_note` |
| 🔨 | DELETE | `/chat/v1/session/note/{id}` | `bucks_delete_session_note` |

### MESSAGES / MENSAGENS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ | POST | `/chat/v1/message/send` | `bucks_send_outbound` |
| 🔨 | POST | `/chat/v1/message/send-sync` | `bucks_send_outbound_sync` |
| 🔨 | GET | `/chat/v1/message/{id}` | `bucks_get_message` |
| 🔨 | GET | `/chat/v1/message/{id}/status` | `bucks_get_message_status` |
| 🔜 | DELETE | `/chat/v1/message/{id}` | `bucks_delete_message` |
| 🔜 | GET | `/chat/v1/message` | (alias de `bucks_list_messages`) |

### SCHEDULED MESSAGES / MENSAGENS AGENDADAS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔜 | GET | `/chat/v1/scheduled-message` | `bucks_list_scheduled_messages` |
| 🔜 | POST | `/chat/v1/scheduled-message` | `bucks_create_scheduled_message` |
| 🔜 | GET | `/chat/v1/scheduled-message/{id}` | `bucks_get_scheduled_message` |
| 🔜 | PUT | `/chat/v1/scheduled-message/{id}` | `bucks_update_scheduled_message` |
| 🔜 | POST | `/chat/v1/scheduled-message/{id}/cancel` | `bucks_cancel_scheduled_message` |
| 🔜 | POST | `/chat/v1/scheduled-message/batch-cancel` | `bucks_batch_cancel_scheduled_messages` |

### TEMPLATES

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/chat/v1/template` | `bucks_list_templates` |
| 🔜 | POST | `/chat/v1/template/otp/send` | `bucks_send_otp` |
| 🔜 | GET | `/chat/v1/template/otp/{messageId}/status` | `bucks_get_otp_status` |

### SEQUENCES / SEQUÊNCIAS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| 🔨 | GET | `/chat/v1/sequence` | `bucks_list_sequences` |
| 🔨 | GET | `/chat/v2/sequence/{id}/contact` | `bucks_list_sequence_contacts` |
| 🔨 | POST | `/chat/v1/sequence/{id}/contact` | `bucks_add_sequence_contact` |
| 🔨 | DELETE | `/chat/v1/sequence/{id}/contact` | `bucks_remove_sequence_contact` |
| 🔜 | POST | `/chat/v1/sequence/{id}/contact/batch` | `bucks_batch_add_sequence_contacts` |
| 🔜 | DELETE | `/chat/v1/sequence/{id}/contact/batch` | `bucks_batch_remove_sequence_contacts` |

### CRM — CARDS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ | GET | `/crm/v1/panel/card` | `bucks_list_cards` |
| ✅ | POST | `/crm/v1/panel/card` | `bucks_create_card` |
| ✅ | GET | `/crm/v1/panel/card/{id}` | `bucks_get_card` |
| ✅ | PUT | `/crm/v2/panel/card/{id}` | `bucks_update_card` / `bucks_move_card` |
| 🔨 | POST | `/crm/v1/panel/card/{id}/duplicate` | `bucks_duplicate_card` |
| ✅ BUG-05 | GET | `/crm/v1/panel/card/{cardId}/note` | (dentro de `bucks_get_card`) |
| ✅ | POST | `/crm/v1/panel/card/{cardId}/note` | `bucks_add_card_note` |
| ✅ | DELETE | `/crm/v1/panel/card/{cardId}/note/{noteId}` | `bucks_delete_card_note` |

### CRM — PANELS / PAINÉIS

| Status | Method | Endpoint | Tool |
|--------|--------|----------|------|
| ✅ | GET | `/crm/v1/panel` | `bucks_list_boards` |
| ✅ | GET | `/crm/v1/panel/{id}` | (usado internamente) |
| 🔨 | GET | `/crm/v1/panel/{id}/custom-fields` | `bucks_get_panel_custom_fields` |

### AUTH

| Status | Method | Endpoint | Nota |
|--------|--------|----------|------|
| 🔜 | POST | `/auth/v1/login/authenticate/external` | Backend only — não expor via MCP |

---

## Coverage Summary

| Status | Count | % |
|--------|-------|---|
| ✅ Implementado (inclui bugados) | 26 | 28% |
| 🔨 A implementar | 34 | 37% |
| 🔜 v3+ | 33 | 35% |
| **Total** | **93** | 100% |

---

## Complete Tool List

Acesso livre a todas as tools para qualquer email cadastrado em `roles.yaml`. 57 tools no total após implementação completa dos 🔨.

| Tool | Status |
|------|--------|
| `bucks_find_contact_by_phone` | ✅ |
| `bucks_search_contacts` | ✅ BUG-03 |
| `bucks_get_contact` | 🔨 |
| `bucks_create_contact` | ✅ |
| `bucks_update_contact` | ✅ |
| `bucks_update_contact_by_phone` | 🔨 |
| `bucks_update_contact_tags` | ✅ |
| `bucks_update_contact_tags_by_phone` | 🔨 |
| `bucks_batch_save_contacts` | 🔨 |
| `bucks_list_sessions` | ✅ BUG-01 |
| `bucks_get_session` | ✅ |
| `bucks_update_session` | 🔨 |
| `bucks_assign_session` | ✅ |
| `bucks_transfer_session` | ✅ |
| `bucks_set_session_status` | ✅ |
| `bucks_close_session` | ✅ |
| `bucks_list_messages` | ✅ BUG-04 |
| `bucks_reply_session` | ✅ |
| `bucks_reply_session_sync` | 🔨 |
| `bucks_add_session_note` | ✅ |
| `bucks_list_session_notes` | 🔨 |
| `bucks_get_session_note` | 🔨 |
| `bucks_delete_session_note` | 🔨 |
| `bucks_send_outbound` | ✅ |
| `bucks_send_outbound_sync` | 🔨 |
| `bucks_get_message` | 🔨 |
| `bucks_get_message_status` | 🔨 |
| `bucks_list_chatbots` | ✅ BUG-02 |
| `bucks_send_chatbot` | 🔨 |
| `bucks_list_channels` | 🔨 |
| `bucks_list_tags` | 🔨 |
| `bucks_list_templates` | 🔨 |
| `bucks_list_agents` | 🔨 |
| `bucks_get_agent` | 🔨 |
| `bucks_list_departments` | 🔨 |
| `bucks_get_department` | 🔨 |
| `bucks_list_department_channels` | 🔨 |
| `bucks_list_custom_fields` | 🔨 |
| `bucks_list_contact_custom_fields` | 🔨 |
| `bucks_list_boards` | ✅ |
| `bucks_list_cards` | ✅ BUG-01 |
| `bucks_get_card` | ✅ BUG-05 |
| `bucks_create_card` | ✅ |
| `bucks_update_card` | ✅ |
| `bucks_move_card` | ✅ |
| `bucks_duplicate_card` | 🔨 |
| `bucks_add_card_note` | ✅ |
| `bucks_delete_card_note` | ✅ |
| `bucks_get_panel_custom_fields` | 🔨 |
| `bucks_list_portfolios` | 🔨 |
| `bucks_list_portfolio_contacts` | 🔨 |
| `bucks_add_portfolio_contact` | 🔨 |
| `bucks_remove_portfolio_contact` | 🔨 |
| `bucks_list_sequences` | 🔨 |
| `bucks_list_sequence_contacts` | 🔨 |
| `bucks_add_sequence_contact` | 🔨 |
| `bucks_remove_sequence_contact` | 🔨 |

**Total: 57 tools** (20 implementadas + 37 a implementar)

---

## Ações sensíveis (preview reforçado)

| Ação | Motivo |
|------|--------|
| Outbound para contato novo | Cria contato + envia mensagem num único fluxo |
| Atualização de telefone | Dado de identidade, impacto cascata |
| Movimento de card para etapa final | Pode sinalizar encerramento de negociação |
| Conclusão de atendimento | Encerramento irreversível |
| Transferência de sessão | Muda ownership do caso |
| `bucks_send_chatbot` | Bloqueia interação de agentes durante execução |
| `bucks_batch_save_contacts` | Impacto em massa (até 100 contatos) |
| `bucks_remove_sequence_contact` | Cancela cadência ativa |
| `bucks_delete_session_note` | Exclusão irreversível |

---

## Implementation Decisions

- TypeScript + Node.js LTS, `@modelcontextprotocol/sdk`, Streamable HTTP.
- Stateless, sem banco próprio.
- Auth: OAuth 2.1 / tokens permanentes. Backend: token de serviço FlwChat.
- Autorização: `roles.yaml` é lista de emails autorizados + flwchatToken. Sem papéis, sem `assertToolAllowed`. Qualquer email cadastrado tem acesso a todas as tools.
- Toda tool: prefixo `bucks_`, nome `snake_case`, descrições em português.
- Toda escrita: preview + `confirmed: true` para executar.
- Desambiguação obrigatória em escrita com múltiplos alvos. Máx 5 candidatos.
- Defaults globais por config: canal padrão, painel padrão.
- Consultas recentes: janela padrão 24h, limite 20 itens. Listagens gerais: 50 itens.
- Auto-paginação: `fetchAllPages` com `pageNumber`, máx 5 páginas. Novo `postAllPages` para endpoints POST.
- Retry com backoff exponencial apenas em leituras. Escritas não repetem silenciosamente.
- Timeout upstream: 60s.
- Deploy: Docker Swarm no VPS, EasyPanel, ngrok domínio fixo `bucks-mcp.ngrok.dev`.
- Logs estruturados (Pino). Healthcheck em `/health`.

### Módulos de domínio

| Módulo | Arquivo | Endpoints |
|--------|---------|-----------|
| client | `src/flwchat/client.ts` | Base HTTP, fetchAllPages, postAllPages |
| contacts | `src/flwchat/contacts.ts` | 10 endpoints |
| sessions | `src/flwchat/sessions.ts` | 14 endpoints |
| messages | `src/flwchat/messages.ts` | 4 endpoints (novo) |
| crm | `src/flwchat/crm.ts` | 8 endpoints |
| chatbots | `src/flwchat/chatbots.ts` | 2 endpoints |
| lookup | `src/flwchat/lookup.ts` | agents, departments, channels, tags, templates, custom-fields (novo) |
| portfolios | `src/flwchat/portfolios.ts` | 4 endpoints (novo) |
| sequences | `src/flwchat/sequences.ts` | 4 endpoints (novo) |

---

## Testing Decisions

- Testes validam comportamento externo, não detalhes internos.
- Foco: autenticação, confirmação, validação de entrada, desambiguação, paginação, contratos externos.
- BUG-01: `fetchAllPages` deve enviar `pageNumber`.
- BUG-03: `postAllPages` deve fazer POST com body imutável em cada página.
- Cada domain module: testes de contrato, mapeamento de campos, extração de resposta.
- Cada tool handler: schema correto, preview gerado, escrita só com `confirmed: true`.
- Testes de auth: email cadastrado → acesso. Email não cadastrado → 401.
- Testes de ações sensíveis: preview reforçado presente.
- Testes de paginação: `hasMorePages: true` → client itera; `false` → para.
- Integração end-to-end mínima: criar contato, responder sessão, enviar outbound, mover card, concluir atendimento, disparar chatbot.

---

## Out of Scope (v3+)

Os 33 endpoints 🔜 no Coverage Map:

- **Agentes CRUD** — criar, atualizar, deletar, mudar status, logout forçado, atualizar equipes
- **Equipes CRUD** — criar, atualizar, deletar, atualizar agentes
- **Webhooks CRUD** — subscrições, eventos
- **Mensagens agendadas** — criar, listar, atualizar, cancelar, batch cancel
- **Arquivos** — upload URL, salvar
- **OTP** — enviar, consultar status
- **Office hours** — consultar
- **Batch carteiras/sequências** — add/remove via filtro
- **Deletar mensagem**
- **Login externo** — backend only, não expor via MCP
- Relatórios dedicados — compostos pela LLM via tools de leitura
- Persistência local, cache durável, histórico próprio
- Painel administrativo do próprio MCP
- Múltiplos tenants com configuração dinâmica

---

## Further Notes

- BUG-01 é a correção de maior impacto e menor risco — uma linha em `client.ts`.
- Módulo `lookup` (agentes, equipes, canais, tags, templates, custom-fields) é somente-leitura, sem confirmação — alto valor imediato para eliminar necessidade de abrir a interface web.
- `bucks_send_chatbot`: bloqueia agentes na sessão. Exige preview reforçado.
- `bucks_batch_save_contacts`: preview com contagem antes de executar.
- Política de compliance para outbound é o principal risco operacional em aberto.
- Documento de Ubiquitous Language (`UBIQUITOUS_LANGUAGE.md`) é a fonte canônica de termos.
- Fonte canônica de endpoints: `flwchat_docs_everything.md` (93 endpoints).
