import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

http.get('http://127.0.0.1:9229/json', (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    const wsUrl = JSON.parse(body)[0].webSocketDebuggerUrl;
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      // Get all parsed scripts
      ws.send(JSON.stringify({ id: 1, method: 'Debugger.enable' }));
    });
    
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.method === 'Debugger.scriptParsed') {
        const script = msg.params;
        if (script.url.endsWith('server.js')) {
          ws.send(JSON.stringify({
            id: 2,
            method: 'Debugger.getScriptSource',
            params: { scriptId: script.scriptId }
          }));
        }
      }
      if (msg.id === 2) {
        fs.writeFileSync('server.js', msg.result.scriptSource);
        console.log("Recovered server.js!");
        process.exit(0);
      }
    });
  });
});
