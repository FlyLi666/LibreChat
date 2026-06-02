const express = require('express');
const request = require('supertest');

jest.mock('~/server/middleware', () => ({
  requireJwtAuth: (req, _res, next) => next(),
}));

describe('HeZi routes', () => {
  let app;

  beforeAll(() => {
    const heziRouter = require('../hezi');
    app = express();
    app.use((req, _res, next) => {
      req.user = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'HeZi User',
        role: 'USER',
      };
      next();
    });
    app.use('/api/hezi', heziRouter);
  });

  const oldEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...oldEnv };
    delete process.env.HEZI_NOTEBOOKLM_SSO_SECRET;
    delete process.env.NOTEBOOKLM_URL;
  });

  afterAll(() => {
    process.env = oldEnv;
  });

  it('fails closed when NotebookLM SSO is not configured', async () => {
    const response = await request(app).get('/api/hezi/notebook-session');

    expect(response.status).toBe(503);
    expect(response.body.message).toBe('NotebookLM SSO is not configured');
  });

  it('returns a signed NotebookLM startup URL for the current user', async () => {
    process.env.HEZI_NOTEBOOKLM_SSO_SECRET = 'test-secret';
    process.env.NOTEBOOKLM_URL = 'https://notebook.example.com/';

    const response = await request(app).get('/api/hezi/notebook-session');

    expect(response.status).toBe(200);
    expect(response.body.url).toMatch(
      /^https:\/\/notebook\.example\.com\/api\/auth\/hezi\/start\?/,
    );
    expect(response.body.expiresAt).toEqual(expect.any(Number));

    const url = new URL(response.body.url);
    expect(url.searchParams.get('redirect')).toBe('/');
    const token = url.searchParams.get('token');
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });
});
