const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const {
  EModelEndpoint,
  AccessRoleIds,
  Constants,
  PrincipalType,
  ResourceType,
} = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');
const { getMissingCustomUserVars } = require('@librechat/api');
const { getMCPServersRegistry } = require('~/config');
const { grantPermission } = require('~/server/services/PermissionService');
const { resolveImportDefaultModel } = require('~/server/utils/import/defaults');
const { getUserPluginAuthValue } = require('~/server/services/PluginService');
const db = require('~/models');

const DEFAULT_MARKET_BASE_URL = 'https://market.lobehub.com';
const DEFAULT_PAGE_SIZE = 21;
const MAX_PAGE_SIZE = 48;
const DEFAULT_LOCALE = 'zh-CN';
const MARKET_SOURCE = 'lobe-community-market';
const SENSITIVE_KEY_PATTERN = /(api[_-]?key|token|secret|password|authorization|bearer|cookie)/i;

function buildMarketOpenUrl(kind, identifier, activeTab) {
  const url = `/community/${encodeURIComponent(kind)}/${encodeURIComponent(identifier)}`;
  return activeTab ? `${url}?activeTab=${encodeURIComponent(activeTab)}` : url;
}

function buildAgentChatUrl(agentId) {
  return `/c/new?agent_id=${encodeURIComponent(agentId)}`;
}

function getMarketBaseUrl() {
  return (
    process.env.MARKET_BASE_URL ||
    process.env.LOBEHUB_MARKET_BASE_URL ||
    DEFAULT_MARKET_BASE_URL
  ).replace(/\/$/, '');
}

function getStaticClientCredentials() {
  const clientId = process.env.MARKET_CLIENT_ID || process.env.LOBEHUB_MARKET_CLIENT_ID;
  const clientSecret = process.env.MARKET_CLIENT_SECRET || process.env.LOBEHUB_MARKET_CLIENT_SECRET;

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  return null;
}

function parseMarketResponseBody(text) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

function getMarketErrorMessage(body, response) {
  if (body && typeof body === 'object') {
    return body.error_description || body.message || body.error;
  }

  return response.statusText;
}

function normalizeQueryValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildListQuery(params = {}) {
  const page = Math.max(Number(params.page || 1), 1);
  const rawPageSize = Number(params.pageSize || DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);
  const query = new URLSearchParams({
    locale: String(params.locale || DEFAULT_LOCALE),
    page: String(page),
    pageSize: String(pageSize),
  });

  ['category', 'connectionType', 'order', 'q', 'sort'].forEach((key) => {
    const value = normalizeQueryValue(params[key]);
    if (value) {
      query.set(key, value);
    }
  });

  return query;
}

function buildCategoriesQuery(params = {}) {
  const query = new URLSearchParams({
    locale: String(params.locale || DEFAULT_LOCALE),
  });
  const search = normalizeQueryValue(params.q);
  if (search) {
    query.set('q', search);
  }

  return query;
}

function buildDetailQuery(params = {}) {
  const query = new URLSearchParams({
    locale: String(params.locale || DEFAULT_LOCALE),
  });

  return query;
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function firstObject(...values) {
  for (const value of values) {
    const object = asObject(value);
    if (object) {
      return object;
    }
  }
  return undefined;
}

function readPath(source, path) {
  return path.split('.').reduce((current, key) => asObject(current)?.[key], source);
}

function pickString(source, paths) {
  return firstString(...paths.map((path) => readPath(source, path)));
}

function pickObject(source, paths) {
  return firstObject(...paths.map((path) => readPath(source, path)));
}

function pickArray(source, paths) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (Array.isArray(value)) {
      return value;
    }
  }
  return undefined;
}

function slugify(value, fallback = 'market-item') {
  const slug = String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || fallback;
}

function titleFromSlug(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getDetailTitle(detail, identifier) {
  return firstString(
    detail.name,
    detail.title,
    detail.displayName,
    detail.displayTitle,
    asObject(detail.meta)?.title,
    titleFromSlug(slugify(identifier)),
  );
}

function getDetailDescription(detail) {
  return firstString(
    detail.description,
    detail.summary,
    detail.shortDescription,
    asObject(detail.meta)?.description,
    '',
  );
}

function getReadme(detail) {
  return firstString(
    detail.readme,
    detail.README,
    detail.markdown,
    detail.content,
    detail.body,
    detail.instructions,
    detail.systemPrompt,
    pickString(detail, ['detail.readme', 'manifest.readme', 'meta.readme']),
  );
}

function getSourceUrl(detail) {
  return firstString(
    detail.url,
    detail.homepage,
    pickString(detail, ['github.url', 'repository.url', 'repo.url', 'source.url']),
  );
}

function normalizeDetail(raw, kind, identifier) {
  const detail = asObject(raw) || {};
  const manifest = pickObject(detail, [
    'manifest',
    'package',
    'plugin',
    'agent',
    'skill',
    'config',
    'metadata.manifest',
  ]);
  const install =
    pickObject(detail, ['install', 'installation', 'installationMethods', 'setup']) ||
    firstString(detail.install, detail.installation, detail.installationMethods);
  const deployment = pickObject(detail, ['deployment', 'deploy', 'runtime', 'server']);
  const schema = pickObject(detail, ['schema', 'inputSchema', 'configSchema', 'envSchema']);
  const source = {
    kind,
    identifier,
    market: MARKET_SOURCE,
    url: getSourceUrl(detail),
  };

  return {
    ...detail,
    identifier: firstString(detail.identifier, detail.id, detail.slug, identifier),
    name: getDetailTitle(detail, identifier),
    description: getDetailDescription(detail),
    readme: getReadme(detail),
    manifest,
    install,
    deployment,
    schema,
    version: firstString(
      detail.version,
      pickString(detail, ['manifest.version', 'package.version']),
    ),
    source,
    raw: detail,
  };
}

function toSkillBody(detail) {
  const content = firstString(
    getReadme(detail),
    detail.instructions,
    detail.prompt,
    detail.description,
  );
  const title = getDetailTitle(detail, detail.identifier);
  const sourceUrl = getSourceUrl(detail);
  const sourceLines = [
    '---',
    'user-invocable: true',
    '---',
    '',
    content || `Use the ${title} skill.`,
  ];
  if (sourceUrl) {
    sourceLines.push('', `Source: ${sourceUrl}`);
  }
  return sourceLines.join('\n');
}

function buildSourceMetadata(detail, kind, identifier) {
  return {
    kind,
    identifier,
    market: MARKET_SOURCE,
    sourceUrl: getSourceUrl(detail),
    version: detail.version,
    installedAt: new Date().toISOString(),
  };
}

function getSourceIdentifierCandidates(detail, identifier) {
  return Array.from(
    new Set(
      [
        identifier,
        detail.identifier,
        detail.id,
        detail.slug,
        detail.name,
        detail.source?.identifier,
        detail.raw?.identifier,
        detail.raw?.id,
        detail.raw?.slug,
      ].filter((value) => typeof value === 'string' && value.trim()),
    ),
  );
}

function getAuthorId(user) {
  return user?._id ?? user?.id;
}

function getTenantFilter(user) {
  return user?.tenantId
    ? { tenantId: user.tenantId }
    : { $or: [{ tenantId: null }, { tenantId: { $exists: false } }] };
}

async function findExistingSkill({ name, user }) {
  const Skill = mongoose.models.Skill;
  if (!Skill) {
    return null;
  }
  return Skill.findOne({
    name,
    author: getAuthorId(user),
    ...getTenantFilter(user),
  }).lean();
}

async function createSkillFromDetail({ detail, kind, identifier, user }) {
  const name = slugify(
    firstString(detail.slug, detail.identifier, detail.name, identifier),
    'market-skill',
  );
  const existing = await findExistingSkill({ name, user });
  if (existing) {
    return {
      action: 'existing',
      kind,
      identifier,
      status: 'installed',
      local: { id: existing._id?.toString(), name: existing.name, type: 'skill' },
      openUrl: existing._id ? `/skills/${existing._id.toString()}` : undefined,
    };
  }

  const createResult = await db.createSkill({
    name,
    displayTitle: getDetailTitle(detail, identifier),
    description: getDetailDescription(detail) || `Installed from ${MARKET_SOURCE}`,
    body: toSkillBody(detail),
    frontmatter: {
      'user-invocable': true,
      source: MARKET_SOURCE,
    },
    category: firstString(detail.category, 'Community Market'),
    alwaysApply: false,
    author: getAuthorId(user),
    authorName: user.name ?? user.username ?? 'Unknown',
    tenantId: user.tenantId,
    source: MARKET_SOURCE,
    sourceMetadata: buildSourceMetadata(detail, kind, identifier),
  });
  const { skill, warnings } = createResult;

  try {
    await grantPermission({
      principalType: PrincipalType.USER,
      principalId: user.id,
      resourceType: ResourceType.SKILL,
      resourceId: skill._id,
      accessRoleId: AccessRoleIds.SKILL_OWNER,
      grantedBy: user.id,
    });
  } catch (error) {
    logger.error(`[CommunityMarket] Failed to grant SKILL_OWNER for ${skill._id}:`, error);
    await db.deleteSkill(skill._id.toString());
    throw error;
  }

  return {
    action: 'created',
    kind,
    identifier,
    status: 'installed',
    local: { id: skill._id?.toString(), name: skill.name, type: 'skill' },
    openUrl: skill._id ? `/skills/${skill._id.toString()}` : undefined,
    warnings,
  };
}

function extractEnvSchema(detail) {
  const env =
    pickObject(detail, [
      'env',
      'envSchema',
      'environment',
      'environmentVariables',
      'manifest.env',
      'manifest.envSchema',
      'config.env',
      'config.envSchema',
    ]) || {};
  return Object.entries(env).reduce((schema, [key, value]) => {
    if (!key || SENSITIVE_KEY_PATTERN.test(String(value))) {
      schema[key] = {
        title: key,
        description: 'Required by the community MCP server.',
      };
      return schema;
    }
    const objectValue = asObject(value);
    schema[key] = {
      title: firstString(objectValue?.title, objectValue?.name, key),
      description: firstString(objectValue?.description, objectValue?.hint, ''),
    };
    return schema;
  }, {});
}

function sanitizeHeaders(headers) {
  const source = asObject(headers);
  if (!source) {
    return undefined;
  }
  return Object.entries(source).reduce((safe, [key, value]) => {
    if (SENSITIVE_KEY_PATTERN.test(key) || SENSITIVE_KEY_PATTERN.test(String(value))) {
      return safe;
    }
    if (typeof value === 'string') {
      safe[key] = value;
    }
    return safe;
  }, {});
}

function getMcpUrl(detail) {
  return firstString(
    detail.url,
    detail.serverUrl,
    detail.endpoint,
    pickString(detail, [
      'manifest.url',
      'manifest.serverUrl',
      'manifest.endpoint',
      'manifest.mcp.url',
      'config.url',
      'config.serverUrl',
      'deployment.url',
      'runtime.url',
    ]),
  );
}

function getMcpCommand(detail) {
  return firstString(
    detail.command,
    pickString(detail, [
      'manifest.command',
      'manifest.mcp.command',
      'config.command',
      'runtime.command',
      'deployment.command',
    ]),
  );
}

function getMcpArgs(detail) {
  return (
    pickArray(detail, ['args', 'arguments', 'manifest.args', 'config.args', 'runtime.args']) || []
  ).filter((arg) => typeof arg === 'string');
}

function inferMcpType(url, detail) {
  const explicit = firstString(
    detail.type,
    detail.connectionType,
    pickString(detail, ['manifest.type', 'config.type', 'runtime.type']),
  );
  if (explicit === 'websocket' || explicit === 'sse' || explicit === 'streamable-http') {
    return explicit;
  }
  if (/^wss?:\/\//i.test(url)) {
    return 'websocket';
  }
  if (/\/sse(?:\/|\?|$)/i.test(url)) {
    return 'sse';
  }
  return 'streamable-http';
}

function hasSensitiveUrlParam(url) {
  try {
    const parsed = new URL(url);
    return Array.from(parsed.searchParams.keys()).some((key) => SENSITIVE_KEY_PATTERN.test(key));
  } catch {
    return true;
  }
}

function redactUrl(url) {
  if (!url) {
    return url;
  }
  try {
    const parsed = new URL(url);
    Array.from(parsed.searchParams.keys()).forEach((key) => {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        parsed.searchParams.set(key, '[redacted]');
      }
    });
    return parsed.toString();
  } catch {
    return '[redacted]';
  }
}

function buildMcpConfig(detail, identifier) {
  const title = getDetailTitle(detail, identifier)
    .replace(/[^a-zA-Z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const description = getDetailDescription(detail);
  const iconPath = firstString(detail.icon, detail.avatar, detail.logo);
  const url = getMcpUrl(detail);
  const command = getMcpCommand(detail);
  const envSchema = extractEnvSchema(detail);

  if (url && hasSensitiveUrlParam(url)) {
    return {
      needsConfig: {
        reason: 'url_contains_sensitive_runtime_parameter',
        required: ['url'],
      },
    };
  }

  if (url) {
    const config = {
      type: inferMcpType(url, detail),
      title: title || titleFromSlug(slugify(identifier, 'MCP Server')),
      description,
      url,
      iconPath,
      startup: false,
      chatMenu: true,
    };
    const headers = sanitizeHeaders(
      pickObject(detail, ['headers', 'manifest.headers', 'config.headers', 'runtime.headers']),
    );
    if (headers && Object.keys(headers).length > 0) {
      config.headers = headers;
    }
    if (Object.keys(envSchema).length > 0) {
      config.customUserVars = envSchema;
    }
    return { config };
  }

  if (command) {
    return {
      needsConfig: {
        reason: 'stdio_runtime_requires_explicit_configuration',
        required: ['command', ...(getMcpArgs(detail).length > 0 ? [] : ['args'])],
        transport: 'stdio',
      },
    };
  }

  return {
    needsConfig: {
      reason: 'missing_mcp_runtime',
      required: ['url', 'command'],
    },
  };
}

function getMcpDeploymentInstructions(detail) {
  return firstString(
    detail.deploymentInstructions,
    detail.setupInstructions,
    detail.instructions,
    detail.install,
    pickString(detail, [
      'install.instructions',
      'installation.instructions',
      'setup.instructions',
      'deployment.instructions',
      'deploy.instructions',
      'runtime.instructions',
    ]),
    getReadme(detail),
  );
}

function getMcpDeployment(detail) {
  return firstObject(
    detail.deployment,
    detail.deploy,
    detail.runtime,
    pickObject(detail, ['install.deployment', 'installation.deployment', 'setup.deployment']),
  );
}

function buildMcpNeedsConfigResponse({
  detail,
  kind,
  identifier,
  needsConfig,
  config,
  reason,
  missing,
}) {
  const configUrl = buildMarketOpenUrl(kind, identifier, 'deployment');
  const required = Array.from(new Set(missing || needsConfig?.required || ['runtime']));
  const instructions = getMcpDeploymentInstructions(detail);
  const deployment = getMcpDeployment(detail);
  return {
    kind,
    identifier,
    status: 'needs_config',
    missing: required,
    reason: reason || needsConfig?.reason || 'mcp_runtime_requires_configuration',
    transport: needsConfig?.transport,
    config: redactMcpConfig(config),
    configUrl,
    openUrl: configUrl,
    deployment,
    instructions,
  };
}

function getMcpConfigUserVarKeys(config) {
  const customUserVars = asObject(config?.customUserVars);
  return customUserVars ? Object.keys(customUserVars) : [];
}

function getMcpNeedsUserConfig(config) {
  return getMcpConfigUserVarKeys(config).length > 0;
}

async function getMissingMcpUserVars({ config, serverName, user }) {
  const missingByShape = getMissingCustomUserVars(config, undefined);
  if (missingByShape.length === 0 || !serverName || !user?.id) {
    return missingByShape;
  }

  const providedVars = {};
  await Promise.all(
    missingByShape.map(async (key) => {
      try {
        const value = await getUserPluginAuthValue(
          user.id,
          key,
          false,
          `${Constants.mcp_prefix}${serverName}`,
        );
        if (typeof value === 'string') {
          providedVars[key] = value;
        }
      } catch (error) {
        logger.warn(
          `[CommunityMarket] Failed to read MCP auth value for ${serverName}:${key}:`,
          error,
        );
      }
    }),
  );
  return getMissingCustomUserVars(config, providedVars);
}

function redactMcpConfig(config) {
  if (!config) {
    return undefined;
  }
  const { headers, apiKey, oauth, env, ...safe } = config;
  if (safe.url) {
    safe.url = redactUrl(safe.url);
  }
  if (headers) {
    safe.headers = Object.keys(headers).reduce((acc, key) => {
      acc[key] = '[redacted]';
      return acc;
    }, {});
  }
  if (apiKey) {
    safe.apiKey = { source: apiKey.source, authorization_type: apiKey.authorization_type };
  }
  if (oauth) {
    safe.oauth = Object.keys(oauth).reduce((acc, key) => {
      acc[key] = SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : oauth[key];
      return acc;
    }, {});
  }
  if (env) {
    safe.env = Object.keys(env).reduce((acc, key) => {
      acc[key] = '[redacted]';
      return acc;
    }, {});
  }
  return safe;
}

async function createMcpFromDetail({ detail, kind, identifier, user }) {
  const title = getDetailTitle(detail, identifier);
  const name = slugify(
    firstString(detail.slug, detail.identifier, detail.name, title),
    'mcp-server',
  );
  const existing = await findExistingMcpServer({ serverName: name, title, user });
  if (existing) {
    const missing = await getMissingMcpUserVars({
      config: existing.config,
      serverName: existing.serverName,
      user,
    });
    if (missing.length > 0) {
      return {
        action: 'needs_config',
        ...buildMcpNeedsConfigResponse({
          detail,
          kind,
          identifier,
          config: existing.config,
          needsConfig: {
            reason: 'mcp_user_variables_required',
            required: missing,
          },
        }),
      };
    }
    return {
      action: 'existing',
      kind,
      identifier,
      status: 'installed',
      local: { serverName: existing.serverName, title: existing.config?.title, type: 'mcp' },
      openUrl: '/c/new',
    };
  }

  const { config, needsConfig } = buildMcpConfig(detail, identifier);
  if (config && getMcpNeedsUserConfig(config)) {
    return {
      action: 'needs_config',
      ...buildMcpNeedsConfigResponse({
        detail,
        kind,
        identifier,
        config,
        needsConfig: {
          reason: 'mcp_user_variables_required',
          required: getMcpConfigUserVarKeys(config),
        },
      }),
    };
  }
  if (needsConfig) {
    return {
      action: 'needs_config',
      ...buildMcpNeedsConfigResponse({ detail, kind, identifier, needsConfig }),
    };
  }

  try {
    const result = await getMCPServersRegistry().addServer(name, config, 'DB', user.id);
    return {
      action: 'created',
      kind,
      identifier,
      status: 'installed',
      local: {
        serverName: result.serverName,
        title: result.config.title,
        type: 'mcp',
      },
      openUrl: '/c/new',
      config: redactMcpConfig(result.config),
    };
  } catch (error) {
    logger.warn('[CommunityMarket] MCP install requires configuration:', error);
    return {
      action: 'needs_config',
      ...buildMcpNeedsConfigResponse({
        detail,
        kind,
        identifier,
        config,
        reason: error.message || 'mcp_inspection_failed',
        missing: ['runtime'],
      }),
    };
  }
}

function normalizeProvider(provider) {
  const value = String(provider || '').toLowerCase();
  if (value === 'openai' || value === 'open_ai') {
    return EModelEndpoint.openAI;
  }
  if (value === 'anthropic' || value === 'claude') {
    return EModelEndpoint.anthropic;
  }
  if (value === 'google' || value === 'gemini') {
    return EModelEndpoint.google;
  }
  return provider;
}

function getAgentProvider(detail, req) {
  const fromDetail = normalizeProvider(
    firstString(
      detail.provider,
      detail.modelProvider,
      pickString(detail, ['config.provider', 'manifest.provider', 'agent.provider']),
    ),
  );
  if (fromDetail) {
    return fromDetail;
  }
  const allowedProviders = req.config?.endpoints?.[EModelEndpoint.agents]?.allowedProviders;
  return Array.isArray(allowedProviders) && allowedProviders[0]
    ? allowedProviders[0]
    : EModelEndpoint.openAI;
}

async function getAgentModel(detail, provider, user) {
  const model = firstString(
    detail.model,
    detail.modelName,
    pickString(detail, ['config.model', 'manifest.model', 'agent.model']),
  );
  if (model) {
    return model;
  }
  return resolveImportDefaultModel({
    endpoint: provider,
    requestUserId: user.id,
    userRole: user.role,
  });
}

async function findExistingAgentFromMarket({ detail, identifier, name, user }) {
  const sourceIdentifiers = getSourceIdentifierCandidates(detail, identifier);
  const sourceClauses = sourceIdentifiers.map((sourceIdentifier) => ({
    'support_contact.sourceMetadata.market': MARKET_SOURCE,
    'support_contact.sourceMetadata.kind': 'agent',
    'support_contact.sourceMetadata.identifier': sourceIdentifier,
  }));
  const clauses = [
    ...sourceClauses,
    {
      name,
      'support_contact.name': MARKET_SOURCE,
    },
  ];
  const agents = await db.getAgents({
    $and: [{ $or: clauses }, getTenantFilter(user)],
    author: getAuthorId(user),
  });
  return agents?.[0] ?? null;
}

async function findExistingMcpServer({ serverName, title, user }) {
  const MCPServer = mongoose.models.MCPServer;
  if (!MCPServer) {
    return null;
  }
  const ownerId = getAuthorId(user);
  const clauses = [{ serverName }];
  if (title) {
    clauses.push({ 'config.title': title });
  }
  return MCPServer.findOne({
    $and: [{ $or: clauses }, getTenantFilter(user)],
    author: ownerId,
  }).lean();
}

async function createAgentFromDetail({ detail, kind, identifier, req }) {
  const { user } = req;
  const name = getDetailTitle(detail, identifier);
  const existing = await findExistingAgentFromMarket({ detail, identifier, name, user });
  if (existing) {
    return {
      action: 'existing',
      kind,
      identifier,
      status: 'installed',
      local: { id: existing.id, name: existing.name, type: 'agent' },
      openUrl: buildAgentChatUrl(existing.id),
    };
  }

  const provider = getAgentProvider(detail, req);
  const model = await getAgentModel(detail, provider, user);
  const icon = firstString(detail.avatar, detail.icon, detail.logo);
  const sourceMetadata = buildSourceMetadata(detail, kind, identifier);
  const openingQuestions = pickArray(detail, [
    'openingQuestions',
    'config.openingQuestions',
    'manifest.openingQuestions',
    'agent.openingQuestions',
  ]);
  const openingMessage = pickString(detail, [
    'openingMessage',
    'config.openingMessage',
    'manifest.openingMessage',
    'agent.openingMessage',
  ]);
  const conversationStarters = [openingMessage, ...(openingQuestions || [])].filter(
    (value) => typeof value === 'string' && value.trim(),
  );
  const agent = await db.createAgent({
    id: `agent_${nanoid()}`,
    name,
    description: getDetailDescription(detail),
    instructions: firstString(
      pickString(detail, ['config.systemRole', 'manifest.systemRole', 'agent.config.systemRole']),
      detail.systemRole,
      detail.instructions,
      detail.systemPrompt,
      detail.prompt,
      getReadme(detail),
      getDetailDescription(detail),
    ),
    conversation_starters: conversationStarters,
    avatar: icon ? { filepath: icon, source: 'url' } : undefined,
    provider,
    model,
    model_parameters: {},
    tools: [],
    category: firstString(detail.category, 'Community Market'),
    support_contact: {
      name: MARKET_SOURCE,
      email: '',
      source: MARKET_SOURCE,
      sourceMetadata,
    },
    author: user.id,
    authorName: user.name ?? user.username ?? 'Unknown',
    tenantId: user.tenantId,
  });

  try {
    await Promise.all([
      grantPermission({
        principalType: PrincipalType.USER,
        principalId: user.id,
        resourceType: ResourceType.AGENT,
        resourceId: agent._id,
        accessRoleId: AccessRoleIds.AGENT_OWNER,
        grantedBy: user.id,
      }),
      grantPermission({
        principalType: PrincipalType.USER,
        principalId: user.id,
        resourceType: ResourceType.REMOTE_AGENT,
        resourceId: agent._id,
        accessRoleId: AccessRoleIds.REMOTE_AGENT_OWNER,
        grantedBy: user.id,
      }),
    ]);
  } catch (error) {
    logger.error(`[CommunityMarket] Failed to grant AGENT_OWNER for ${agent.id}:`, error);
    await db.deleteAgent({ id: agent.id });
    throw error;
  }

  return {
    action: 'created',
    kind,
    identifier,
    status: 'installed',
    local: { id: agent.id, name: agent.name, type: 'agent' },
    openUrl: buildAgentChatUrl(agent.id),
    source: sourceMetadata,
  };
}

function normalizeKind(kind) {
  if (kind === 'skills') {
    return 'skill';
  }
  if (kind === 'plugins' || kind === 'mcp') {
    return 'mcp';
  }
  if (kind === 'agents') {
    return 'agent';
  }
  return kind;
}

function resourceForKind(kind) {
  return {
    skill: 'skills',
    mcp: 'plugins',
    agent: 'agents',
  }[normalizeKind(kind)];
}

async function getNormalizedDetail(market, kind, identifier, params) {
  const normalizedKind = normalizeKind(kind);
  const resource = resourceForKind(normalizedKind);
  if (!resource) {
    const error = new Error(`Unsupported community market kind: ${kind}`);
    error.status = 400;
    throw error;
  }
  const raw = await market.getDetail(resource, identifier, params);
  return normalizeDetail(raw, normalizedKind, identifier);
}

async function installMarketItem({ market, kind, identifier, req }) {
  const normalizedKind = normalizeKind(kind);
  const detail = await getNormalizedDetail(market, normalizedKind, identifier, req.query);
  if (normalizedKind === 'skill') {
    return createSkillFromDetail({ detail, kind: normalizedKind, identifier, user: req.user });
  }
  if (normalizedKind === 'mcp') {
    return createMcpFromDetail({ detail, kind: normalizedKind, identifier, user: req.user });
  }
  if (normalizedKind === 'agent') {
    return createAgentFromDetail({ detail, kind: normalizedKind, identifier, req });
  }
  const error = new Error(`Unsupported community market kind: ${kind}`);
  error.status = 400;
  throw error;
}

async function getInstallStatus({ market, kind, identifier, req }) {
  const normalizedKind = normalizeKind(kind);
  const detail = await getNormalizedDetail(market, normalizedKind, identifier, req.query);
  if (normalizedKind === 'skill') {
    const name = slugify(
      firstString(detail.slug, detail.identifier, detail.name, identifier),
      'market-skill',
    );
    const existing = await findExistingSkill({ name, user: req.user });
    return {
      kind: normalizedKind,
      identifier,
      status: existing ? 'installed' : 'not_installed',
      local: existing
        ? { id: existing._id?.toString(), name: existing.name, type: 'skill' }
        : undefined,
      openUrl: existing?._id ? `/skills/${existing._id.toString()}` : undefined,
    };
  }
  if (normalizedKind === 'mcp') {
    const title = getDetailTitle(detail, identifier);
    const name = slugify(
      firstString(detail.slug, detail.identifier, detail.name, title),
      'mcp-server',
    );
    const existing = await findExistingMcpServer({ serverName: name, title, user: req.user });
    if (existing) {
      const missing = await getMissingMcpUserVars({
        config: existing.config,
        serverName: existing.serverName,
        user: req.user,
      });
      if (missing.length > 0) {
        return buildMcpNeedsConfigResponse({
          detail,
          kind: normalizedKind,
          identifier,
          config: existing.config,
          needsConfig: {
            reason: 'mcp_user_variables_required',
            required: missing,
          },
        });
      }
      return {
        kind: normalizedKind,
        identifier,
        status: 'installed',
        local: { serverName: existing.serverName, title: existing.config?.title, type: 'mcp' },
        openUrl: '/c/new',
      };
    }
    const { config, needsConfig } = buildMcpConfig(detail, identifier);
    if (config && getMcpNeedsUserConfig(config)) {
      return buildMcpNeedsConfigResponse({
        detail,
        kind: normalizedKind,
        identifier,
        config,
        needsConfig: {
          reason: 'mcp_user_variables_required',
          required: getMcpConfigUserVarKeys(config),
        },
      });
    }
    if (needsConfig) {
      return buildMcpNeedsConfigResponse({
        detail,
        kind: normalizedKind,
        identifier,
        needsConfig,
      });
    }
    return {
      kind: normalizedKind,
      identifier,
      status: 'not_installed',
    };
  }
  if (normalizedKind === 'agent') {
    const name = getDetailTitle(detail, identifier);
    const existing = await findExistingAgentFromMarket({
      detail,
      identifier,
      name,
      user: req.user,
    });
    return {
      kind: normalizedKind,
      identifier,
      status: existing ? 'installed' : 'not_installed',
      local: existing ? { id: existing.id, name: existing.name, type: 'agent' } : undefined,
      openUrl: existing ? buildAgentChatUrl(existing.id) : undefined,
    };
  }
  const error = new Error(`Unsupported community market kind: ${kind}`);
  error.status = 400;
  throw error;
}

function createCommunityMarketClient(options = {}) {
  let registeredClient;
  let tokenCache;

  const defaultClientName = options.defaultClientName || 'HeZi LibreChat';
  const defaultDeviceIdPrefix = options.defaultDeviceIdPrefix || 'hezi-librechat';
  const defaultVersion = options.defaultVersion || process.env.npm_package_version || '0.1.0';

  async function requestMarket(path, requestOptions = {}) {
    const response = await fetch(`${getMarketBaseUrl()}${path}`, requestOptions);
    const text = await response.text();
    const body = parseMarketResponseBody(text);

    if (!response.ok) {
      const message = getMarketErrorMessage(body, response);
      const error = new Error(message || 'Lobe Market request failed');
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

    const deviceId =
      process.env.LIBRECHAT_MARKET_DEVICE_ID || `${defaultDeviceIdPrefix}-${crypto.randomUUID()}`;
    const result = await requestMarket('/api/v1/clients/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientName: process.env.LIBRECHAT_MARKET_CLIENT_NAME || defaultClientName,
        clientType: 'web',
        deviceId,
        platform: 'web',
        version: defaultVersion,
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

  async function getList(resource, params) {
    const query = buildListQuery(params);
    return requestAuthenticatedMarket(`/api/v1/${resource}?${query.toString()}`);
  }

  async function getCategories(resource, params) {
    const query = buildCategoriesQuery(params);
    return requestAuthenticatedMarket(`/api/v1/${resource}/categories?${query.toString()}`);
  }

  async function getDetail(resource, identifier, params) {
    const query = buildDetailQuery(params);
    return requestAuthenticatedMarket(
      `/api/v1/${resource}/${encodeURIComponent(identifier)}?${query.toString()}`,
    );
  }

  return {
    getAccessToken,
    getAgents: (params) => getList('agents', params),
    getAgentCategories: (params) => getCategories('agents', params),
    getAgentDetail: async (identifier, params) =>
      normalizeDetail(await getDetail('agents', identifier, params), 'agent', identifier),
    getClientCredentials,
    getMcpCategories: (params) => getCategories('plugins', params),
    getMcpDetail: async (identifier, params) =>
      normalizeDetail(await getDetail('plugins', identifier, params), 'mcp', identifier),
    getMcpList: (params) => getList('plugins', params),
    getSkillCategories: (params) => getCategories('skills', params),
    getSkillDetail: async (identifier, params) =>
      normalizeDetail(await getDetail('skills', identifier, params), 'skill', identifier),
    getSkillList: (params) => getList('skills', params),
    getDetail,
    requestAuthenticatedMarket,
    requestMarket,
  };
}

module.exports = {
  createCommunityMarketClient,
  defaultCommunityMarketClient: createCommunityMarketClient(),
  getInstallStatus,
  installMarketItem,
  normalizeDetail,
  __testUtils: {
    buildMcpConfig,
    buildMcpNeedsConfigResponse,
    buildMarketOpenUrl,
    normalizeKind,
  },
};
