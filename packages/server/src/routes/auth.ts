import { Router, Request, Response, IRouter } from "express";
import { createSession } from "../session-store.js";
import { resolveRole, resolveFlwchatToken, RbacError } from "../rbac.js";
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

  let role: string;
  try {
    role = resolveRole(email);
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

  const sessionToken = createSession(email, role, flwchatToken);
  logger.info({ email, role }, "session created via login");

  res.json({ token: sessionToken, email, role, expiresIn: "8h" });
});

// ── HTML ──────────────────────────────────────────────────────────────────────

const LOGIN_HTML = /* html */`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Bucks MCP — Entrar</title>
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

    .container { width: 100%; max-width: 400px; }

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

    .result { display: none; margin-top: 24px; }
    .result-label { font-size: 12px; color: #555; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
    .token-box {
      background: #0a0a0a; border: 1px solid #222; border-radius: 8px;
      padding: 14px; font-family: 'SF Mono', 'Fira Code', monospace;
      font-size: 12px; color: #3ecf8e; word-break: break-all; line-height: 1.5;
    }
    .copy-row { display: flex; gap: 8px; margin-top: 10px; }
    .btn-sm {
      flex: 1; padding: 8px;
      background: #1a1a1a; color: #ccc;
      border: 1px solid #2a2a2a; border-radius: 8px;
      font-size: 12px; font-weight: 500; cursor: pointer;
      transition: background 0.15s;
    }
    .btn-sm:hover { background: #222; }

    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 24px 0; }
    .meta { font-size: 12px; color: #444; text-align: center; margin-top: 20px; }

    .instruction {
      background: #0d1a14;
      border: 1px solid #1a3326;
      border-radius: 8px;
      padding: 14px;
      font-size: 13px;
      color: #7fcfaa;
      margin-top: 20px;
      line-height: 1.6;
      display: none;
    }
    .instruction code {
      background: #0a0a0a;
      border: 1px solid #222;
      border-radius: 4px;
      padding: 2px 6px;
      font-family: monospace;
      font-size: 12px;
      color: #3ecf8e;
    }
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
      <h1>Ativar sessão</h1>
      <p class="subtitle">Acesso restrito a usuários autorizados</p>

      <div class="alert alert-error" id="err"></div>
      <div class="alert alert-success" id="ok"></div>

      <form id="form">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" type="email" placeholder="miguel@blankschool.com.br" required autocomplete="email">
        </div>
        <div class="field">
          <label for="password">Senha de ativação</label>
          <input id="password" type="password" placeholder="••••••••" required autocomplete="current-password">
        </div>
        <button type="submit" class="btn" id="btn">Ativar</button>
      </form>

      <div class="result" id="result">
        <hr class="divider">
        <p class="result-label">Token MCP (Bearer)</p>
        <div class="token-box" id="mcp-token"></div>
        <div class="copy-row">
          <button class="btn-sm" onclick="copyToken()">Copiar token</button>
        </div>
      </div>
    </div>

    <div class="instruction" id="instruction">
      <strong>Próximo passo:</strong><br>
      Cole o token no seu cliente MCP:<br><br>
      <code>Authorization: Bearer &lt;token&gt;</code><br><br>
      Ou atualize o <code>.mcp.json</code> e reinicie a sessão.
    </div>

    <p class="meta">Expira em 8h &middot; Sessão local &middot; Token não é transmitido ao cliente</p>
  </div>

  <script>
    let sessionToken = '';

    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn');
      btn.disabled = true;
      btn.textContent = 'Ativando…';
      hide('err'); hide('ok');

      try {
        const r = await fetch('/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: document.getElementById('email').value.trim(),
            password: document.getElementById('password').value,
          }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? 'Erro desconhecido');

        sessionToken = data.token;
        show('ok', 'Sessão ativada · role: ' + data.role + ' · expira em 8h');
        document.getElementById('mcp-token').textContent = data.token;
        document.getElementById('result').style.display = 'block';
        document.getElementById('instruction').style.display = 'block';
        document.getElementById('form').style.display = 'none';
      } catch (err) {
        show('err', err.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Ativar';
      }
    });

    function show(id, msg) { const el = document.getElementById(id); el.textContent = msg; el.style.display = 'block'; }
    function hide(id) { document.getElementById(id).style.display = 'none'; }
    function copyToken() { navigator.clipboard.writeText(sessionToken).then(() => alert('Copiado!')); }
  </script>
</body>
</html>`;
