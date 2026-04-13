# QA Plan — Bucks MCP Server v1

Gerado após Fase 5 (AFK Agent). Cobre os 42 user stories do PRD.

---

## Estratégia

- Testar **comportamento observável**, não internos
- Cada teste representa um contrato visível ao cliente MCP
- Foco em: autorização, confirmação, validação, desambiguação, paginação
- Idioma de assertions: português (mensagens de erro/preview são em PT-BR)

---

## 1. Testes de Módulo

### 1.1 Config & Defaults

| Cenário | Esperado |
|---------|----------|
| `canal_padrao` ausente, request sem canal | Erro claro: canal obrigatório |
| `canal_padrao` definido, request sem canal | Usa default global |
| `painel_padrao` definido, request sem painel | Usa default global |
| Limite `recent` ausente no config | Usa 24h |
| Limite de itens ausente | Usa 20 (recent) / 50 (geral) |

### 1.2 RBAC

| Role | Tool | Esperado |
|------|------|----------|
| `commercial` | `bucks_buscar_contato` | ✅ permitido |
| `commercial` | `bucks_transferir_sessao` | ❌ negado |
| `cs` | `bucks_mover_card` | ❌ negado |
| `cs` | `bucks_responder_sessao` | ✅ permitido |
| `admin` | qualquer tool | ✅ permitido |
| sem role mapeada | qualquer tool | ❌ negado (erro de autorização) |

### 1.3 Preview & Confirmação

| Cenário | Esperado |
|---------|----------|
| Escrita sem preview prévio | Preview retornado, escrita bloqueada |
| Preview + confirmação correta | Escrita executada |
| Preview + confirmação errada/ausente | Escrita bloqueada, erro claro |
| Confirmação reutilizada em ação diferente | Bloqueada (confirmação vinculada à ação anterior) |
| Ação sensível (ex: outbound) | Preview com aviso de ação sensível |

### 1.4 Desambiguação

| Cenário | Esperado |
|---------|----------|
| 0 candidatos encontrados | Erro "não encontrado" |
| 1 candidato exato | Prossegue sem desambiguação |
| 2–5 candidatos | Lista candidatos, aguarda seleção |
| 6+ candidatos | Solicita refinamento da busca (não lista todos) |
| Seleção inválida do candidato | Erro + lista novamente |

---

## 2. Testes de Fluxo (Integração)

### 2.1 Criar Contato

```
commercial → bucks_criar_contato(nome, telefone)
  → preview mostrado
  → confirmação enviada
  → contato criado no FlwChat
  → ID retornado
```

Casos de erro:
- Telefone inválido → validação antes do preview
- Telefone duplicado → desambiguação com contato existente
- FlwChat API timeout → erro 504 mapeado para mensagem PT-BR

### 2.2 Responder Sessão

```
cs → bucks_responder_sessao(sessao_id, mensagem)
  → preview: "Enviar '[mensagem]' para sessão #ID"
  → confirmação
  → mensagem enviada
```

Casos de erro:
- Sessão encerrada → erro "sessão não está ativa"
- Sessão não pertence ao usuário (CS sem permissão de acesso à sessão) → negado

### 2.3 Enviar Outbound

```
commercial → bucks_enviar_outbound(contato_id, mensagem, canal?)
  → preview com aviso de ação sensível
  → confirmação
  → mensagem enviada via canal correto
```

Casos de erro:
- Canal inválido → erro antes do preview
- Contato sem WhatsApp → erro mapeado do FlwChat

### 2.4 Mover Card

```
commercial → bucks_mover_card(card_id, etapa_destino)
  → preview: "Mover card #ID de '[etapa_atual]' para '[etapa_destino]'"
  → confirmação
  → card movido
```

Casos de erro:
- Etapa destino inválida → desambiguação com etapas existentes
- Card não pertence ao painel do usuário → negado

### 2.5 Concluir Sessão

```
cs → bucks_concluir_sessao(sessao_id)
  → preview: ação sensível
  → confirmação
  → sessão encerrada
```

---

## 3. Testes por Role (Cenários Positivos/Negativos)

### Commercial

| Ação | Resultado |
|------|-----------|
| Buscar contato por nome | ✅ lista até 50 |
| Criar contato | ✅ com preview |
| Atualizar contato | ✅ com preview |
| Enviar outbound | ✅ ação sensível |
| Mover card | ✅ com preview |
| Responder sessão | ❌ negado |
| Transferir sessão | ❌ negado |
| Adicionar nota interna | ❌ negado |

### CS

| Ação | Resultado |
|------|-----------|
| Ver histórico da sessão | ✅ |
| Responder sessão | ✅ com preview |
| Adicionar nota interna | ✅ com preview |
| Transferir sessão | ✅ com preview |
| Concluir sessão | ✅ ação sensível |
| Criar contato | ❌ negado |
| Mover card | ❌ negado |
| Enviar outbound | ❌ negado |

### Admin

| Ação | Resultado |
|------|-----------|
| Todas as tools acima | ✅ permitido |

---

## 4. Testes de Paginação

| Cenário | Esperado |
|---------|----------|
| Query retorna >50 itens | Primeira página com `nextPage` token |
| Query com `limit` explícito | Respeita o limite, retorna token se houver mais |
| Paginação automática em safe-reads | Itera até coletar tudo (sem loop infinito) |
| `nextPage` inválido | Erro mapeado |

---

## 5. Testes de Segurança

| Cenário | Esperado |
|---------|----------|
| OAuth token ausente/expirado | 401 mapeado para PT-BR |
| Token de serviço inválido | 401/403 do FlwChat → erro claro |
| Email sem role mapeada | Acesso negado em qualquer tool |
| CS tentando tool de commercial via JSON direto | RBAC bloqueia antes de chamar FlwChat |

---

## 6. Testes de Timeout & Resiliência

| Cenário | Esperado |
|---------|----------|
| FlwChat demora >60s | Timeout com mensagem PT-BR |
| FlwChat retorna 500 | Erro mapeado, não expõe stack trace |
| Rate limit (429) | Mensagem de tentativa mais tarde |

---

## 7. Stack de Testes

```
Vitest (unit + integration)
├── tests/unit/
│   ├── config.test.ts          # defaults, YAML loading
│   ├── rbac.test.ts            # role/tool matrix
│   ├── confirmation.test.ts    # preview + confirm flow
│   └── disambiguation.test.ts  # candidatos, seleção
└── tests/integration/
    ├── contacts.test.ts        # criar, buscar, atualizar
    ├── sessions.test.ts        # responder, transferir, concluir
    ├── messages.test.ts        # outbound, nota interna
    └── cards.test.ts           # mover card, etapas
```

FlwChat API mockada com `msw` (Mock Service Worker) nos testes de integração.

---

## 8. Critérios de Done

- [ ] Cobertura de todas as tools listadas no PRD
- [ ] Todos os cenários de RBAC (positivo + negativo) cobertos
- [ ] Preview + confirmação testados para cada tool de escrita
- [ ] Desambiguação testada: 0, 1, 2–5, 6+ candidatos
- [ ] Timeout e erros do FlwChat mapeados em PT-BR
- [ ] CI verde (typecheck + lint + test) em cada commit do Ralph

---

## 9. Não está no escopo (v1)

- Webhooks
- Uploads
- Deletes (contato, card, sessão)
- Sync de mensagens
- Admin de conta (usuários, canais)
- Campos customizados
- Relatórios
