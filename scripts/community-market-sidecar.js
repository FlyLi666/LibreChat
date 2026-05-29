const crypto = require('crypto');
const http = require('http');
const jwt = require('jsonwebtoken');

const DEFAULT_MARKET_BASE_URL = 'https://market.lobehub.com';
const port = Number(process.env.PORT || 3082);

function getMarketBaseUrl() {
  return (
    process.env.MARKET_BASE_URL ||
    process.env.LOBEHUB_MARKET_BASE_URL ||
    DEFAULT_MARKET_BASE_URL
  ).replace(/\/$/, '');
}

function parseBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function getStaticClientCredentials() {
  const clientId = process.env.MARKET_CLIENT_ID || process.env.LOBEHUB_MARKET_CLIENT_ID;
  const clientSecret = process.env.MARKET_CLIENT_SECRET || process.env.LOBEHUB_MARKET_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

function createReadonlyMarketClient() {
  let registeredClient;
  let tokenCache;

  async function requestMarket(path, requestOptions = {}) {
    const response = await fetch(`${getMarketBaseUrl()}${path}`, requestOptions);
    const text = await response.text();
    const body = parseBody(text);

    if (!response.ok) {
      const error = new Error(
        body?.error_description || body?.message || body?.error || response.statusText,
      );
      error.status = response.status;
      error.body = body;
      throw error;
    }

    return body;
  }

  async function getClientCredentials() {
    const staticCredentials = getStaticClientCredentials();
    if (staticCredentials) {
      return staticCredentials;
    }
    if (registeredClient) {
      return registeredClient;
    }

    const deviceId = process.env.LIBRECHAT_MARKET_DEVICE_ID || `hezi-local-${crypto.randomUUID()}`;
    const result = await requestMarket('/api/v1/clients/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: process.env.LIBRECHAT_MARKET_CLIENT_NAME || 'HeZi LibreChat Local Sidecar',
        clientType: 'web',
        deviceId,
        platform: 'web',
        version: process.env.npm_package_version || '0.1.0',
      }),
    });

    registeredClient = {
      clientId: result.client_id,
      clientSecret: result.client_secret,
    };
    return registeredClient;
  }

  async function getAccessToken() {
    if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
      return tokenCache.accessToken;
    }

    const { clientId, clientSecret } = await getClientCredentials();
    const tokenEndpoint = `${getMarketBaseUrl()}/oauth/token`;
    const clientAssertion = jwt.sign({}, clientSecret, {
      algorithm: 'HS256',
      audience: tokenEndpoint,
      expiresIn: '5m',
      issuer: clientId,
      jwtid: crypto.randomUUID(),
      subject: clientId,
    });

    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.set('client_assertion', clientAssertion);

    const tokenData = await requestMarket('/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    tokenCache = {
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + ((tokenData.expires_in || 3600) - 60) * 1000,
    };
    return tokenCache.accessToken;
  }

  async function requestAuthenticatedMarket(path) {
    const token = await getAccessToken();
    return requestMarket(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  return { requestAuthenticatedMarket };
}

const market = createReadonlyMarketClient();

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, authorization');
}

http
  .createServer(async (req, res) => {
    setCors(res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (!url.pathname.startsWith('/api/community-market/')) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'not found' }));
        return;
      }

      if (url.pathname.endsWith('/install') || url.pathname.endsWith('/install-status')) {
        res.writeHead(501, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            message:
              'community market sidecar is read-only and cannot persist install/status state',
            status: 'unsupported',
          }),
        );
        return;
      }

      if (req.method !== 'GET') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'method not allowed' }));
        return;
      }

      const rest = url.pathname.replace('/api/community-market/', '');
      const target = rest.startsWith('skills') ? rest : rest.replace(/^mcp/, 'plugins');
      const data = await market.requestAuthenticatedMarket(`/api/v1/${target}${url.search}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (error) {
      res.writeHead(error.status || 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ body: error.body, message: error.message }));
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`community market sidecar listening on ${port}`);
  });
