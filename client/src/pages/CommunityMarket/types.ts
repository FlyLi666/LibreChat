import type { LucideIcon } from 'lucide-react';

export type MarketKind = 'skill' | 'mcp' | 'agent';
export type CommunitySection = 'home' | MarketKind | 'models' | 'providers';

export type CategoryItem = {
  category?: string;
  count?: number;
  name?: string;
};

export type MarketListResponse<T> = {
  after?: string;
  currentPage?: number;
  data?: T[];
  items?: T[];
  pageSize?: number;
  totalCount?: number;
  totalPages?: number;
};

export type MarketGithub = {
  stars?: number;
  url?: string;
};

export type MarketItem = {
  author?: string;
  category?: string;
  commentCount?: number;
  connectionType?: string;
  content?: string;
  description?: string;
  github?: MarketGithub;
  icon?: string;
  identifier: string;
  installCount?: number;
  installationMethods?: string;
  isFeatured?: boolean;
  isOfficial?: boolean;
  isValidated?: boolean;
  manifest?: MarketManifest;
  readme?: string;
  name: string;
  promptsCount?: number;
  ratingAvg?: number;
  resourcesCount?: number;
  schema?: MarketManifest;
  skillMd?: string;
  sourceUrl?: string;
  systemRole?: string;
  toolsCount?: number;
  updatedAt?: string;
  versions?: MarketManifest[];
};

export type MarketManifest = {
  [key: string]: unknown;
};

export type MarketInstallState =
  | 'uninstalled'
  | 'installing'
  | 'installed'
  | 'needs_config'
  | 'failed';

export type MarketInstallStatus = {
  agentId?: string;
  configUrl?: string;
  conversationId?: string;
  error?: string;
  existing?: boolean;
  local?: {
    id?: string;
    name?: string;
    serverName?: string;
    title?: string;
    type?: MarketKind;
  };
  message?: string;
  openUrl?: string;
  resourceId?: string;
  state: MarketInstallState;
};

export type CuratedCategory = {
  count?: number;
  icon: LucideIcon;
  key: string;
  label: string;
};

export type SortOption = {
  label: string;
  value: string;
};
