/* eslint-disable i18next/no-literal-string */
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { QueryKeys } from 'librechat-data-provider';
import {
  BadgeCheck,
  BookOpenText,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileJson,
  FileText,
  Hammer,
  Loader2,
  Play,
  RotateCcw,
  Settings,
  Star,
  Terminal,
  UserRound,
  Wrench,
  X,
} from 'lucide-react';
import { Button, Skeleton } from '@librechat/client';
import MarketIcon from './MarketIcon';
import { getMarketInstallStatus, installMarketItem } from '../dataService';
import { formatCount, formatDate, getSourceUrl } from '../utils';
import type { ReactNode } from 'react';
import type {
  MarketInstallState,
  MarketInstallStatus,
  MarketItem,
  MarketKind,
  MarketManifest,
} from '../types';
import { cn } from '~/utils';

type DetailTab = {
  id: string;
  label: string;
};

const EMPTY_STATUS: MarketInstallStatus = { state: 'uninstalled' };

function invalidateInstalledResourceQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  kind: MarketKind,
) {
  if (kind === 'skill') {
    queryClient.invalidateQueries([QueryKeys.skills]);
    queryClient.invalidateQueries([QueryKeys.skillStates]);
    return;
  }
  if (kind === 'mcp') {
    queryClient.invalidateQueries([QueryKeys.mcpServers]);
    queryClient.invalidateQueries([QueryKeys.mcpTools]);
    queryClient.invalidateQueries([QueryKeys.mcpConnectionStatus]);
    queryClient.invalidateQueries([QueryKeys.effectivePermissions]);
    return;
  }
  queryClient.invalidateQueries([QueryKeys.agents]);
  queryClient.invalidateQueries([QueryKeys.agent]);
  queryClient.invalidateQueries([QueryKeys.marketplaceAgents]);
}

function getKindLabel(kind: MarketKind) {
  if (kind === 'skill') {
    return 'Skill';
  }
  if (kind === 'mcp') {
    return 'MCP';
  }
  return 'Agent';
}

function getPrimaryActionLabel(kind: MarketKind, state: MarketInstallState) {
  if (state === 'installing') {
    return '安装中...';
  }
  if (state === 'failed') {
    return '重试';
  }
  if (state === 'needs_config') {
    return kind === 'mcp' ? '配置 MCP 服务' : '继续配置';
  }
  if (state === 'installed') {
    if (kind === 'agent') {
      return '打开';
    }
    return '打开';
  }
  if (kind === 'mcp') {
    return '添加 MCP 服务';
  }
  if (kind === 'agent') {
    return 'Fork and Chat';
  }
  return '安装 Skill';
}

function getSecondaryActionLabel(kind: MarketKind, state: MarketInstallState) {
  if (state === 'needs_config') {
    return '查看缺失配置';
  }
  if (kind === 'mcp') {
    return '查看 Schema';
  }
  if (kind === 'agent') {
    return state === 'installed' ? '本地聊天' : '查看 System Role';
  }
  return '复制 CLI 命令';
}

function getStatusText(kind: MarketKind, status: MarketInstallStatus) {
  if (status.state === 'installed') {
    if (status.existing) {
      return '已存在，使用现有安装。';
    }
    return kind === 'agent' ? '已添加，可打开本地聊天。' : '已安装。';
  }
  if (status.state === 'needs_config') {
    return '已添加，但缺少配置，配置完成前不会假装可用。';
  }
  if (status.state === 'failed') {
    return status.error || status.message || '安装失败，可以重试。';
  }
  return '尚未安装。';
}

function StatusIcon({ state }: { state: MarketInstallState }) {
  if (state === 'installed') {
    return <CheckCircle2 className="h-5 w-5 text-green-400" />;
  }
  if (state === 'failed') {
    return <RotateCcw className="h-5 w-5 text-red-300" />;
  }
  if (state === 'installing') {
    return <Loader2 className="h-5 w-5 animate-spin text-white" />;
  }
  return <Settings className="h-5 w-5 text-text-tertiary" />;
}

function PrimaryActionIcon({ kind, state }: { kind: MarketKind; state: MarketInstallState }) {
  if (state === 'installing') {
    return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
  }
  if (kind === 'agent' && state === 'installed') {
    return <Play className="mr-2 h-4 w-4" />;
  }
  return <Download className="mr-2 h-4 w-4" />;
}

function SecondaryActionIcon({ kind }: { kind: MarketKind }) {
  if (kind === 'skill') {
    return <Copy className="mr-2 h-4 w-4" />;
  }
  if (kind === 'mcp') {
    return <FileJson className="mr-2 h-4 w-4" />;
  }
  return <BookOpenText className="mr-2 h-4 w-4" />;
}

function getRatingValue(item: MarketItem | null) {
  if (item?.ratingAvg) {
    return item.ratingAvg.toFixed(1);
  }
  if (item?.github?.stars) {
    return formatCount(item.github.stars);
  }
  return '0';
}

function getDetailTabs(kind: MarketKind): DetailTab[] {
  if (kind === 'skill') {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'installation', label: 'Installation' },
      { id: 'skill', label: 'SKILL.md' },
      { id: 'resources', label: 'Resources' },
      { id: 'versions', label: 'Versions' },
    ];
  }
  if (kind === 'mcp') {
    return [
      { id: 'overview', label: 'Overview' },
      { id: 'deployment', label: 'Deployment' },
      { id: 'schema', label: 'Schema' },
      { id: 'resources', label: 'Resources' },
      { id: 'versions', label: 'Related' },
    ];
  }
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'installation', label: 'Installation' },
    { id: 'system', label: 'System Role' },
    { id: 'resources', label: 'Capabilities' },
    { id: 'versions', label: 'Related' },
  ];
}

function getManifestRecord(item: MarketItem | null, key: string): MarketManifest | undefined {
  const value = item?.manifest?.[key];
  if (typeof value === 'object' && value && !Array.isArray(value)) {
    return value as MarketManifest;
  }
  return undefined;
}

function getTextFromManifest(item: MarketItem | null, keys: string[]) {
  const direct = keys
    .map((key) => item?.[key as keyof MarketItem])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  if (direct) {
    return direct;
  }

  return keys
    .map((key) => item?.manifest?.[key])
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
}

function stringifyBlock(value: unknown) {
  if (value == null || value === '') {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value, null, 2);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '';
}

function getSchemaValue(item: MarketItem | null) {
  return (
    item?.schema ??
    getManifestRecord(item, 'schema') ??
    getManifestRecord(item, 'inputSchema') ??
    getManifestRecord(item, 'configSchema') ??
    item?.manifest
  );
}

function getResourceValue(item: MarketItem | null, kind: MarketKind) {
  if (!item) {
    return undefined;
  }
  if (kind === 'agent') {
    return item.manifest?.capabilities ?? item.manifest?.tools ?? item.manifest?.plugins;
  }
  if (kind === 'mcp') {
    return item.manifest?.deployment ?? item.manifest?.resources ?? item.manifest?.tools;
  }
  return item.manifest?.resources ?? item.manifest?.files ?? item.manifest?.tools;
}

function getVersionsValue(item: MarketItem | null) {
  return item?.versions ?? item?.manifest?.versions ?? item?.manifest?.related;
}

function getCodeInstallCommands(identifier: string) {
  return [
    {
      label: 'Codex',
      command: `npx -y @lobehub/market-cli skills install ${identifier} --agent codex`,
    },
    {
      label: 'Claude Code',
      command: `npx -y @lobehub/market-cli skills install ${identifier} --agent claude-code`,
    },
    {
      label: 'Cursor',
      command: `npx -y @lobehub/market-cli skills install ${identifier} --agent cursor`,
    },
    {
      label: 'Cline',
      command: `npx -y @lobehub/market-cli skills install ${identifier} --agent cline`,
    },
  ];
}

function InfoPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border-light bg-surface-secondary px-2.5 py-1 text-xs text-text-secondary">
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
      <div className="text-xs text-text-tertiary">{label}</div>
      <div className="mt-1 text-sm font-semibold text-text-primary">{value}</div>
    </div>
  );
}

function CodeBlock({ value }: { value: string }) {
  return (
    <pre className="max-h-[360px] overflow-auto rounded-lg border border-border-light bg-surface-secondary p-4 text-xs leading-5 text-text-secondary">
      <code>{value || '暂无内容。'}</code>
    </pre>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
    </section>
  );
}

function OverviewTab({
  item,
  kind,
  sourceUrl,
}: {
  item: MarketItem | null;
  kind: MarketKind;
  sourceUrl: string;
}) {
  const resourceValue = kind === 'skill' ? (item?.resourcesCount || 0) + 1 : item?.toolsCount;

  return (
    <div className="space-y-4">
      <Section title="Overview">
        <p className="text-sm leading-6 text-text-secondary">
          {item?.description || '这个条目暂时没有介绍。'}
        </p>
      </Section>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="安装" value={formatCount(item?.installCount)} />
        <Stat label="更新" value={formatDate(item?.updatedAt)} />
        <Stat label={kind === 'skill' ? '资源' : '工具'} value={formatCount(resourceValue)} />
        <Stat label="评分 / 星标" value={getRatingValue(item)} />
      </div>
      <Section title="来源">
        {sourceUrl ? (
          <a
            className="inline-flex max-w-full items-center gap-2 truncate text-sm text-text-secondary hover:text-text-primary"
            href={sourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span className="truncate">{sourceUrl}</span>
          </a>
        ) : (
          <span className="text-sm text-text-secondary">LibreChat Agent Marketplace</span>
        )}
      </Section>
    </div>
  );
}

function InstallationTab({
  identifier,
  item,
  kind,
}: {
  identifier: string;
  item: MarketItem | null;
  kind: MarketKind;
}) {
  if (kind === 'mcp') {
    return (
      <div className="space-y-4">
        <Section title="配置说明">
          <p className="text-sm leading-6 text-text-secondary">
            MCP 服务安装后仍可能需要环境变量、OAuth 或本地命令。状态是 needs_config
            时，服务不会被当成可用工具注入。
          </p>
        </Section>
        <CodeBlock
          value={stringifyBlock(item?.installationMethods || item?.manifest?.deployment)}
        />
      </div>
    );
  }

  if (kind === 'agent') {
    return (
      <div className="space-y-4">
        <Section title="安装后动作">
          <p className="text-sm leading-6 text-text-secondary">
            添加后进入本地 Agent 聊天；如果 API 返回 existing，前端会显示已存在并打开现有条目。
          </p>
        </Section>
        <CodeBlock value={stringifyBlock(item?.installationMethods || item?.manifest?.install)} />
      </div>
    );
  }

  const prompt = `Install the "${identifier}" Skill from LobeHub Market, then use it when the user's task matches its description.`;

  return (
    <div className="space-y-4">
      <Section title="Agent prompt">
        <CodeBlock value={prompt} />
      </Section>
      <Section title="Human CLI">
        <div className="space-y-3">
          {getCodeInstallCommands(identifier).map((command) => (
            <div
              key={command.label}
              className="rounded-lg border border-border-light bg-surface-secondary p-3"
            >
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-text-primary">
                <Terminal className="h-3.5 w-3.5" />
                {command.label}
              </div>
              <CodeBlock value={command.command} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function DetailSpecificTab({ item, kind }: { item: MarketItem | null; kind: MarketKind }) {
  if (kind === 'skill') {
    const value = getTextFromManifest(item, ['skillMd', 'readme', 'content']) || '';
    return <CodeBlock value={value} />;
  }
  if (kind === 'mcp') {
    return <CodeBlock value={stringifyBlock(getSchemaValue(item))} />;
  }
  const role =
    getTextFromManifest(item, ['systemRole', 'systemPrompt', 'instructions', 'prompt']) ||
    stringifyBlock(item?.manifest?.systemRole);
  return <CodeBlock value={role} />;
}

function ResourcesTab({
  item,
  kind,
  status,
}: {
  item: MarketItem | null;
  kind: MarketKind;
  status: MarketInstallStatus;
}) {
  if (kind === 'mcp' && status.state === 'needs_config') {
    return (
      <div className="space-y-4">
        <Section title="配置缺失">
          <p className="text-sm leading-6 text-text-secondary">
            当前服务已添加但缺配置。请补齐 Schema 要求的变量、OAuth 或本地启动命令后再使用。
          </p>
        </Section>
        <CodeBlock value={stringifyBlock(getResourceValue(item, kind))} />
      </div>
    );
  }

  return <CodeBlock value={stringifyBlock(getResourceValue(item, kind))} />;
}

function VersionsTab({ item }: { item: MarketItem | null }) {
  const value = stringifyBlock(getVersionsValue(item));
  return (
    <div className="space-y-4">
      <Section title="版本与关联">
        <CodeBlock value={value || '暂无版本或关联条目。'} />
      </Section>
    </div>
  );
}

function TabPanel({
  activeTab,
  identifier,
  item,
  kind,
  sourceUrl,
  status,
}: {
  activeTab: string;
  identifier: string;
  item: MarketItem | null;
  kind: MarketKind;
  sourceUrl: string;
  status: MarketInstallStatus;
}) {
  if (activeTab === 'installation' || activeTab === 'deployment') {
    return <InstallationTab identifier={identifier} item={item} kind={kind} />;
  }
  if (activeTab === 'skill' || activeTab === 'schema' || activeTab === 'system') {
    return <DetailSpecificTab item={item} kind={kind} />;
  }
  if (activeTab === 'resources') {
    return <ResourcesTab item={item} kind={kind} status={status} />;
  }
  if (activeTab === 'versions') {
    return <VersionsTab item={item} />;
  }
  return <OverviewTab item={item} kind={kind} sourceUrl={sourceUrl} />;
}

export default function DetailPanel({
  identifier,
  isLoading,
  item,
  kind,
  onClose,
}: {
  identifier?: string;
  isLoading: boolean;
  item: MarketItem | null;
  kind: MarketKind;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const tabs = useMemo(() => getDetailTabs(kind), [kind]);
  const defaultTab = tabs[0]?.id || 'overview';
  const activeTabParam = searchParams.get('activeTab');
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [actionNotice, setActionNotice] = useState('');

  useEffect(() => {
    const nextTab = tabs.some((tab) => tab.id === activeTabParam) ? activeTabParam : defaultTab;
    setActiveTab(nextTab ?? defaultTab);
    if (identifier && activeTabParam && nextTab !== activeTabParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('activeTab');
      setSearchParams(next, { replace: true });
    }
  }, [activeTabParam, defaultTab, identifier, searchParams, setSearchParams, tabs]);

  useEffect(() => {
    setActionNotice('');
  }, [identifier, kind]);

  useEffect(() => {
    if (!identifier) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [identifier, onClose]);

  const statusQuery = useQuery<MarketInstallStatus>(
    ['community-market-install-status', kind, identifier],
    () => getMarketInstallStatus(kind, identifier ?? ''),
    {
      enabled: Boolean(identifier),
      staleTime: 1000 * 30,
    },
  );

  const installMutation = useMutation(() => installMarketItem(kind, identifier ?? ''), {
    onSuccess: (nextStatus) => {
      queryClient.setQueryData(['community-market-install-status', kind, identifier], nextStatus);
      invalidateInstalledResourceQueries(queryClient, kind);
      setActionNotice(
        nextStatus.state === 'needs_config'
          ? '已添加，继续补齐配置后可用。'
          : '安装完成，状态已同步。',
      );
    },
    onError: (error) => {
      setActionNotice(getErrorMessage(error) || '安装失败，可以重试。');
    },
  });

  if (!identifier) {
    return null;
  }

  const sourceUrl = item ? getSourceUrl(item, kind) : '';
  const title = item?.name || identifier;
  const category = item?.category || '未分类';
  let installStatus: MarketInstallStatus = installMutation.data ?? statusQuery.data ?? EMPTY_STATUS;
  if (installMutation.isLoading) {
    installStatus = { ...EMPTY_STATUS, state: 'installing' };
  } else if (installMutation.isError) {
    installStatus = {
      error: getErrorMessage(installMutation.error),
      state: 'failed',
    };
  }
  const primaryLabel = getPrimaryActionLabel(kind, installStatus.state);
  const secondaryLabel = getSecondaryActionLabel(kind, installStatus.state);
  const isPrimaryDisabled = installStatus.state === 'installing';

  const openInstalled = (status: MarketInstallStatus) => {
    if (status.openUrl) {
      window.location.assign(status.openUrl);
      return;
    }
    if (status.conversationId) {
      navigate(`/c/${status.conversationId}`);
      return;
    }
    navigate('/c/new');
  };

  const handlePrimaryAction = () => {
    setActionNotice('');
    if (installStatus.state === 'installed') {
      openInstalled(installStatus);
      return;
    }
    if (installStatus.state === 'needs_config' && installStatus.configUrl) {
      window.location.assign(installStatus.configUrl);
      return;
    }
    if (installStatus.state === 'needs_config') {
      handleTabChange(kind === 'mcp' ? 'deployment' : 'resources');
      return;
    }
    installMutation.mutate();
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setActionNotice('');
    const next = new URLSearchParams(searchParams);
    if (tabId === defaultTab) {
      next.delete('activeTab');
    } else {
      next.set('activeTab', tabId);
    }
    setSearchParams(next, { replace: true });
  };

  const handleSecondaryAction = async () => {
    if (kind === 'skill') {
      await navigator.clipboard.writeText(getCodeInstallCommands(identifier)[0]?.command || '');
      setActionNotice('CLI 命令已复制。');
      return;
    }
    if (kind === 'agent') {
      if (installStatus.state === 'installed') {
        openInstalled(installStatus);
        return;
      }
      handleTabChange('system');
      return;
    }
    handleTabChange(installStatus.state === 'needs_config' ? 'resources' : 'schema');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 py-4 backdrop-blur-sm sm:px-6 md:items-center md:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-market-detail-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="flex max-h-[calc(100vh-2rem)] w-full max-w-[1180px] flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary text-text-primary shadow-2xl md:max-h-[min(860px,calc(100vh-4rem))]">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-light px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-secondary">
            <span>Community Market</span>
            <ChevronRight className="h-4 w-4" />
            <span className="truncate text-text-primary">{title}</span>
          </div>
          <button
            className="rounded-lg p-2 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
            aria-label="关闭详情"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoading && !item ? (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
              <div className="space-y-4">
                <Skeleton className="h-24 rounded-lg" />
                <Skeleton className="h-12 rounded-lg" />
                <Skeleton className="h-72 rounded-lg" />
              </div>
              <Skeleton className="h-96 rounded-lg" />
            </div>
          ) : (
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-6">
              <div className="min-w-0 space-y-5">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary text-text-primary ring-1 ring-border-light">
                    {item ? (
                      <MarketIcon item={item} />
                    ) : (
                      <span className="text-lg font-semibold">?</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <InfoPill>{getKindLabel(kind)}</InfoPill>
                      <InfoPill>{category}</InfoPill>
                      {item?.isOfficial ? (
                        <InfoPill>
                          <BadgeCheck className="h-3.5 w-3.5" />
                          官方
                        </InfoPill>
                      ) : null}
                      {item?.isValidated ? <InfoPill>已验证</InfoPill> : null}
                    </div>
                    <h2
                      id="community-market-detail-title"
                      className="text-2xl font-semibold text-text-primary"
                    >
                      {title}
                    </h2>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-text-tertiary">
                      {item?.author ? (
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="h-4 w-4" />
                          {item.author}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1.5">
                        <Star className="h-4 w-4" />
                        {getRatingValue(item)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarClock className="h-4 w-4" />
                        {formatDate(item?.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto border-b border-border-light pb-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      className={cn(
                        'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        activeTab === tab.id
                          ? 'bg-surface-active-alt text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                      )}
                      onClick={() => handleTabChange(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <TabPanel
                  activeTab={activeTab}
                  identifier={identifier}
                  item={item}
                  kind={kind}
                  sourceUrl={sourceUrl}
                  status={installStatus}
                />
              </div>
              <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
                <section className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">安装状态</div>
                      <div className="mt-1 text-xs text-text-tertiary">
                        {getStatusText(kind, installStatus)}
                      </div>
                    </div>
                    <StatusIcon state={installStatus.state} />
                  </div>
                  <div className="grid gap-2">
                    <Button
                      className="rounded-lg"
                      disabled={isPrimaryDisabled}
                      onClick={handlePrimaryAction}
                    >
                      <PrimaryActionIcon kind={kind} state={installStatus.state} />
                      {primaryLabel}
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-lg"
                      onClick={handleSecondaryAction}
                    >
                      <SecondaryActionIcon kind={kind} />
                      {secondaryLabel}
                    </Button>
                  </div>
                  {installStatus.state === 'needs_config' ? (
                    <div className="mt-3 rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-100">
                      缺配置时只展示待办，不把服务注入可用工具列表。
                    </div>
                  ) : null}
                  {actionNotice ? (
                    <div
                      className="mt-3 rounded-lg border border-border-light bg-surface-secondary p-3 text-xs leading-5 text-text-secondary"
                      role="status"
                    >
                      {actionNotice}
                    </div>
                  ) : null}
                </section>
                <section className="rounded-lg border border-border-light bg-surface-primary-alt p-4">
                  <div className="mb-3 text-sm font-semibold text-text-primary">信息</div>
                  <div className="space-y-3 text-sm text-text-secondary">
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <Download className="h-4 w-4" />
                        安装
                      </span>
                      <span>{formatCount(item?.installCount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <Hammer className="h-4 w-4" />
                        工具
                      </span>
                      <span>{formatCount(item?.toolsCount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        {kind === 'skill' ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <Wrench className="h-4 w-4" />
                        )}
                        {kind === 'skill' ? '资源' : '能力'}
                      </span>
                      <span>
                        {formatCount(kind === 'skill' ? item?.resourcesCount : item?.promptsCount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-2">
                        <Code2 className="h-4 w-4" />
                        标识
                      </span>
                      <span className="truncate text-right">{identifier}</span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
