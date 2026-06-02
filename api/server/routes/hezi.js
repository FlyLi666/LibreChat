const crypto = require('crypto');
const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const DEFAULT_TOKEN_TTL_SECONDS = 120;

router.use(requireJwtAuth);

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signNotebookPayload(payload, secret) {
  const payloadPart = base64url(JSON.stringify(payload));
  const signaturePart = crypto.createHmac('sha256', secret).update(payloadPart).digest('base64url');
  return `${payloadPart}.${signaturePart}`;
}

function getUserId(req) {
  return req.user?.id || req.user?._id?.toString?.() || req.user?._id;
}

function getNotebookBaseUrl() {
  return (process.env.NOTEBOOKLM_URL || '').replace(/\/+$/, '');
}

function getTokenTtlSeconds() {
  const parsed = Number(process.env.HEZI_NOTEBOOKLM_SSO_TTL_SECONDS);
  if (!Number.isFinite(parsed) || parsed < 30 || parsed > 600) {
    return DEFAULT_TOKEN_TTL_SECONDS;
  }
  return Math.floor(parsed);
}

router.get('/notebook-session', (req, res) => {
  const secret = process.env.HEZI_NOTEBOOKLM_SSO_SECRET;
  const notebookBaseUrl = getNotebookBaseUrl();
  const userId = getUserId(req);
  if (!secret || !notebookBaseUrl) {
    return res.status(503).json({ message: 'NotebookLM SSO is not configured' });
  }
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl = getTokenTtlSeconds();
  const payload = {
    sub: String(userId),
    email: req.user?.email || '',
    name: req.user?.name || req.user?.username || '',
    role: req.user?.role || '',
    iat: now,
    exp: now + ttl,
  };
  const token = signNotebookPayload(payload, secret);
  const url = new URL('/api/auth/hezi/start', notebookBaseUrl);
  url.searchParams.set('token', token);
  url.searchParams.set('redirect', '/');

  return res.json({ url: url.toString(), expiresAt: payload.exp });
});

module.exports = router;
module.exports.signNotebookPayload = signNotebookPayload;
