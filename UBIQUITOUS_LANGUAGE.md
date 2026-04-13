# Ubiquitous Language

## Core domain

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Bucks** | O produto interno que expõe o acesso ao CRM/WhatsApp via MCP para o time da Blank School. | Projeto, integração |
| **FlwChat** | A plataforma upstream de CRM e WhatsApp cuja API é usada pelo Bucks. | Bucks, CRM |
| **CRM** | O conjunto de dados e fluxos comerciais/atendimento operados sobre contatos, sessões e cards na FlwChat. | Sistema, plataforma |
| **MCP remoto** | O servidor remoto compatível com clientes MCP que intermedeia comandos do LLM para a FlwChat. | Bot, plugin |
| **Cliente MCP** | A aplicação usada pela pessoa do time para conversar com o MCP, como Claude ou ChatGPT. | App, chat |
| **LLM** | O modelo que interpreta a intenção do usuário e decide quais tools MCP chamar. | IA, assistente |

## People and access

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Usuário** | A identidade autenticada no MCP por OAuth. | Conta, login |
| **Admin** | O usuário com acesso a todas as tools da v1. | Superusuário |
| **Commercial** | O papel focado em prospecção, follow-up, contatos, sessões e cards comerciais. | Vendas, SDR |
| **CS** | O papel focado em atendimento, continuidade operacional e fechamento de sessões. | Suporte, atendimento |
| **RBAC** | O conjunto de regras que define quais ações cada papel pode executar no MCP. | Permissão simples |
| **Token de serviço** | O token único de backend usado pelo MCP para falar com a API da FlwChat. | Token do usuário |

## Contacts and conversations

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Contato** | A pessoa cadastrada no CRM com telefone e dados de identificação. | Lead, cliente, usuário |
| **Lead** | Um contato em contexto comercial antes de qualificação ou avanço no pipeline. | Contato, card |
| **Sessão** | A conversa operacional existente entre um contato e a operação na FlwChat. | Atendimento, ticket, chat |
| **Mensagem** | Um item individual trocado dentro de uma sessão ou disparado via canal. | Interação |
| **Mensagem outbound** | Uma mensagem iniciada ativamente pela equipe para um contato. | Disparo, campanha |
| **Resposta de sessão** | Uma mensagem enviada dentro de uma sessão já existente. | Outbound |
| **Nota interna** | Um registro textual interno vinculado a uma sessão e não visível ao contato. | Observação |
| **Mensagem recente** | Uma mensagem retornada por consulta com janela temporal curta, por padrão últimas 24 horas. | Última mensagem |

## Channels and CRM pipeline

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Canal** | O número ou origem operacional usada para comunicação via WhatsApp. | Conta, linha |
| **Canal padrão** | O canal global assumido pelo MCP quando o pedido não especifica um canal. | Canal principal |
| **Painel** | O board do CRM que organiza cards por etapas. | Pipeline, quadro |
| **Card** | O registro comercial ou operacional que representa uma oportunidade ou item do pipeline. | Lead, oportunidade |
| **Etapa** | A coluna ou status de avanço de um card dentro de um painel. | Fase, estágio |
| **Painel padrão** | O painel global assumido pelo MCP quando o pedido não especifica um painel. | Pipeline principal |
| **Etiqueta** | Um marcador aplicado a um contato para segmentação e operação. | Tag, label |
| **Origem** | O campo inicial que indica de onde o contato ou lead veio. | Source, proveniência |

## Operational safeguards

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Preview de escrita** | A prévia estruturada da mudança que o MCP mostra antes de executar uma escrita. | Simulação, resumo |
| **Confirmação explícita** | A autorização textual imediata necessária para executar a próxima escrita previewada. | OK implícito |
| **Ação sensível** | Uma escrita com risco operacional maior que exige preview mais explícito. | Ação crítica |
| **Desambiguação** | O passo em que o MCP apresenta candidatos quando não há alvo único suficiente para escrita. | Tentativa automática |
| **Consulta recente** | Uma leitura com janela padrão curta e limite menor de itens. | Busca rápida |
| **Default global** | A configuração comum do servidor usada quando o pedido não informa canal, painel ou outros parâmetros opcionais. | Padrão implícito |

## Relationships

- Um **Usuário** autentica no **MCP remoto** e opera segundo um papel de **RBAC**.
- O **MCP remoto** usa um **Token de serviço** para falar com a **FlwChat**.
- Um **Contato** pode ter zero ou mais **Sessões**.
- Uma **Sessão** contém zero ou mais **Mensagens** e zero ou mais **Notas internas**.
- Uma **Mensagem outbound** pode iniciar uma **Sessão** nova ou ocorrer fora de uma sessão prévia, dependendo do fluxo aceito pela FlwChat.
- Uma **Resposta de sessão** sempre pertence a exatamente uma **Sessão**.
- Um **Card** pertence a exatamente um **Painel**.
- Um **Card** ocupa exatamente uma **Etapa** por vez dentro de um **Painel**.
- Um **Contato** pode estar associado a zero ou mais **Cards**, conforme o fluxo de CRM adotado.
- Um **Canal padrão** e um **Painel padrão** são **Defaults globais** do servidor.
- Toda escrita exige **Preview de escrita** seguido de **Confirmação explícita**.
- Toda **Ação sensível** exige uma versão reforçada de **Preview de escrita**.

## Example dialogue

> **Dev:** "Quando o comercial pede para falar com um lead novo, eu devo criar um **Card** primeiro ou um **Contato**?"

> **Domain expert:** "Primeiro um **Contato**. O **Card** representa a oportunidade no **Painel**, mas a comunicação sempre parte de um **Contato**."

> **Dev:** "E se já existir uma **Sessão** aberta com esse **Contato**, isso ainda é **Mensagem outbound**?"

> **Domain expert:** "Não. Aí é **Resposta de sessão**. **Mensagem outbound** é quando a equipe inicia o envio."

> **Dev:** "Se houver dois contatos com nomes parecidos, o MCP escolhe um sozinho?"

> **Domain expert:** "Nunca para escrita. Ele deve abrir **Desambiguação** e pedir **Confirmação explícita** só depois do alvo certo."

## Flagged ambiguities

- "**Bucks**" e "**FlwChat**" apareceram como se fossem o mesmo sistema. Recomendação: usar **Bucks** para o produto interno/MCP e **FlwChat** para a plataforma upstream.
- "**Sessão**" e "**Atendimento**" foram usados quase como sinônimos. Recomendação: padronizar **Sessão** como termo canônico do domínio e reservar “atendimento” para linguagem mais informal.
- "**Contato**", "**Lead**" e "**Card**" podem ser confundidos. Recomendação: **Contato** é a pessoa cadastrada, **Lead** é o contexto comercial desse contato, e **Card** é o registro do pipeline.
- "**Mensagem outbound**" e "**Resposta de sessão**" não devem ser misturados. Recomendação: usar **Mensagem outbound** para envio iniciado pela equipe e **Resposta de sessão** para continuidade de conversa existente.
- "**Usuário**" e "**Contato**" representam entidades diferentes. Recomendação: **Usuário** é quem autentica no MCP; **Contato** é a pessoa do CRM/WhatsApp.
