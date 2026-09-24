require('dotenv').config({ quiet: true });

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/src/app.module');
const { configureApp } = require('../dist/src/configure-app');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function run() {
  const app = await NestFactory.create(AppModule, { logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');

  try {
    const address = app.getHttpServer().address();
    const baseUrl = `http://127.0.0.1:${address.port}/api`;

    const unauthorized = await fetch(`${baseUrl}/livestock`);
    assert(unauthorized.status === 401, `expected protected route 401, got ${unauthorized.status}`);

    const missingPortal = await fetch(`${baseUrl}/auth/firebase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake-token' }),
    });
    assert(missingPortal.status === 400, `expected missing portal 400, got ${missingPortal.status}`);

    const invalidPortal = await fetch(`${baseUrl}/auth/firebase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake-token', portal: 'admin' }),
    });
    assert(invalidPortal.status === 400, `expected invalid portal 400, got ${invalidPortal.status}`);

    const buyerPortal = await fetch(`${baseUrl}/auth/firebase`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: 'fake-token', portal: 'buyer' }),
    });
    assert(buyerPortal.status === 401, `expected fake Firebase token 401, got ${buyerPortal.status}`);

    const cors = await fetch(`${baseUrl}/auth/firebase`, {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5137',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    assert(cors.status === 204, `expected CORS preflight 204, got ${cors.status}`);
    assert(
      cors.headers.get('access-control-allow-origin') === 'http://localhost:5137',
      'QURBI User origin was not allowed by CORS',
    );

    console.log('E2E smoke passed: auth validation, route protection and CORS.');
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
