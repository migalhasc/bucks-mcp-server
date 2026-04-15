# Ubiquitous Language — bucks-mcp-server

---

## Plataforma e infraestrutura

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **FlwChat** | Plataforma SaaS de CRM e atendimento via WhatsApp (também chamada WTS), cujos dados o MCP expõe. | WTS, wts.chat |
| **MCP** | Servidor remoto que traduz linguagem natural em operações sobre a FlwChat via protocolo Model Context Protocol. | bucks-mcp, servidor, API própria |
| **Tool** | Função individual exposta pelo MCP, prefixada `bucks_`, que o cliente LLM pode invocar. | comando, endpoint MCP, função |
| **Cliente LLM** | Aplicação que consome o MCP (Claude Code, Claude Desktop, Cursor, etc.). | cliente, app, front |
| **Token de serviço** | Credencial FlwChat (`pn_…`) usada pelo backend do MCP para todas as chamadas upstream. | chave de API, service key |
| **Token permanente** | Credencial MCP gerada por email/senha em `/login`, sem expiração, usada pelo cliente LLM no header `Authorization`. | token de acesso, bearer |
| **`roles.yaml`** | Arquivo de configuração que lista emails autorizados a usar o MCP e seus tokens FlwChat associados. Não define papéis ou restrições de tools. | RBAC config, permissões |

---

## Pessoas e acesso

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Usuário** | Pessoa do time Blank School com email cadastrado em `roles.yaml`, com acesso irrestrito a todas as tools. | agente MCP, operador, role |
| **Agente** | Usuário humano cadastrado na FlwChat, responsável por atender sessões. Retornado por `GET /core/v1/agent`. | atendente, operador (no contexto FlwChat) |
| **Email autorizado** | Email listado em `roles.yaml` — único critério de acesso ao MCP. | role, papel, permissão |

---

## Contatos

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Contato** | Pessoa física ou empresa cadastrada na FlwChat com telefone, nome e metadados. | lead (evitar como substituto geral), cliente |
| **Lead** | Contato em fase de prospecção comercial ativa. Subconjunto de Contato, não sinônimo. | contato (quando se quer dizer lead especificamente) |
| **Etiqueta** | Tag associada a um contato para segmentação e filtros. Retornada por `GET /core/v1/tag`. | tag, label |
| **Campo customizado** | Atributo adicional definido pela conta FlwChat para contatos ou cards, além dos campos padrão. | custom field, campo extra |

---

## Sessões e mensagens

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Sessão** | Conversa ativa ou histórica entre um contato e a equipe, num canal específico. Identificada por ID. | atendimento (quando se refere à entidade técnica), chat |
| **Atendimento** | Sinônimo aceitável de Sessão no contexto de CS e operação. | conversa (ambíguo) |
| **Mensagem** | Unidade de comunicação dentro de uma sessão, de entrada ou saída. | texto, chat, envio |
| **Mensagem outbound** | Mensagem iniciada pelo time para um contato fora de uma sessão ativa, enviada via `POST /chat/v1/message/send`. | disparo, proativo |
| **Resposta de sessão** | Mensagem enviada dentro de uma sessão existente via `POST /chat/v1/session/{id}/message`. | reply, resposta |
| **Nota interna** | Anotação visível apenas para a equipe, não enviada ao contato, associada a uma sessão ou card. | observação, comentário interno |
| **Canal** | Integração de canal de comunicação configurada na FlwChat (ex: WhatsApp, Instagram). Retornado por `GET /chat/v1/channel`. | integração, número |
| **Envio assíncrono** | Envio de mensagem enfileirado — retorna imediatamente, status consultado depois via `bucks_get_message_status`. | send, envio padrão |
| **Envio síncrono** | Envio que aguarda confirmação do canal por até 25s antes de retornar. | send-sync, sync send |

---

## Chatbots e automações

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Chatbot** | Fluxo automatizado de atendimento configurado na FlwChat, disparável via API. Listado por `GET /chat/v1/chatbot`. | bot, automação (quando se refere especificamente ao chatbot FlwChat) |
| **Disparo de chatbot** | Ação de iniciar a execução de um chatbot numa sessão via `POST /chat/v1/chatbot/send`. Bloqueia interação de agentes durante a execução. | ativar bot, rodar automação |
| **Sequência** | Cadência de mensagens programadas associadas a contatos, configurada na FlwChat. Listada por `GET /chat/v1/sequence`. | drip, cadência, automação (evitar como sinônimo geral) |
| **Template** | Modelo de mensagem aprovado pelo canal (ex: WhatsApp Business), necessário para outbound fora da janela de 24h. Listado por `GET /chat/v1/template`. | modelo, mensagem pré-aprovada |

---

## CRM

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Painel** | Board do CRM FlwChat que contém etapas e cards. Retornado por `GET /crm/v1/panel`. | board, funil, pipeline (como substituto da entidade) |
| **Etapa** | Coluna dentro de um painel, representando um estágio do pipeline. Identificada por `stageId` (internamente) / `stepId` (API FlwChat). | stage, coluna, passo |
| **Card** | Oportunidade ou negociação registrada num painel, associada a contato, etapa e responsável. | deal, oportunidade (quando se refere à entidade técnica) |
| **Carteira** | Agrupamento de contatos por responsável comercial na FlwChat. Listada por `GET /core/v1/portfolio`. | portfólio, carteira de clientes |

---

## Operação do MCP

| Termo | Definição | Aliases a evitar |
|-------|-----------|-----------------|
| **Preview** | Resposta descritiva retornada por uma tool de escrita quando chamada sem `confirmed: true`. Mostra o que será feito antes de executar. | dry-run, simulação |
| **Confirmação** | Segunda chamada com `confirmed: true` que executa a escrita após o preview ser aceito. | confirmar, ok, executar |
| **Ação sensível** | Escrita com impacto elevado ou irreversível que exige preview reforçado (ex: disparo de chatbot, batch de contatos, remoção de sequência). | ação crítica, operação perigosa |
| **Desambiguação** | Retorno de até 5 candidatos quando uma busca retorna múltiplos alvos possíveis para uma escrita, impedindo que o MCP escolha sozinho. | resolução de conflito, seleção |
| **Paginação** | Iteração automática de páginas pelo MCP usando `pageNumber` + `pageSize`, limitada a 5 páginas por chamada. | cursor, offset, scroll |
| **`pageNumber`** | Parâmetro de paginação esperado pela API FlwChat (1-based). Diferente de `page` — usar `pageNumber`. | page, offset |
| **Equipe** | Departamento configurado na FlwChat, usado para transferências de sessão. Retornado por `GET /core/v2/department`. | departamento, time, squad |

---

## Mapeamento de campos (FlwChat API)

Campos cujos nomes diferem entre o código interno e a API FlwChat:

| Campo interno | Campo na API FlwChat | Contexto |
|---------------|---------------------|----------|
| `stageId` | `stepId` | Criação e atualização de card |
| `agentId` | `responsibleUserId` | Card |
| `contactId` | `contactIds` (array) | Card |
| `value` | `monetaryAmount` | Card |
| `tags` | `tagIds` | Card |
| `customFields` | `customFieldValues` | Card |

---

## Relacionamentos

- Um **Contato** pode ter zero ou mais **Sessões**.
- Uma **Sessão** pertence a exatamente um **Contato** e um **Canal**.
- Um **Card** pertence a exatamente um **Painel** e uma **Etapa**.
- Um **Card** pode estar associado a um **Contato** e a um **Agente** responsável.
- Um **Chatbot** é disparado numa **Sessão** — bloqueia agentes enquanto executa.
- Uma **Sequência** contém zero ou mais **Contatos**.
- Uma **Carteira** contém zero ou mais **Contatos**.
- Um **Email autorizado** em `roles.yaml` tem acesso a todas as **Tools** do MCP.

---

## Exemplo de diálogo

> **Dev:** "O usuário pediu pra 'mandar mensagem pro Pedro'. Como o MCP trata isso?"

> **Domínio:** "Primeiro faz **desambiguação** — busca contatos com esse nome e retorna até 5 candidatos. Se houver só um Pedro, vai direto pro **preview**."

> **Dev:** "E se Pedro não tiver **sessão** ativa?"

> **Domínio:** "Aí é **mensagem outbound**. Precisa de **template** aprovado se a janela de 24h expirou. O MCP mostra o **preview** com canal e template antes de executar."

> **Dev:** "Se o usuário quiser disparar um **chatbot** no Pedro depois disso?"

> **Domínio:** "É uma **ação sensível** — o **disparo de chatbot** bloqueia os **agentes** da **sessão** durante a execução. O MCP sempre pede **confirmação** reforçada antes."

> **Dev:** "O card do Pedro no painel de vendas usa `stageId` ou `stepId`?"

> **Domínio:** "Internamente sempre `stageId`. A API FlwChat recebe `stepId` — o domain module faz o mapeamento automaticamente. O **usuário** nunca vê essa distinção."

---

## Ambiguidades identificadas

- **"automação"** foi usada para **Chatbot** e para **Sequência** — são entidades distintas. Usar o termo específico.
- **"agente"** pode significar o **Agente FlwChat** (atendente humano) ou um **agente de IA** (LLM). No contexto deste projeto, **Agente** sempre se refere ao humano na FlwChat.
- **"role"** foi eliminado como conceito operacional. `roles.yaml` mantém o nome do arquivo por compatibilidade, mas não define papéis — define **emails autorizados**.
- **"envio"** é ambíguo entre **envio assíncrono** (padrão) e **envio síncrono** (`-sync`). Especificar sempre quando a distinção importar.
- **"board"** e **"painel"** coexistem no código (`bucks_list_boards` vs. domain term **Painel**). O nome da tool usa "board" por legado; o vocabulário canônico é **Painel**.
