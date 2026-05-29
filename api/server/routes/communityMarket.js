const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { generateCheckAccess } = require('@librechat/api');
const { PermissionTypes, Permissions } = require('librechat-data-provider');
const { requireJwtAuth } = require('~/server/middleware');
const configMiddleware = require('~/server/middleware/config/app');
const { getRoleByName } = require('~/models');
const {
  defaultCommunityMarketClient,
  getInstallStatus,
  installMarketItem,
} = require('~/server/services/communityMarket');

const router = express.Router();

async function proxyMarket(req, res, next, action, context) {
  try {
    const data = await action();

    res.json(data);
  } catch (error) {
    logger.error(`[CommunityMarket] Failed to proxy Lobe Market ${context}:`, error);
    next(error);
  }
}

const market = defaultCommunityMarketClient;

router.use(requireJwtAuth);
router.use(configMiddleware);

const checkSkillCreate = generateCheckAccess({
  permissionType: PermissionTypes.SKILLS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});
const checkMCPCreate = generateCheckAccess({
  permissionType: PermissionTypes.MCP_SERVERS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});
const checkAgentCreate = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE, Permissions.CREATE],
  getRoleByName,
});

function normalizeInstallKind(kind) {
  if (kind === 'skills') {
    return 'skill';
  }
  if (kind === 'mcp' || kind === 'plugins') {
    return 'mcp';
  }
  if (kind === 'agents') {
    return 'agent';
  }
  return kind;
}

function checkCreateAccessForKind(req, res, next) {
  const kind = normalizeInstallKind(req.params.kind);
  if (kind === 'skill') {
    return checkSkillCreate(req, res, next);
  }
  if (kind === 'mcp') {
    return checkMCPCreate(req, res, next);
  }
  if (kind === 'agent') {
    return checkAgentCreate(req, res, next);
  }
  return res.status(400).json({ error: `Unsupported community market kind: ${req.params.kind}` });
}

router.get('/:kind/:identifier/install-status', (req, res, next) =>
  proxyMarket(
    req,
    res,
    next,
    () =>
      getInstallStatus({
        market,
        kind: req.params.kind,
        identifier: req.params.identifier,
        req,
      }),
    'install status',
  ),
);

router.post('/:kind/:identifier/install', checkCreateAccessForKind, (req, res, next) =>
  proxyMarket(
    req,
    res,
    next,
    () =>
      installMarketItem({
        market,
        kind: req.params.kind,
        identifier: req.params.identifier,
        req,
      }),
    'install',
  ),
);

router.get('/skills', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getSkillList(req.query), 'skills list'),
);
router.get('/skills/categories', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getSkillCategories(req.query), 'skills categories'),
);
router.get('/skills/:identifier', (req, res, next) =>
  proxyMarket(
    req,
    res,
    next,
    () => market.getSkillDetail(req.params.identifier, req.query),
    'skill detail',
  ),
);
router.get('/mcp', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getMcpList(req.query), 'mcp list'),
);
router.get('/mcp/categories', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getMcpCategories(req.query), 'mcp categories'),
);
router.get('/mcp/:identifier', (req, res, next) =>
  proxyMarket(
    req,
    res,
    next,
    () => market.getMcpDetail(req.params.identifier, req.query),
    'mcp detail',
  ),
);
router.get('/agents', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getAgents(req.query), 'agents list'),
);
router.get('/agents/categories', (req, res, next) =>
  proxyMarket(req, res, next, () => market.getAgentCategories(req.query), 'agents categories'),
);
router.get('/agents/:identifier', (req, res, next) =>
  proxyMarket(
    req,
    res,
    next,
    () => market.getAgentDetail(req.params.identifier, req.query),
    'agent detail',
  ),
);

module.exports = router;
