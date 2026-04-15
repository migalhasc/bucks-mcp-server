# mcp-bucks

## Ambientes

- **Local**: `/Users/miguelcrasto/development/mcp-bucks`
- **GitHub**: `https://github.com/migalhasc/bucks-mcp-server` — push via conta `migalhasc`
  - `git push https://$(gh auth token)@github.com/migalhasc/bucks-mcp-server.git main`
- **VPS**: `root@31.97.243.51` | senha: `sI4D9H,R/Y96xZV)Cjw)` | repo em `/opt/bucks-mcp`

## Infra VPS

- Docker swarm: container `bucks_bucks-mcp`
- Build: `cd /opt/bucks-mcp/packages/server && docker build -t bucks-mcp:latest .`
- Deploy: `docker service update --image bucks-mcp:latest --force bucks_bucks-mcp`
- URL pública: `https://bucks-mcp.ngrok.dev/mcp`

## MCP local (.mcp.json)

- Token admin: `2a1a750338a9237d0d65afc0de16535c59cbc8f638912745effd47eeb41a0eed`

## Workflow

**Source of truth: VPS.**
1. Criar branch `miguel/<feat>`
2. Testar no VPS
3. Merge em `main` se OK
4. Sincronizar local + remote + VPS

## Regras

- **Não alterar código sem a palavra BANANA.**
- Sincronizar os 3 ambientes após cada merge.

## Estado atual

- Último commit: `d889a1c` — sincronizado nos 3 ambientes
