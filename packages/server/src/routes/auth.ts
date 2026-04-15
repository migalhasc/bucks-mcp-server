import { Router, Request, Response, IRouter } from "express";
import { createSession, createPermanentToken } from "../session-store.js";
import { assertRegisteredEmail, resolveFlwchatToken, RbacError } from "../rbac.js";
import { logger } from "../logger.js";

export const authRouter: IRouter = Router();

const ACTIVATION_PASSWORD = "Blank1234";

// ── Login page (fallback shown by LLM on 401) ─────────────────────────────────

authRouter.get("/login", (_req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(LOGIN_HTML);
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
// Accepts { email, password }. Token lookup is backend-only (roles.yaml).

authRouter.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email e password são obrigatórios." });
    return;
  }

  if (password !== ACTIVATION_PASSWORD) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }

  try {
    assertRegisteredEmail(email);
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(403).json({ error: `Acesso não autorizado para '${email}'. Contate o administrador.` });
      return;
    }
    throw err;
  }

  const flwchatToken = resolveFlwchatToken(email);
  if (!flwchatToken) {
    res.status(403).json({
      error: `Token FlwChat não configurado para '${email}'. Contate o administrador.`,
    });
    return;
  }

  const sessionToken = createSession(email, "user", flwchatToken);
  logger.info({ email }, "session created via login");

  res.json({ token: sessionToken, email, expiresIn: "8h" });
});

// ── POST /auth/token ──────────────────────────────────────────────────────────
// Generates a permanent (never-expiring) token. Persisted across restarts.

authRouter.post("/auth/token", async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email e password são obrigatórios." });
    return;
  }

  if (password !== ACTIVATION_PASSWORD) {
    res.status(401).json({ error: "Senha incorreta." });
    return;
  }

  try {
    assertRegisteredEmail(email);
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(403).json({ error: `Acesso não autorizado para '${email}'.` });
      return;
    }
    throw err;
  }

  const flwchatToken = resolveFlwchatToken(email);
  if (!flwchatToken) {
    res.status(403).json({ error: `Token FlwChat não configurado para '${email}'.` });
    return;
  }

  const permanentToken = createPermanentToken(email, "user", flwchatToken);
  logger.info({ email }, "permanent token created");

  res.json({ token: permanentToken, email, expiresIn: "never" });
});

// ── HTML ──────────────────────────────────────────────────────────────────────

const LOGIN_HTML = /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bucks MCP — Gerar token</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
      background: #0a0a0a;
      color: #ededed;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .container { width: 100%; max-width: 480px; }

    .logo { text-align: center; margin-bottom: 32px; }
    .logo-mark {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .logo-icon {
      width: 36px; height: 36px;
      background: #3ecf8e;
      border-radius: 8px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }

    .card {
      background: #111;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 32px;
    }

    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; letter-spacing: -0.3px; }
    .subtitle { font-size: 14px; color: #666; margin-bottom: 28px; }

    .field { margin-bottom: 18px; }
    label { display: block; font-size: 13px; font-weight: 500; color: #ccc; margin-bottom: 6px; }
    input {
      width: 100%; padding: 10px 12px;
      background: #0a0a0a; border: 1px solid #2a2a2a;
      border-radius: 8px; color: #fff; font-size: 14px;
      outline: none; transition: border-color 0.15s;
    }
    input::placeholder { color: #444; }
    input:focus { border-color: #3ecf8e; }

    .btn {
      width: 100%; padding: 11px;
      background: #3ecf8e; color: #0a0a0a;
      border: none; border-radius: 8px;
      font-size: 14px; font-weight: 600;
      cursor: pointer; margin-top: 8px;
      transition: background 0.15s, opacity 0.15s;
    }
    .btn:hover { background: #33b87a; }
    .btn:disabled { opacity: 0.55; cursor: not-allowed; }

    .alert {
      border-radius: 8px; padding: 12px 14px;
      font-size: 13px; margin-bottom: 18px; display: none;
    }
    .alert-error  { background: #1f0a0a; border: 1px solid #4a1515; color: #f87171; }
    .alert-success { background: #081a11; border: 1px solid #1a4a2e; color: #3ecf8e; }

    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 24px 0; }

    .result { display: none; }
    .section-label {
      font-size: 11px; font-weight: 600; color: #555;
      text-transform: uppercase; letter-spacing: 0.8px;
      margin-bottom: 8px;
    }

    .code-block {
      position: relative;
      background: #0a0a0a; border: 1px solid #222; border-radius: 8px;
      padding: 14px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
      font-size: 12px; color: #a8d8b8; line-height: 1.7;
      white-space: pre; overflow-x: auto;
      margin-bottom: 8px;
    }
    .code-block .key   { color: #79c0ff; }
    .code-block .str   { color: #a5d6a7; }
    .code-block .token-val { color: #3ecf8e; font-weight: 600; }
    .code-block .punc  { color: #666; }

    .copy-btn {
      position: absolute; top: 10px; right: 10px;
      padding: 4px 10px;
      background: #1a1a1a; color: #aaa;
      border: 1px solid #333; border-radius: 6px;
      font-size: 11px; font-weight: 500; cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .copy-btn:hover { background: #252525; color: #eee; }
    .copy-btn.copied { color: #3ecf8e; border-color: #2a5a3e; }

    .badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: #0d1a14; border: 1px solid #1a3326;
      border-radius: 20px; padding: 4px 10px;
      font-size: 11px; color: #3ecf8e; font-weight: 500;
      margin-bottom: 20px;
    }
    .badge-dot { width: 6px; height: 6px; background: #3ecf8e; border-radius: 50%; }

    .hint {
      font-size: 12px; color: #555; line-height: 1.6; margin-top: 6px;
    }

    .meta { font-size: 12px; color: #333; text-align: center; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">
      <div class="logo-mark">
        <div class="logo-icon">⚡</div>
        Bucks MCP
      </div>
    </div>

    <div class="card">
      <h1>Gerar token de acesso</h1>
      <p class="subtitle">Token permanente para integração com clientes LLM</p>

      <div class="alert alert-error" id="err"></div>

      <form id="form">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" placeholder="seu@email.com" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">Senha de ativação</label>
          <input id="password" type="password" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn" id="btn">Gerar token</button>
      </form>

      <div class="result" id="result">
        <div class="badge">
          <div class="badge-dot"></div>
          Token gerado — <span id="badge-email"></span> · <span id="badge-role"></span> · sem expiração
        </div>

        <div class="section-label">Configuração MCP (JSON)</div>
        <div class="code-block" id="json-block">
          <button class="copy-btn" id="copy-json-btn" onclick="copyJson()">Copiar</button>
          <span id="json-content"></span>
        </div>
        <p class="hint">Cole no seu <code style="color:#3ecf8e;font-size:11px;background:#111;padding:1px 5px;border-radius:4px">.mcp.json</code> ou nas configurações do cliente LLM (Claude Desktop, Cursor, etc.)</p>
      </div>
    </div>

    <p class="meta">Token permanente · Armazenado localmente no servidor · Não expira</p>
  </div>

  <script>
    let jsonText = '';

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.textContent = 'Gerando…';
      hide('err');

      try {
        const email = document.getElementById('email').value.trim();
        const r = await fetch('/auth/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: document.getElementById('password').value }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Erro desconhecido');

        const serverUrl = window.location.origin + '/mcp';
        const config = {
          mcpServers: {
            bucks: {
              type: 'http',
              url: serverUrl,
              headers: { Authorization: 'Bearer ' + data.token }
            }
          }
        };

        jsonText = JSON.stringify(config, null, 2);

        // Syntax-highlighted version
        const highlighted = jsonText
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"([^"]+)":/g, '<span class="key">"$1"</span>:')
          .replace(/: "([^"]*Bearer [^"]*)"/g, (_, v) => {
            const [prefix, token] = v.split('Bearer ');
            return ': <span class="str">"' + prefix + 'Bearer <span class="token-val">' + token + '</span>"</span>';
          })
          .replace(/: "([^"]+)"/g, ': <span class="str">"$1"</span>');

        document.getElementById('json-content').innerHTML = highlighted;
        document.getElementById('badge-email').textContent = email;
        document.getElementById('badge-role').textContent = data.role;
        document.getElementById('form').style.display = 'none';
        document.getElementById('result').style.display = 'block';
      } catch (err) {
        show('err', err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Gerar token';
      }
    });

    function show(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }
    function hide(id) { document.getElementById(id).style.display = 'none'; }

    function copyJson() {
      navigator.clipboard.writeText(jsonText).then(() => {
        const btn = document.getElementById('copy-json-btn');
        btn.textContent = 'Copiado!';
        btn.classList.add('copied');
        setTimeout(() => { btn.textContent = 'Copiar'; btn.classList.remove('copied'); }, 2000);
      });
    }
  </script>
</body>
</html>`;
