/**
 * HeZi NewAPI client.
 *
 * NewAPI requires two headers on admin endpoints:
 *   Authorization: <admin token>
 *   New-Api-User: <admin user id>
 *
 * Per-user actions (login, create token, redeem) need a user session cookie
 * obtained by programmatic login.
 *
 * NewAPI password field hard cap: 20 characters (verified empirically).
 */

const { fetch } = require('undici');
const { logger } = require('@librechat/data-schemas');

const BASE = process.env.HEZI_NEWAPI_BASE_URL || 'https://newapi.flyli.cn';
const ADMIN_TOKEN = process.env.HEZI_NEWAPI_ADMIN_TOKEN;
const ADMIN_USER_ID = process.env.HEZI_NEWAPI_ADMIN_USER_ID || '1';
const SHADOW_PASSWORD_LEN = 16; // < 20 char NewAPI cap, leaves margin

class NewapiError extends Error {
  constructor(message, { status, body, code } = {}) {
    super(message);
    this.name = 'NewapiError';
    this.status = status;
    this.body = body;
    this.code = code;
  }
}

function adminHeaders(extra = {}) {
  if (!ADMIN_TOKEN) {
    throw new NewapiError('HEZI_NEWAPI_ADMIN_TOKEN is not configured', { code: 'NO_ADMIN_TOKEN' });
  }
  return {
    Authorization: ADMIN_TOKEN,
    'New-Api-User': String(ADMIN_USER_ID),
    'Content-Type': 'application/json',
    ...extra,
  };
}

function userHeaders(cookie, userId, extra = {}) {
  return {
    Cookie: cookie,
    'New-Api-User': String(userId),
    'Content-Type': 'application/json',
    ...extra,
  };
}

/** Generate a NewAPI-safe shadow password (alphanumeric, ≤16 chars). */
function generateShadowPassword() {
  const alphabet = 'ABCDEFGHIJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const buf = require('crypto').randomBytes(SHADOW_PASSWORD_LEN);
  for (let i = 0; i < SHADOW_PASSWORD_LEN; i++) {
    out += alphabet[buf[i] % alphabet.length];
  }
  return out;
}

async function readJsonOrText(res) {
  const text = await res.text();
  try {
    return { body: JSON.parse(text), raw: text };
  } catch {
    return { body: null, raw: text };
  }
}

/**
 * POST /api/user/  — admin creates a user.
 * NewAPI returns `{ success: true, message: '', data: ... }` on success.
 */
async function createShadowUser({ username, password, displayName }) {
  const res = await fetch(`${BASE}/api/user/`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({
      username,
      password,
      display_name: displayName,
    }),
  });
  const { body, raw } = await readJsonOrText(res);
  if (!res.ok || !body?.success) {
    throw new NewapiError(`createShadowUser failed: ${body?.message || raw || res.status}`, {
      status: res.status,
      body: body || raw,
      code: 'CREATE_USER_FAILED',
    });
  }
  return body;
}

/**
 * GET /api/user/?p=0&page_size=100  — paginate to find by username.
 */
async function findShadowUserByUsername(username) {
  // Search up to 5 pages of 100 to catch up on a small instance.
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${BASE}/api/user/?p=${page}&page_size=100`, {
      headers: adminHeaders(),
    });
    const { body, raw } = await readJsonOrText(res);
    if (!res.ok || !body?.success) {
      throw new NewapiError(`listUsers page=${page} failed`, {
        status: res.status,
        body: body || raw,
        code: 'LIST_USERS_FAILED',
      });
    }
    const items = body?.data?.items || body?.data || [];
    if (!Array.isArray(items) || items.length === 0) break;
    const hit = items.find((u) => u.username === username);
    if (hit) return hit;
    if (items.length < 100) break;
  }
  return null;
}

/**
 * POST /api/user/login  — programmatic login as the shadow user.
 * Returns { cookie, userId }. Cookie is forwarded to subsequent user calls.
 */
async function loginAsUser({ username, password }) {
  const res = await fetch(`${BASE}/api/user/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    redirect: 'manual',
  });
  const { body, raw } = await readJsonOrText(res);
  if (!res.ok || !body?.success) {
    throw new NewapiError('shadow login failed', {
      status: res.status,
      body: body || raw,
      code: 'SHADOW_LOGIN_FAILED',
    });
  }
  const setCookie = res.headers.get('set-cookie') || '';
  // Take just the cookie name=value pairs (drop attributes).
  const cookieKv = setCookie
    .split(/,\s*(?=[A-Za-z0-9_-]+=)/)
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
  if (!cookieKv) {
    throw new NewapiError('shadow login returned no cookie', {
      status: res.status,
      body: body || raw,
      code: 'SHADOW_LOGIN_NO_COOKIE',
    });
  }
  return {
    cookie: cookieKv,
    userId: body?.data?.id,
    body: body.data,
  };
}

/**
 * POST /api/token/ — user creates an sk-xxx token.
 * NewAPI's response shape includes the full key only on creation.
 */
async function createUserToken({ cookie, userId, name, unlimited = true, expiredTime = -1 }) {
  const res = await fetch(`${BASE}/api/token/`, {
    method: 'POST',
    headers: userHeaders(cookie, userId),
    body: JSON.stringify({
      name,
      remain_quota: 0,
      expired_time: expiredTime,
      unlimited_quota: unlimited,
      model_limits_enabled: false,
    }),
  });
  const { body, raw } = await readJsonOrText(res);
  if (!res.ok || !body?.success) {
    throw new NewapiError('createUserToken failed', {
      status: res.status,
      body: body || raw,
      code: 'CREATE_TOKEN_FAILED',
    });
  }
  // The created token's key is in body.data.key (or body.data — depends on version).
  const sk = body?.data?.key || (typeof body?.data === 'string' ? body.data : null);
  if (!sk || !sk.startsWith('sk-')) {
    throw new NewapiError('createUserToken returned no sk- key', {
      status: res.status,
      body,
      code: 'CREATE_TOKEN_NO_KEY',
    });
  }
  return sk;
}

/**
 * POST /api/user/topup — user redeems a redemption code.
 * Best-effort: if quotaCode missing/invalid, callers may swallow the error.
 */
async function redeemQuotaCode({ cookie, userId, code }) {
  const res = await fetch(`${BASE}/api/user/topup`, {
    method: 'POST',
    headers: userHeaders(cookie, userId),
    body: JSON.stringify({ key: code }),
  });
  const { body, raw } = await readJsonOrText(res);
  if (!res.ok || !body?.success) {
    throw new NewapiError(`redeem failed: ${body?.message || raw}`, {
      status: res.status,
      body: body || raw,
      code: 'REDEEM_FAILED',
    });
  }
  return body;
}

/**
 * DELETE /api/user/:id — admin removes a shadow user.
 * Used by HeZi when LibreChat user is deleted.
 */
async function deleteShadowUser(newapiUserId) {
  const res = await fetch(`${BASE}/api/user/${newapiUserId}`, {
    method: 'DELETE',
    headers: adminHeaders(),
  });
  const { body, raw } = await readJsonOrText(res);
  if (!res.ok || !body?.success) {
    logger.warn('[NewapiClient] deleteShadowUser non-success', { status: res.status, body: body || raw });
    return false;
  }
  return true;
}

module.exports = {
  NewapiError,
  generateShadowPassword,
  createShadowUser,
  findShadowUserByUsername,
  loginAsUser,
  createUserToken,
  redeemQuotaCode,
  deleteShadowUser,
};
