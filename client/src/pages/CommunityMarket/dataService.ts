import { dataService, PermissionBits } from 'librechat-data-provider';
import type {
  CategoryItem,
  MarketInstallStatus,
  MarketItem,
  MarketKind,
  MarketListResponse,
} from './types';

const MARKET_CACHE_PREFIX = 'hezi-community-market-v1';

type CommunityMarketDataService = {
  getCommunityMarketCategories?: (
    kind: MarketKind,
    params: { locale: string; q?: string },
  ) => Promise<CategoryItem[]>;
  getCommunityMarketDetail?: (
    kind: MarketKind,
    identifier: string,
    params: { locale: string },
  ) => Promise<MarketItem>;
  getCommunityMarketItems?: (
    kind: MarketKind,
    params: Record<string, string>,
  ) => Promise<MarketListResponse<MarketItem>>;
  getCommunityMarketInstallStatus?: (
    kind: MarketKind,
    identifier: string,
  ) => Promise<Partial<MarketInstallStatus> | null>;
  installCommunityMarketItem?: (
    kind: MarketKind,
    identifier: string,
  ) => Promise<Partial<MarketInstallStatus> | null>;
};

type AgentListItem = {
  agent_id?: unknown;
  avatar?: unknown;
  category?: string;
  created_at?: string;
  description?: string;
  id?: unknown;
  name?: string;
  projectIds?: string[];
  tool_resources?: unknown;
  updated_at?: string;
};

type AgentListResponse = {
  after?: string;
  data?: AgentListItem[];
};

const communityDataService = dataService as typeof dataService & CommunityMarketDataService;

type RawMarketItem = Omit<MarketItem, 'author' | 'icon'> & {
  author?: MarketItem['author'] | { name?: string; userName?: string };
  avatar?: unknown;
  config?: {
    openingMessage?: string;
    openingQuestions?: string[];
    systemRole?: string;
  };
  category?: unknown;
  content?: unknown;
  description?: unknown;
  icon?: unknown;
  identifier?: unknown;
  knowledgeCount?: number;
  name?: unknown;
  pluginCount?: number;
  readme?: unknown;
  skillMd?: unknown;
  sourceUrl?: unknown;
  systemRole?: unknown;
  url?: string;
};

type RawMarketInstallStatus = Partial<MarketInstallStatus> & {
  configRequired?: boolean;
  failureReason?: string;
  installed?: boolean;
  needsConfig?: boolean;
  status?: string;
};

function normalizeInstallState(value?: string): MarketInstallStatus['state'] {
  if (
    value === 'installed' ||
    value === 'needs_config' ||
    value === 'failed' ||
    value === 'installing'
  ) {
    return value;
  }
  return 'uninstalled';
}

function normalizeInstallStatus(value?: RawMarketInstallStatus | null): MarketInstallStatus {
  if (!value) {
    return { state: 'uninstalled' };
  }

  let state = normalizeInstallState(value.state ?? value.status);
  if (value.installed === true) {
    state = 'installed';
  }
  if (value.needsConfig === true || value.configRequired === true) {
    state = 'needs_config';
  }

  return {
    ...value,
    error: value.error || value.failureReason,
    state,
  };
}

function isLocalDev() {
  return ['127.0.0.1', 'localhost'].includes(window.location.hostname);
}

function getErrorStatus(error: unknown) {
  if (typeof error === 'object' && error) {
    const maybeResponse = 'response' in error ? error.response : undefined;
    if (typeof maybeResponse === 'object' && maybeResponse && 'status' in maybeResponse) {
      return Number(maybeResponse.status);
    }
    if ('status' in error) {
      return Number(error.status);
    }
  }
  return undefined;
}

function shouldUseLocalInstallFallback(error: unknown) {
  return isLocalDev() && getErrorStatus(error) === 404;
}

function slugify(value: string | undefined, fallback: string) {
  const slug = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

function toSkillBody(detail: MarketItem) {
  const title = detail.name || detail.identifier;
  return [
    `# ${title}`,
    '',
    '## When to use',
    '',
    detail.description || `Use this skill for tasks related to ${title}.`,
    '',
    '## Instructions',
    '',
    detail.skillMd ||
      detail.readme ||
      detail.content ||
      detail.description ||
      `Use the ${title} skill.`,
    detail.sourceUrl ? ['', `Source: ${detail.sourceUrl}`].join('\n') : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function getMcpConfigUrl(identifier: string) {
  return `/community/mcp/${encodeURIComponent(identifier)}?activeTab=deployment`;
}

function getMaybeUrl(value: unknown) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : undefined;
}

function getMcpRuntimeUrl(detail: MarketItem) {
  const raw = detail as MarketItem & {
    deploymentOptions?: Array<{ url?: string; endpoint?: string }>;
    homepage?: string;
    url?: string;
  };
  return (
    getMaybeUrl(raw.url) ||
    getMaybeUrl(raw.manifest?.url) ||
    getMaybeUrl(raw.schema?.url) ||
    getMaybeUrl(raw.deploymentOptions?.find((option) => getMaybeUrl(option.url))?.url) ||
    getMaybeUrl(raw.deploymentOptions?.find((option) => getMaybeUrl(option.endpoint))?.endpoint)
  );
}

async function installSkillWithExistingApi(identifier: string): Promise<MarketInstallStatus> {
  const detail = await getMarketDetail('skill', identifier, navigator.language || 'zh-CN');
  const name = slugify(detail.identifier || identifier, 'market-skill');
  const list = await dataService.listSkills({ search: name, limit: 50 });
  const existing = list.skills?.find((skill) => skill.name === name);
  if (existing) {
    return {
      local: { id: existing._id, name: existing.name, type: 'skill' },
      openUrl: `/skills/${existing._id}`,
      state: 'installed',
    };
  }

  const skill = await dataService.createSkill({
    name,
    displayTitle: detail.name,
    description: detail.description || `Installed from LobeHub Market: ${detail.name}`,
    body: toSkillBody(detail),
    frontmatter: {
      'user-invocable': true,
    },
    category: detail.category || 'Community Market',
    alwaysApply: false,
  });

  return {
    local: { id: skill._id, name: skill.name, type: 'skill' },
    openUrl: `/skills/${skill._id}`,
    state: 'installed',
  };
}

async function installMcpWithExistingApi(identifier: string): Promise<MarketInstallStatus> {
  const detail = await getMarketDetail('mcp', identifier, navigator.language || 'zh-CN');
  const serverName = slugify(detail.identifier || identifier, 'mcp-server');
  const servers = await dataService.getMCPServers();
  const existing = servers[serverName];
  if (existing) {
    return {
      local: { serverName, title: existing.config?.title, type: 'mcp' },
      openUrl: '/c/new',
      state: 'installed',
    };
  }

  const url = getMcpRuntimeUrl(detail);
  if (!url) {
    return {
      configUrl: getMcpConfigUrl(identifier),
      error: 'This MCP requires explicit runtime configuration before it can be installed.',
      state: 'needs_config',
    };
  }

  const created = await dataService.createMCPServer({
    config: {
      type: 'streamable-http',
      title: detail.name,
      description: detail.description,
      url,
      iconPath: detail.icon,
      startup: false,
      chatMenu: true,
    },
  });

  return {
    local: { serverName: created.serverName, title: created.config?.title, type: 'mcp' },
    openUrl: '/c/new',
    state: 'installed',
  };
}

async function installAgentWithExistingApi(identifier: string): Promise<MarketInstallStatus> {
  const detail = await getMarketDetail('agent', identifier, navigator.language || 'zh-CN');
  const list = await dataService.listAgents({
    search: detail.name || identifier,
    limit: 50,
    requiredPermission: PermissionBits.EDIT,
  });
  const existing = list.data?.find((agent) => agent.name === detail.name);
  if (existing) {
    return {
      local: { id: existing.id, name: existing.name, type: 'agent' },
      openUrl: `/c/new?agent_id=${encodeURIComponent(existing.id)}`,
      state: 'installed',
    };
  }

  const agent = await dataService.createAgent({
    name: detail.name,
    description: detail.description,
    instructions: detail.systemRole || detail.content || detail.readme || detail.description,
    avatar: detail.icon ? { filepath: detail.icon, source: 'url' } : null,
    provider: 'openAI',
    model: 'gpt-4o-mini',
    model_parameters: {},
    tools: [],
    category: detail.category || 'Community Market',
    support_contact: { name: 'LobeHub Market', email: '' },
  });

  return {
    local: { id: agent.id, name: agent.name, type: 'agent' },
    openUrl: `/c/new?agent_id=${encodeURIComponent(agent.id)}`,
    state: 'installed',
  };
}

async function installWithExistingApi(
  kind: MarketKind,
  identifier: string,
): Promise<MarketInstallStatus> {
  if (kind === 'skill') {
    return installSkillWithExistingApi(identifier);
  }
  if (kind === 'mcp') {
    return installMcpWithExistingApi(identifier);
  }
  return installAgentWithExistingApi(identifier);
}

async function fetchMarket<T>(path: string, params: URLSearchParams): Promise<T> {
  const requestPath = `/api/community-market/${path}?${params.toString()}`;
  const cacheKey = `${MARKET_CACHE_PREFIX}:${requestPath}`;
  const cached = window.localStorage.getItem(cacheKey);

  if (cached) {
    try {
      return JSON.parse(cached) as T;
    } catch {
      window.localStorage.removeItem(cacheKey);
    }
  }

  const response = await fetch(
    isLocalDev() ? `http://127.0.0.1:3082${requestPath}` : requestPath,
    isLocalDev() ? undefined : { credentials: 'include' },
  );

  if (!response.ok) {
    const error = new Error(await response.text()) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const data = (await response.json()) as T;
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(data));
  } catch {
    // React Query still keeps this request in memory when storage is full.
  }
  return data;
}

function endpointForKind(kind: MarketKind) {
  if (kind === 'skill') {
    return 'skills';
  }
  if (kind === 'agent') {
    return 'agents';
  }
  return 'mcp';
}

function paramsToObject(params: URLSearchParams) {
  return Object.fromEntries(params.entries());
}

function getAgentIdentifier(agent: AgentListItem) {
  if (typeof agent.agent_id === 'string') {
    return agent.agent_id;
  }
  if (typeof agent.id === 'string') {
    return agent.id;
  }
  return agent.name || 'agent';
}

function getAgentIcon(agent: AgentListItem) {
  if (typeof agent.avatar === 'string') {
    return agent.avatar;
  }
  if (typeof agent.avatar === 'object' && agent.avatar && 'filepath' in agent.avatar) {
    return String(agent.avatar.filepath);
  }
  return undefined;
}

function normalizeIcon(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value && 'filepath' in value) {
    return String(value.filepath);
  }
  return undefined;
}

function normalizeAuthor(value: RawMarketItem['author']) {
  if (!value) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  return value.name || value.userName;
}

function normalizeText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const found = value.map((item) => normalizeText(item)).find(Boolean);
    return found || fallback;
  }
  if (typeof value === 'object' && value) {
    const record = value as Record<string, unknown>;
    const priorityKeys = [
      'zh-CN',
      'zh_CN',
      'zh-Hans',
      'zhHans',
      'zh',
      'cn',
      'en-US',
      'en_US',
      'en',
      'default',
      'name',
      'title',
      'label',
      'description',
      'summary',
    ];
    for (const key of priorityKeys) {
      const normalized = normalizeText(record[key]);
      if (normalized) {
        return normalized;
      }
    }
    const found = Object.values(record)
      .map((item) => normalizeText(item))
      .find(Boolean);
    return found || fallback;
  }
  return fallback;
}

function normalizeOptionalText(value: unknown) {
  const normalized = normalizeText(value);
  return normalized || undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizeMarketItem(item: RawMarketItem): MarketItem {
  const identifier = normalizeText(item.identifier, 'market-item');
  const name = normalizeText(item.name, identifier);

  return {
    ...item,
    author: normalizeAuthor(item.author),
    category: normalizeOptionalText(item.category),
    commentCount: normalizeNumber(item.commentCount),
    content: normalizeOptionalText(item.content ?? item.config?.openingMessage),
    description: normalizeOptionalText(item.description),
    icon: normalizeIcon(item.icon ?? item.avatar),
    identifier,
    installCount: normalizeNumber(item.installCount),
    name,
    promptsCount: normalizeNumber(item.promptsCount),
    ratingAvg: normalizeNumber(item.ratingAvg),
    readme: normalizeOptionalText(item.readme),
    resourcesCount: item.resourcesCount ?? item.knowledgeCount,
    skillMd: normalizeOptionalText(item.skillMd),
    sourceUrl: normalizeOptionalText(item.sourceUrl || item.url),
    systemRole: normalizeOptionalText(item.systemRole ?? item.config?.systemRole),
    toolsCount: item.toolsCount ?? item.pluginCount,
    updatedAt: normalizeOptionalText(item.updatedAt),
  };
}

function normalizeCategoryItem(item: CategoryItem): CategoryItem {
  return {
    ...item,
    category: normalizeOptionalText(item.category),
    count: normalizeNumber(item.count),
    name: normalizeOptionalText(item.name),
  };
}

function normalizeMarketList(
  response: MarketListResponse<RawMarketItem>,
): MarketListResponse<MarketItem> {
  return {
    ...response,
    data: response.data?.map(normalizeMarketItem),
    items: response.items?.map(normalizeMarketItem),
  };
}

function mapAgentToMarketItem(agent: AgentListItem): MarketItem {
  const identifier = getAgentIdentifier(agent);
  const icon = getAgentIcon(agent);

  return {
    author: 'LibreChat',
    category: agent.category,
    description: agent.description,
    icon,
    identifier,
    installCount: 0,
    name: agent.name || identifier,
    resourcesCount: Array.isArray(agent.projectIds) ? agent.projectIds.length : 0,
    sourceUrl: '',
    toolsCount: agent.tool_resources ? 1 : 0,
    updatedAt: agent.updated_at || agent.created_at,
  };
}

function getListItems(response: AgentListResponse): MarketItem[] {
  return (response.data ?? []).map(mapAgentToMarketItem);
}

export async function getMarketList(
  kind: MarketKind,
  params: URLSearchParams,
): Promise<MarketListResponse<MarketItem>> {
  if (!isLocalDev() && communityDataService.getCommunityMarketItems) {
    const response = await communityDataService.getCommunityMarketItems(
      kind,
      paramsToObject(params),
    );
    return normalizeMarketList(response as MarketListResponse<RawMarketItem>);
  }

  if (!isLocalDev() && kind === 'agent') {
    const response = (await dataService.getMarketplaceAgents({
      category: params.get('category') || undefined,
      limit: Number(params.get('pageSize') || 24),
      requiredPermission: PermissionBits.VIEW,
      search: params.get('q') || undefined,
    })) as unknown as AgentListResponse;
    const items = getListItems(response);
    return {
      after: response.after,
      currentPage: Number(params.get('page') || 1),
      items,
      pageSize: Number(params.get('pageSize') || 24),
      totalCount: items.length,
      totalPages: response.after
        ? Number(params.get('page') || 1) + 1
        : Number(params.get('page') || 1),
    };
  }

  const response = await fetchMarket<MarketListResponse<RawMarketItem>>(
    endpointForKind(kind),
    params,
  );
  return normalizeMarketList(response);
}

export async function getMarketCategories(
  kind: MarketKind,
  locale: string,
): Promise<CategoryItem[]> {
  if (!isLocalDev() && communityDataService.getCommunityMarketCategories) {
    const categories = await communityDataService.getCommunityMarketCategories(kind, { locale });
    return categories.map(normalizeCategoryItem);
  }

  if (!isLocalDev() && kind === 'agent') {
    const categories = await dataService.getAgentCategories();
    return categories.map((item) => ({
      category: item.value || item.label,
      count: item.count,
      name: item.label,
    }));
  }

  return fetchMarket<CategoryItem[]>(
    `${endpointForKind(kind)}/categories`,
    new URLSearchParams({ locale }),
  );
}

export async function getMarketDetail(
  kind: MarketKind,
  identifier: string,
  locale: string,
): Promise<MarketItem | null> {
  if (!isLocalDev() && communityDataService.getCommunityMarketDetail) {
    const detail = await communityDataService.getCommunityMarketDetail(kind, identifier, {
      locale,
    });
    return normalizeMarketItem(detail as RawMarketItem);
  }

  if (!isLocalDev() && kind === 'agent') {
    try {
      const agent = (await dataService.getAgentById({
        agent_id: identifier,
      })) as unknown as AgentListItem;
      return mapAgentToMarketItem(agent);
    } catch {
      return null;
    }
  }

  let response: RawMarketItem;
  try {
    response = await fetchMarket<RawMarketItem>(
      `${endpointForKind(kind)}/${encodeURIComponent(identifier)}`,
      new URLSearchParams({ locale }),
    );
  } catch (error) {
    if (kind !== 'agent' || getErrorStatus(error) !== 404) {
      throw error;
    }
    const list = await fetchMarket<MarketListResponse<RawMarketItem>>(
      endpointForKind(kind),
      new URLSearchParams({ locale, pageSize: '24', q: identifier }),
    );
    response =
      (list.items ?? list.data ?? []).find((item) => item.identifier === identifier) ??
      (list.items ?? list.data ?? [])[0];
    if (!response) {
      throw error;
    }
  }
  return normalizeMarketItem(response);
}

export async function getMarketInstallStatus(
  kind: MarketKind,
  identifier: string,
): Promise<MarketInstallStatus> {
  if (!communityDataService.getCommunityMarketInstallStatus) {
    return { state: 'uninstalled' };
  }

  return normalizeInstallStatus(
    await communityDataService.getCommunityMarketInstallStatus(kind, identifier),
  );
}

export async function installMarketItem(
  kind: MarketKind,
  identifier: string,
): Promise<MarketInstallStatus> {
  if (!communityDataService.installCommunityMarketItem) {
    return installWithExistingApi(kind, identifier);
  }

  try {
    return normalizeInstallStatus(
      await communityDataService.installCommunityMarketItem(kind, identifier),
    );
  } catch (error) {
    if (shouldUseLocalInstallFallback(error)) {
      return installWithExistingApi(kind, identifier);
    }
    throw error;
  }
}
