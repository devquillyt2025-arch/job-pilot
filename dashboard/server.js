const { createServer } = require('http');
const path = require('path');
const { spawn } = require('child_process');
const next = require('next');
const { WebSocketServer } = require('ws');
const { handleApi } = require('./server/api');

const dev = !process.argv.includes('--prod');
const port = process.env.PORT || 3000;
const projectRoot = path.join(__dirname, '..');
const runnerPath = path.join(projectRoot, 'src', 'runner', 'run.js');

const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

let currentChild = null;
const wsClients = new Set();

function broadcast(event) {
  const msg = JSON.stringify(event);
  for (const ws of wsClients) {
    if (ws.readyState === ws.OPEN) ws.send(msg);
  }
}

function startRun() {
  if (currentChild) return { started: false, error: 'A run is already in progress' };

  currentChild = spawn(process.execPath, [runnerPath], { cwd: projectRoot });
  broadcast({ type: 'run_process_started', pid: currentChild.pid });

  let buffer = '';
  currentChild.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try {
        broadcast(JSON.parse(line));
      } catch {
        broadcast({ type: 'log', message: line });
      }
    }
  });
  currentChild.stderr.on('data', (chunk) => {
    broadcast({ type: 'log', level: 'error', message: chunk.toString() });
  });
  currentChild.on('exit', (code) => {
    broadcast({ type: 'run_process_exited', code });
    currentChild = null;
  });

  return { started: true, pid: currentChild.pid };
}

function stopRun() {
  if (!currentChild) return { stopped: false, error: 'No run in progress' };
  currentChild.kill();
  return { stopped: true };
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    if (req.url === '/api/run' && req.method === 'POST') {
      const result = startRun();
      return sendJson(res, result.started ? 200 : 409, result);
    }
    if (req.url === '/api/stop' && req.method === 'POST') {
      const result = stopRun();
      return sendJson(res, result.stopped ? 200 : 404, result);
    }
    if (req.url === '/api/run-status' && req.method === 'GET') {
      return sendJson(res, 200, { running: Boolean(currentChild), pid: currentChild ? currentChild.pid : null });
    }
    if (req.url.startsWith('/api/')) {
      const handled = await handleApi(req, res);
      if (handled) return;
    }
    handle(req, res);
  });

  // Next's dev-mode HMR websocket needs custom servers to explicitly forward
  // its own upgrade requests through - without this, ws's blanket 'upgrade'
  // listener swallows them and Fast Refresh's socket fails its handshake.
  const wss = new WebSocketServer({ noServer: true });
  wss.on('connection', (ws) => {
    wsClients.add(ws);
    ws.send(JSON.stringify({ type: 'connected', running: Boolean(currentChild) }));
    ws.on('close', () => wsClients.delete(ws));
  });

  const nextUpgradeHandler = app.getUpgradeHandler();
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    } else {
      nextUpgradeHandler(req, socket, head);
    }
  });

  server.listen(port, () => {
    console.log(`> Auto-Job dashboard ready at http://localhost:${port}`);
  });
});
