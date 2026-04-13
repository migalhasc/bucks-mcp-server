# PRD — bucks-mcp-server v1

Data: 2026-04-13
Status: Draft consolidado a partir da sessão de Q&A

## Problem Statement

O time da Blank School quer usar Claude, ChatGPT, Codex, Cursor e outros clientes compatíveis com MCP para consultar e operar o CRM/WhatsApp da FlwChat de forma natural, sem depender de uso direto da API ou de automações separadas. Hoje, a documentação da API existe, mas não há um MCP remoto padronizado, seguro e sempre ativo que traduza os pedidos do time em operações confiáveis sobre contatos, sessões, mensagens e cards do CRM.

O problema principal não é apenas integração técnica. O time precisa de uma camada operacional que permita fazer perguntas e alterações em linguagem natural com controle de acesso por pessoa, regras claras de confirmação antes de escrita, desambiguação segura quando houver múltiplos alvos possíveis, e compatibilidade ampla com clientes MCP remotos. Além disso, a solução precisa ser simples de operar no VPS atual, sem exigir banco de dados próprio, sem webhooks e sem uma interface administrativa paralela na primeira versão.

## Solution

Construir um servidor MCP remoto chamado `bucks-mcp-server`, baseado em TypeScript/Node.js e no SDK oficial do MCP, exposto por `Streamable HTTP`, implantado no VPS via EasyPanel e publicado inicialmente por `ngrok` no domínio `wts-mpc.ngrok.app`.

A v1 será stateless, sem banco próprio e sem webhooks. Cada usuário autenticará no MCP com sua própria conta via OAuth, enquanto o backend utilizará um token único de serviço da FlwChat para executar as operações permitidas. O comportamento do servidor será controlado por configuração em YAML e variáveis de ambiente no EasyPanel.

O escopo funcional da v1 será focado em quatro domínios de negócio: contatos, sessões, mensagens e cards do CRM. O servidor exporá tools específicas com prefixo `bucks_`, descrições em português, validação rigorosa de entrada, filtros ricos de leitura, paginação controlada, e um fluxo obrigatório de preview + confirmação explícita antes de toda escrita. Não haverá tool nativa de relatórios na v1; as LLMs usarão as tools de leitura para montar análises e relatórios sob demanda.

## User Stories

1. Como pessoa do time comercial, quero buscar um contato por telefone, para localizar rapidamente o lead correto.
2. Como pessoa do time comercial, quero pesquisar contatos por nome ou outros filtros disponíveis, para encontrar leads mesmo quando não tenho o identificador exato.
3. Como pessoa do time comercial, quero criar um novo contato com nome, telefone e origem inicial, para iniciar um fluxo comercial sem sair do cliente MCP.
4. Como pessoa do time comercial, quero atualizar dados de um contato existente, para manter o CRM consistente durante o atendimento.
5. Como pessoa do time comercial, quero aplicar etiquetas em contatos, para segmentar leads e organizar follow-ups.
6. Como pessoa do time comercial, quero consultar sessões existentes de um contato, para entender o histórico antes de responder.
7. Como pessoa do time comercial, quero responder uma sessão já existente, para continuar conversas ativas com contexto.
8. Como pessoa do time comercial, quero iniciar uma mensagem outbound para um contato novo ou já existente, para fazer prospecção e retomadas.
9. Como pessoa do time comercial, quero ver mensagens recentes, para acompanhar o que aconteceu nas últimas horas sem montar filtros complexos.
10. Como pessoa do time comercial, quero listar cards do CRM por painel e etapa, para visualizar oportunidades em aberto.
11. Como pessoa do time comercial, quero criar um card de oportunidade, para registrar novas negociações sem depender da interface web da plataforma.
12. Como pessoa do time comercial, quero mover um card entre etapas, para refletir avanço ou bloqueio no pipeline.
13. Como pessoa do time comercial, quero adicionar notas em cards, para registrar contexto comercial útil para o time.
14. Como pessoa de CS, quero consultar sessões, mensagens, contatos e cards, para enxergar o histórico completo do cliente.
15. Como pessoa de CS, quero responder uma sessão ativa, para continuar o atendimento dentro do contexto correto.
16. Como pessoa de CS, quero atribuir um atendimento a um usuário específico, para organizar ownership do caso.
17. Como pessoa de CS, quero transferir uma sessão entre equipes ou responsáveis, para encaminhar o atendimento corretamente.
18. Como pessoa de CS, quero alterar o status de uma sessão, para refletir o andamento operacional do atendimento.
19. Como pessoa de CS, quero concluir um atendimento, para sinalizar encerramento de forma explícita.
20. Como pessoa de CS, quero adicionar notas internas à sessão, para registrar contexto não visível ao cliente.
21. Como admin, quero ter acesso a todas as tools da v1, para apoiar operação, diagnóstico e exceções.
22. Como admin, quero que o servidor aplique regras diferentes para comercial, CS e admin, para reduzir risco operacional.
23. Como usuário autenticado, quero que o MCP me peça confirmação antes de qualquer escrita, para evitar mudanças acidentais.
24. Como usuário autenticado, quero ver um preview claro da ação antes de confirmar, para entender exatamente o impacto.
25. Como usuário autenticado, quero que ações sensíveis tenham confirmação reforçada, para reduzir risco em operações críticas.
26. Como usuário autenticado, quero que o MCP peça desambiguação quando houver vários contatos, sessões ou cards possíveis, para evitar que o alvo errado seja alterado.
27. Como usuário autenticado, quero receber até cinco candidatos quando houver ambiguidade, para conseguir decidir rápido sem excesso de ruído.
28. Como usuário autenticado, quero que consultas recentes usem um padrão útil, para não precisar informar datas toda vez.
29. Como usuário autenticado, quero que o MCP itere algumas páginas automaticamente em leituras amplas, para receber resultados melhores sem esforço extra.
30. Como usuário autenticado, quero que erros de autenticação, permissão e validação sejam claros e acionáveis, para corrigir o problema rapidamente.
31. Como usuário autenticado, quero que o MCP responda em português nas descrições, confirmações e mensagens de erro, para facilitar o uso pelo time.
32. Como usuário autenticado, quero que as tools tenham nomes técnicos consistentes, para melhorar a compatibilidade entre diferentes clientes MCP.
33. Como operação, quero que o servidor fique sempre ativo no VPS, para não depender de execução local por usuário.
34. Como operação, quero usar EasyPanel para deploy e segredos, para simplificar manutenção.
35. Como operação, quero expor o serviço por um endpoint remoto compatível com múltiplos clientes, para evitar lock-in em um único produto.
36. Como operação, quero que o servidor seja stateless, para simplificar deploy, restart e recuperação.
37. Como operação, quero centralizar o acesso à API da FlwChat em um client HTTP compartilhado, para padronizar autenticação, timeout, retry e tratamento de erro.
38. Como operação, quero logs estruturados, healthcheck e métricas básicas, para monitorar disponibilidade e comportamento do MCP.
39. Como produto, quero que a v1 seja focada em contatos, sessões, mensagens e CRM, para entregar valor rápido sem escopo excessivo.
40. Como produto, quero deixar relatórios como composição feita pela LLM, para evitar uma camada analítica própria na primeira versão.
41. Como produto, quero adiar uploads, mídia, exclusões e administração estrutural da conta, para reduzir complexidade inicial.
42. Como produto, quero manter um glossário compartilhado de termos de domínio, para reduzir ambiguidade entre time, PRD e implementação.

## Implementation Decisions

- O produto será um servidor MCP remoto chamado `bucks-mcp-server`.
- A linguagem principal será TypeScript, rodando em Node.js LTS.
- O SDK base será `@modelcontextprotocol/sdk`, usando APIs modernas de registro de tool.
- O transporte principal será `Streamable HTTP`.
- O servidor será stateless e não terá banco próprio na v1.
- A implantação será feita no VPS atual via EasyPanel.
- O endpoint público inicial usará `ngrok`, com o domínio `wts-mpc.ngrok.app`.
- A autenticação dos usuários no MCP seguirá um fluxo OAuth.
- O backend usará um token único de serviço da FlwChat para executar as chamadas upstream.
- As permissões serão controladas por RBAC interno ao MCP, usando configuração versionada em YAML.
- O mapeamento inicial de papéis será por e-mail.
- Os papéis da v1 serão `commercial`, `cs` e `admin`.
- O escopo funcional da v1 será limitado a `contacts`, `sessions`, `messages` e `crm_cards`.
- Não haverá tool nativa de `reports` na v1. Relatórios e análises serão compostos pela LLM a partir das tools de leitura.
- Não haverá suporte a webhooks na v1.
- Não haverá persistência histórica local na v1.
- Não haverá suporte a uploads/mídia na v1.
- Não haverá suporte a exclusões na v1.
- Não haverá suporte a envio síncrono de mensagens na v1.
- Não haverá suporte a administração estrutural da conta na v1, como usuários, departamentos e gerenciamento amplo da plataforma.
- Haverá leitura básica de campos customizados quando isso ajudar em leitura de contatos ou painéis, mas a edição avançada ficará fora da v1.
- Toda tool terá prefixo `bucks_` e nome técnico em inglês com `snake_case`.
- Descrições, mensagens de confirmação e mensagens de erro serão escritas em português.
- O servidor terá um módulo de configuração responsável por combinar YAML versionado com segredos e flags vindos do ambiente.
- O servidor terá um módulo de autenticação/OAuth separado da lógica de domínio.
- O servidor terá um módulo de autorização/RBAC responsável por decidir se uma tool pode ou não ser usada por determinado papel.
- O servidor terá um client HTTP central para FlwChat, responsável por autenticação Bearer, timeout, retry, paginação, normalização de erro e políticas de chamadas.
- Sobre esse client central existirão módulos de domínio separados para contatos, sessões, mensagens e cards do CRM.
- O servidor terá um módulo de confirmação que gera preview de escrita antes da execução.
- O preview de escrita mostrará ação, alvo, campos alterados, mensagem a enviar quando aplicável, canal/painel usado e impacto esperado.
- Toda confirmação valerá apenas para a próxima ação imediatamente relacionada.
- O servidor terá um módulo de desambiguação para leituras e escritas sobre contatos, sessões e cards.
- Em caso de ambiguidade em escrita, o MCP nunca deve escolher sozinho o alvo.
- Em caso de ambiguidade, o MCP deve retornar até 5 candidatos com identificadores úteis.
- Ações sensíveis com preview reforçado incluirão: outbound para contato novo, atualização de telefone, movimento de card para etapa final, conclusão de atendimento e transferência de sessão.
- Contatos novos poderão ser criados e usados no mesmo fluxo de outbound, desde que exista preview final e confirmação explícita.
- O cadastro mínimo de contato exigirá telefone válido em formato internacional, nome e origem ou tag inicial quando aplicável ao fluxo comercial.
- Haverá defaults globais em configuração do servidor para canal padrão e painel padrão.
- O prompt poderá indicar intenção de envio ou override explícito de canal/painel, mas o MCP assumirá defaults quando o pedido não especificar.
- Consultas “recentes” usarão janela padrão de 24 horas quando o usuário não informar período.
- Leituras recentes usarão limite padrão de 20 itens.
- Listagens gerais usarão limite padrão de 50 itens.
- Em leituras amplas, o MCP poderá iterar automaticamente múltiplas páginas até um limite seguro pequeno, desde que preserve `pageSize` constante.
- O MCP fará retry com backoff exponencial pequeno apenas em leituras e operações idempotentes.
- Escritas não serão repetidas silenciosamente após falha transitória.
- O teto de timeout por request upstream será de 60 segundos.
- O servidor retornará JSON estruturado quando isso ajudar a composição pela LLM, mas sem criar ferramentas analíticas dedicadas na v1.
- O servidor será orientado a compatibilidade ampla entre clientes MCP remotos, evitando dependências proprietárias de um único client.
- A imagem Docker usará base Node.js LTS slim, priorizando compatibilidade operacional.
- O processo Node rodará diretamente no container, sem process manager interno.
- Reinício automático e healthchecks serão delegados ao EasyPanel.
- Logs serão estruturados.
- Métricas básicas e healthcheck farão parte da fundação da v1.
- O documento de Ubiquitous Language deve acompanhar o PRD como fonte de termos canônicos do domínio.

## Testing Decisions

- Um bom teste deve validar comportamento externo observável, não detalhes internos de implementação.
- O foco dos testes deve estar em autorização, confirmação, validação de entrada, desambiguação, paginação e contratos externos do MCP.
- O módulo de configuração deve ser testado para garantir merge correto entre YAML e ambiente.
- O módulo de RBAC deve ser testado para garantir que cada papel tenha acesso apenas às tools e ações esperadas.
- O módulo de confirmação deve ser testado para garantir que nenhuma escrita execute sem preview e confirmação explícita.
- O módulo de desambiguação deve ser testado para garantir que escritas nunca prossigam quando houver múltiplos candidatos.
- O client central da FlwChat deve ser testado para timeout, retry em leitura, tratamento de 429 e normalização de erros.
- Os módulos de domínio de contatos, sessões, mensagens e CRM devem ser testados em torno de contratos externos e transformação de dados.
- Os handlers de tools devem ser testados para garantir descrição funcional correta, validação de schema e respostas compatíveis com o protocolo MCP.
- Deve haver testes de integração cobrindo o fluxo end-to-end de algumas tools críticas, especialmente:
  - criar contato
  - responder sessão
  - enviar outbound
  - mover card
  - concluir atendimento
- Deve haver testes de papel para cenários positivos e negativos, por exemplo:
  - comercial pode responder sessão
  - comercial não pode concluir atendimento
  - CS pode transferir sessão
  - admin pode usar todas as tools da v1
- Deve haver testes de ações sensíveis para garantir preview reforçado.
- Deve haver testes para os limites padrão de listagem, recência e paginação automática.
- Como o repositório atual está vazio, não há prior art local a seguir. O plano de testes precisará ser definido a partir de padrões novos do projeto.

## Out of Scope

- Ferramentas de relatório dedicadas na v1.
- Persistência local, warehouse, cache durável ou histórico próprio.
- Webhooks e processamento orientado a eventos.
- Upload de arquivos, mídia e anexos.
- Envio síncrono de mensagens.
- Exclusões de qualquer entidade.
- Administração estrutural da conta, incluindo usuários, departamentos e configuração ampla da plataforma.
- Painel administrativo do próprio MCP.
- Banco de dados próprio.
- Edição avançada de campos customizados.
- Integração com múltiplos tenants com configuração dinâmica via interface.
- Compatibilidade com recursos proprietários de clientes específicos.
- Automação proativa e jobs agendados.

## Further Notes

- Este PRD consolida as decisões tomadas durante a sessão de discovery e Q&A.
- O projeto depende da documentação local da FlwChat já disponível na pasta do repositório.
- A Blank School deve manter um documento de Ubiquitous Language em paralelo ao PRD para padronizar termos entre negócio, LLM e implementação.
- A principal decisão de risco ainda aberta para operação real é a política comercial e de compliance para outbound, já que a v1 permitirá criar contatos novos e iniciar mensagens a partir do MCP.
- Como o servidor será usado por Comercial e CS em linguagem natural, clareza de preview, confirmação e mensagens de erro é parte do produto, não só detalhe técnico.
