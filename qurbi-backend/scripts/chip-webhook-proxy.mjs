import http from 'node:http';

const listenPort = Number(process.env.CHIP_WEBHOOK_PROXY_PORT || 3001);
const backendHost = process.env.CHIP_WEBHOOK_BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.CHIP_WEBHOOK_BACKEND_PORT || 3000);
const webhookPath = '/api/payments/chip/webhook';
const maxBodyBytes = 1024 * 1024;

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (request.method !== 'POST' || requestUrl.pathname !== webhookPath) {
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ statusCode: 404, message: 'Not found' }));
    return;
  }

  let receivedBytes = 0;
  const chunks = [];
  request.on('data', (chunk) => {
    receivedBytes += chunk.length;
    if (receivedBytes > maxBodyBytes) {
      response.writeHead(413, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ statusCode: 413, message: 'Payload too large' }));
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });

  request.on('end', () => {
    if (response.writableEnded) return;
    const body = Buffer.concat(chunks);
    const upstream = http.request(
      {
        hostname: backendHost,
        port: backendPort,
        path: webhookPath,
        method: 'POST',
        headers: {
          'content-type': request.headers['content-type'] || 'application/json',
          'content-length': body.length,
          'x-signature': request.headers['x-signature'] || '',
        },
      },
      (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode || 502, {
          'content-type': upstreamResponse.headers['content-type'] || 'application/json',
        });
        upstreamResponse.pipe(response);
      },
    );

    upstream.on('error', () => {
      if (!response.headersSent) {
        response.writeHead(502, { 'content-type': 'application/json' });
      }
      response.end(JSON.stringify({ statusCode: 502, message: 'Webhook backend unavailable' }));
    });
    upstream.end(body);
  });
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`CHIP webhook-only proxy listening on http://127.0.0.1:${listenPort}${webhookPath}`);
});
