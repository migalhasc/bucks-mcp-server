# Política de Outbound Comercial — bucks-mcp-server v1

Data: 2026-04-13
Status: Aprovada

## Objetivo

Definir as regras operacionais para criação de contatos e envio de mensagens outbound via MCP na v1, garantindo elegibilidade comercial, bloqueios de risco e confirmação reforçada.

## Papéis autorizados

Apenas os papéis `commercial` e `admin` podem executar operações de outbound. O papel `cs` **não** está autorizado a iniciar outbound na v1.

## Elegibilidade para outbound

Para iniciar uma mensagem outbound, **todos** os critérios abaixo devem ser atendidos:

1. **Contato identificado**: o contato deve existir no CRM ou ser criado no mesmo fluxo.
2. **Telefone válido**: formato internacional obrigatório (ex: `+5511999999999`). Números incompletos ou sem código de país são bloqueados.
3. **Canal definido**: o canal de envio deve ser o padrão global ou explicitamente informado pelo usuário.
4. **Confirmação explícita**: o usuário deve confirmar com `confirmed: true` após ver o preview.

## Cadastro mínimo para contato novo

Ao criar um contato para outbound no mesmo fluxo, são obrigatórios:

| Campo | Obrigatoriedade | Observação |
|-------|----------------|------------|
| `phone` | **Obrigatório** | Formato internacional |
| `name` | **Obrigatório** | Nome completo ou parcial |
| `origin` | **Obrigatório** | Origem do lead (ex: indicação, evento, inbound) |

Tags adicionais são opcionais mas recomendadas.

## Situações bloqueadas

O servidor deve **recusar** outbound nas seguintes condições:

| Condição | Mensagem de bloqueio |
|----------|----------------------|
| Telefone em formato inválido | "Telefone inválido. Use formato internacional: +5511999999999." |
| Canal não identificado e sem padrão global configurado | "Canal de envio não definido. Configure o canal padrão ou informe explicitamente." |
| Papel `cs` tentando outbound | "Permissão negada: o papel 'cs' não pode iniciar outbound." |
| `confirmed` ausente ou `false` | Preview obrigatório. Solicitar confirmação antes de prosseguir. |
| Múltiplos contatos com mesmo telefone | Desambiguação obrigatória. Retornar candidatos para escolha. |

## Preview e confirmação

### Preview padrão (outbound para contato existente)

```
📋 Prévia da ação — confirme antes de prosseguir

Ação: Enviar mensagem outbound
Alvo: [Nome] ([telefone])
Canal: [nome do canal]
Mensagem: "[texto da mensagem]"
```

### Preview reforçado (contato novo + outbound)

```
📋 Prévia da ação — confirme antes de prosseguir

⚠️ Atenção: Esta ação criará um contato NOVO e enviará uma mensagem outbound.

Ação: Criar contato + enviar mensagem outbound
Alvo: [Nome] ([telefone]) — CONTATO NOVO
Origem: [origem]
Canal: [nome do canal]
Mensagem: "[texto da mensagem]"

Esta é uma ação sensível. Verifique os dados antes de confirmar.
```

### Confirmação

Toda confirmação vale apenas para a próxima ação imediatamente relacionada. Chamar novamente a tool sem `confirmed: true` gera novo preview.

## Defaults globais

| Parâmetro | Default | Override |
|-----------|---------|---------|
| Canal | `DEFAULT_CHANNEL` (config) | Campo `channel` na tool |
| Mensagem | Nenhum — obrigatório | N/A |

## Regras para o MCP

- O MCP **nunca** envia mensagem outbound sem preview e `confirmed: true`.
- O MCP **nunca** escolhe o contato automaticamente em caso de ambiguidade.
- O MCP **nunca** cria contato sem os campos mínimos.
- O MCP exibe preview reforçado sempre que o contato for novo.
- O MCP usa o canal padrão configurado quando o usuário não especificar.
- O MCP retorna até 5 candidatos em caso de desambiguação.
