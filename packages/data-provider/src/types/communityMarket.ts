export type MarketKind = 'skill' | 'mcp' | 'agent';

export type CommunityMarketCategory = {
  category?: string;
  count?: number;
  name?: string;
} & Record<string, unknown>;

export type CommunityMarketGithub = {
  stars?: number;
  url?: string;
} & Record<string, unknown>;

export type CommunityMarketItem = {
  author?: string;
  category?: string;
  commentCount?: number;
  connectionType?: string;
  description?: string;
  github?: CommunityMarketGithub;
  icon?: string;
  identifier: string;
  installCount?: number;
  installationMethods?: string;
  isFeatured?: boolean;
  isOfficial?: boolean;
  isValidated?: boolean;
  name: string;
  promptsCount?: number;
  ratingAvg?: number;
  resourcesCount?: number;
  toolsCount?: number;
  updatedAt?: string;
} & Record<string, unknown>;

export type CommunityMarketDetail = CommunityMarketItem & {
  content?: string;
  deployment?: Record<string, unknown>;
  install?: Record<string, unknown> | string;
  readme?: string;
  manifest?: Record<string, unknown>;
  raw?: Record<string, unknown>;
  schema?: Record<string, unknown>;
  source?: {
    identifier?: string;
    kind?: MarketKind;
    market?: string;
    url?: string;
  };
  version?: string;
};

export type CommunityMarketListResponse<TItem = CommunityMarketItem> = {
  currentPage?: number;
  items?: TItem[];
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
} & Record<string, unknown>;

export type CommunityMarketQuery = {
  category?: string;
  connectionType?: string;
  locale?: string;
  order?: string;
  page?: number;
  pageSize?: number;
  q?: string;
  search?: string;
  sort?: string;
};

export type CommunityMarketInstallStatus = 'not_installed' | 'installed' | 'needs_config';

export type CommunityMarketLocalInstall = {
  id?: string;
  name?: string;
  serverName?: string;
  title?: string;
  type: MarketKind;
};

export type CommunityMarketInstallStatusResponse = {
  config?: Record<string, unknown>;
  configUrl?: string;
  conversationId?: string;
  deployment?: Record<string, unknown>;
  identifier: string;
  instructions?: string;
  kind: MarketKind;
  local?: CommunityMarketLocalInstall;
  missing?: string[];
  openUrl?: string;
  reason?: string;
  status: CommunityMarketInstallStatus;
  transport?: string;
};

export type CommunityMarketInstallResponse = CommunityMarketInstallStatusResponse & {
  action?: 'created' | 'existing' | 'needs_config';
  source?: Record<string, unknown>;
  transport?: string;
  warnings?: unknown[];
};
