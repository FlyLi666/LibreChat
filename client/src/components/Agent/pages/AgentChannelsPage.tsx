import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  MessageSquare,
  QrCode,
  RefreshCw,
  Save,
  Send,
  Settings2,
  Smartphone,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { getTokenHeader, request } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';
import type { ResolvedAgentRouteContext } from '../useAgentRouteContext';

type FieldKind = 'text' | 'password';

type ChannelField = {
  advanced?: boolean;
  id: string;
  labelKey: string;
  helperKey?: string;
  kind?: FieldKind;
  placeholderKey?: string;
};

type ChannelConfig = {
  id:
    | 'discord'
    | 'telegram'
    | 'slack'
    | 'feishu'
    | 'lark'
    | 'qq'
    | 'wechat'
    | 'line'
    | 'whatsapp'
    | 'imessage';
  icon: typeof MessageCircle;
  color: string;
  fields: ChannelField[];
  openPlatform?: string;
  soon?: boolean;
  scan?: boolean;
};

type WechatQrStatus = 'idle' | 'loading' | 'wait' | 'scaned' | 'confirmed' | 'expired' | 'error';
type WechatQrCredentials = {
  baseurl?: string;
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
};
type WechatProvider = {
  applicationId: string;
  connectedAt?: string;
  id: string;
  lastError?: string;
  lastMessageAt?: string;
  runtimeStatus: 'connecting' | 'connected' | 'disconnected' | 'failed';
  settings?: Partial<WechatSettings>;
};
type WechatSettings = {
  characterLimit: number;
  concurrencyMode: 'queue' | 'parallel' | 'latest';
  keywords: string[];
  showToolCalls: boolean;
  showUsage: boolean;
};

const REAL_AGENT_ID_PATTERN = /^ag(?:en)?t[_-]/i;
const DEFAULT_WECHAT_SETTINGS: WechatSettings = {
  characterLimit: 2000,
  concurrencyMode: 'queue',
  keywords: [],
  showToolCalls: false,
  showUsage: false,
};

const channelConfigs: ChannelConfig[] = [
  {
    id: 'discord',
    icon: MessageSquare,
    color: 'text-indigo-700 dark:text-indigo-300',
    openPlatform: 'https://discord.com/developers/applications',
    fields: [
      { id: 'appId', labelKey: 'com_agent_channel_field_app_id' },
      { id: 'publicKey', labelKey: 'com_agent_channel_field_public_key' },
      { id: 'botToken', labelKey: 'com_agent_channel_field_bot_token', kind: 'password' },
    ],
  },
  {
    id: 'telegram',
    icon: Send,
    color: 'text-sky-700 dark:text-sky-300',
    openPlatform: 'https://core.telegram.org/bots',
    fields: [
      { id: 'botToken', labelKey: 'com_agent_channel_field_bot_token', kind: 'password' },
      { id: 'webhookSecret', labelKey: 'com_agent_channel_field_webhook_secret', kind: 'password' },
    ],
  },
  {
    id: 'slack',
    icon: MessageSquare,
    color: 'text-fuchsia-700 dark:text-fuchsia-300',
    openPlatform: 'https://api.slack.com/apps',
    fields: [
      { id: 'clientId', labelKey: 'com_agent_channel_field_client_id' },
      { id: 'clientSecret', labelKey: 'com_agent_channel_field_client_secret', kind: 'password' },
      { id: 'botToken', labelKey: 'com_agent_channel_field_bot_token', kind: 'password' },
      { id: 'signingSecret', labelKey: 'com_agent_channel_field_signing_secret', kind: 'password' },
    ],
  },
  {
    id: 'feishu',
    icon: Bot,
    color: 'text-cyan-700 dark:text-cyan-300',
    openPlatform: 'https://open.feishu.cn/app',
    fields: [
      { id: 'appId', labelKey: 'com_agent_channel_field_app_id' },
      { id: 'appSecret', labelKey: 'com_agent_channel_field_app_secret', kind: 'password' },
      { id: 'verificationToken', labelKey: 'com_agent_channel_field_verification_token' },
      { id: 'encryptKey', labelKey: 'com_agent_channel_field_encrypt_key', kind: 'password' },
    ],
  },
  {
    id: 'lark',
    icon: Bot,
    color: 'text-blue-700 dark:text-blue-300',
    openPlatform: 'https://open.larksuite.com/app',
    fields: [
      { id: 'appId', labelKey: 'com_agent_channel_field_app_id' },
      { id: 'appSecret', labelKey: 'com_agent_channel_field_app_secret', kind: 'password' },
      { id: 'verificationToken', labelKey: 'com_agent_channel_field_verification_token' },
      { id: 'encryptKey', labelKey: 'com_agent_channel_field_encrypt_key', kind: 'password' },
    ],
  },
  {
    id: 'qq',
    icon: MessageCircle,
    color: 'text-yellow-700 dark:text-yellow-200',
    openPlatform: 'https://q.qq.com',
    fields: [
      { id: 'botAppId', labelKey: 'com_agent_channel_field_bot_app_id' },
      { id: 'botSecret', labelKey: 'com_agent_channel_field_bot_secret', kind: 'password' },
      { id: 'callbackUrl', labelKey: 'com_agent_channel_field_callback_url' },
      { id: 'token', labelKey: 'com_agent_channel_field_token', kind: 'password', advanced: true },
      {
        id: 'encodingAESKey',
        labelKey: 'com_agent_channel_field_encoding_aes_key',
        kind: 'password',
        advanced: true,
      },
    ],
  },
  {
    id: 'wechat',
    icon: MessageCircle,
    color: 'text-emerald-700 dark:text-emerald-300',
    openPlatform: 'https://mp.weixin.qq.com',
    scan: true,
    fields: [],
  },
  {
    id: 'line',
    icon: MessageCircle,
    color: 'text-green-700 dark:text-green-300',
    openPlatform: 'https://developers.line.biz',
    fields: [
      { id: 'channelId', labelKey: 'com_agent_channel_field_channel_id' },
      { id: 'channelSecret', labelKey: 'com_agent_channel_field_channel_secret', kind: 'password' },
      { id: 'accessToken', labelKey: 'com_agent_channel_field_access_token', kind: 'password' },
    ],
  },
  {
    id: 'whatsapp',
    icon: Smartphone,
    color: 'text-green-700 dark:text-green-300',
    soon: true,
    fields: [
      { id: 'phoneNumberId', labelKey: 'com_agent_channel_field_phone_number_id' },
      { id: 'accessToken', labelKey: 'com_agent_channel_field_access_token', kind: 'password' },
      { id: 'verifyToken', labelKey: 'com_agent_channel_field_verify_token', kind: 'password' },
    ],
  },
  {
    id: 'imessage',
    icon: Smartphone,
    color: 'text-lime-700 dark:text-lime-300',
    soon: true,
    fields: [
      { id: 'deviceId', labelKey: 'com_agent_channel_field_device_id' },
      { id: 'relayToken', labelKey: 'com_agent_channel_field_relay_token', kind: 'password' },
    ],
  },
];

function buildInitialValues() {
  return Object.fromEntries(
    channelConfigs.map((channel) => [
      channel.id,
      Object.fromEntries(channel.fields.map((field) => [field.id, ''])),
    ]),
  ) as Record<ChannelConfig['id'], Record<string, string>>;
}

function createAgentChannelHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const authorization = getTokenHeader();

  if (authorization && !nextHeaders.has('Authorization')) {
    nextHeaders.set('Authorization', authorization);
  }

  return nextHeaders;
}

async function fetchAgentChannel(
  input: RequestInfo | URL,
  init: RequestInit = {},
  retryOnUnauthorized = true,
) {
  const response = await fetch(input, {
    ...init,
    credentials: 'include',
    headers: createAgentChannelHeaders(init.headers),
  });

  if (response.status !== 401 || !retryOnUnauthorized || !getTokenHeader()) {
    return response;
  }

  const refreshed = await request.refreshToken();
  if (!refreshed?.token) {
    return response;
  }

  request.dispatchTokenUpdatedEvent(refreshed.token);
  return fetchAgentChannel(input, init, false);
}

async function requestWechatQrCode() {
  const response = await fetchAgentChannel('/api/agents/channel/wechat/qrcode', {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    qrcode?: string;
    qrcodeContent?: string;
    qrcode_img_content?: string;
  };

  if (!data.qrcode || !(data.qrcodeContent || data.qrcode_img_content)) {
    throw new Error('Invalid WeChat QR code response');
  }

  return {
    qrcode: data.qrcode,
    qrcodeContent: data.qrcodeContent || data.qrcode_img_content || '',
  };
}

async function requestWechatQrStatus(qrcode: string) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/wechat/qrcode/${encodeURIComponent(qrcode)}/status`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatQrCredentials & { status?: WechatQrStatus };
}

async function requestWechatProvider(agentId: string) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat`,
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatStart(agentId: string) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat/start`,
    {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatDisconnect(agentId: string) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat/disconnect`,
    {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatConnect(
  agentId: string,
  credentials: WechatQrCredentials,
  settings: WechatSettings,
) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat/connect`,
    {
      body: JSON.stringify({
        baseurl: credentials.baseurl,
        bot_token: credentials.bot_token,
        ilink_bot_id: credentials.ilink_bot_id,
        ilink_user_id: credentials.ilink_user_id,
        settings,
      }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatSettings(agentId: string, settings: WechatSettings) {
  const response = await fetchAgentChannel(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat/settings`,
    {
      body: JSON.stringify({ settings }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

function buildChannelPayload(
  agentId: string,
  channel: ChannelConfig,
  credentials: Record<string, string>,
) {
  return {
    agentId,
    credentials,
    platform: channel.id,
    settings: {
      callbackPath: `/api/agents/${agentId}/channels/${channel.id}/callback`,
      retryPolicy: 'standard',
    },
    status: 'local_only_backend_pending',
  };
}

function getWechatRuntimeClassName(status: WechatProvider['runtimeStatus']) {
  if (status === 'connected') {
    return 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-200';
  }

  if (status === 'failed') {
    return 'bg-rose-500/12 text-rose-700 dark:text-rose-200';
  }

  return 'bg-surface-hover text-text-secondary';
}

export default function AgentChannelsPage({
  agentContext,
  agentId,
}: {
  agentContext?: ResolvedAgentRouteContext;
  agentId: string;
}) {
  const localize = useLocalize();
  const wechatPollTimer = useRef<number | null>(null);
  const channelAgentId =
    agentContext?.resolvedAgentId ?? (REAL_AGENT_ID_PATTERN.test(agentId) ? agentId : '');
  const [selectedId, setSelectedId] = useState<ChannelConfig['id']>('wechat');
  const [values, setValues] = useState(buildInitialValues);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [wechatQrOpen, setWechatQrOpen] = useState(false);
  const [wechatQrStatus, setWechatQrStatus] = useState<WechatQrStatus>('idle');
  const [wechatQrContent, setWechatQrContent] = useState('');
  const [wechatQrCode, setWechatQrCode] = useState('');
  const [wechatQrError, setWechatQrError] = useState('');
  const [wechatCredentials, setWechatCredentials] = useState<WechatQrCredentials | null>(null);
  const [wechatSettings, setWechatSettings] = useState<WechatSettings>(DEFAULT_WECHAT_SETTINGS);
  const [wechatKeywordDraft, setWechatKeywordDraft] = useState('');
  const [wechatProvider, setWechatProvider] = useState<WechatProvider | null>(null);
  const [wechatActionBusy, setWechatActionBusy] = useState<'start' | 'disconnect' | null>(null);
  const [wechatActionError, setWechatActionError] = useState('');
  const [lastSavedPayload, setLastSavedPayload] = useState<Record<string, unknown> | null>(null);

  const selectedChannel = useMemo(
    () => channelConfigs.find((channel) => channel.id === selectedId) ?? channelConfigs[0],
    [selectedId],
  );
  const SelectedIcon = selectedChannel.icon;
  const primaryFields = selectedChannel.fields.filter((field) => !field.advanced);
  const advancedFields = selectedChannel.fields.filter((field) => field.advanced);

  const updateValue = (fieldId: string, value: string) => {
    setValues((current) => ({
      ...current,
      [selectedChannel.id]: {
        ...current[selectedChannel.id],
        [fieldId]: value,
      },
    }));
  };

  const updateWechatSetting = <Key extends keyof WechatSettings>(
    key: Key,
    value: WechatSettings[Key],
  ) => {
    setWechatSettings((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const addWechatKeyword = () => {
    const keyword = wechatKeywordDraft.trim();
    if (!keyword) return;

    setWechatSettings((current) => ({
      ...current,
      keywords: [...new Set([...current.keywords, keyword])].slice(0, 20),
    }));
    setWechatKeywordDraft('');
  };

  const removeWechatKeyword = (keyword: string) => {
    setWechatSettings((current) => ({
      ...current,
      keywords: current.keywords.filter((item) => item !== keyword),
    }));
  };

  const restoreWechatDefaults = () => {
    setWechatSettings(DEFAULT_WECHAT_SETTINGS);
    setWechatKeywordDraft('');
  };

  const handleSave = async () => {
    if (!selectedChannel.scan) {
      setLastSavedPayload(
        buildChannelPayload(agentId, selectedChannel, values[selectedChannel.id] ?? {}),
      );
    } else if (wechatProvider && channelAgentId) {
      try {
        const provider = await requestWechatSettings(channelAgentId, wechatSettings);
        setWechatProvider(provider);
        setWechatActionError('');
      } catch (error) {
        setWechatActionError(
          error instanceof Error ? error.message : localize('com_agent_channel_wechat_save_error'),
        );
        return;
      }
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };

  const clearWechatPollTimer = () => {
    if (wechatPollTimer.current) {
      window.clearTimeout(wechatPollTimer.current);
      wechatPollTimer.current = null;
    }
  };

  const scheduleWechatPoll = (qrcode: string) => {
    clearWechatPollTimer();
    wechatPollTimer.current = window.setTimeout(async () => {
      try {
        const result = await requestWechatQrStatus(qrcode);
        const nextStatus = result.status ?? 'wait';

        if (nextStatus === 'scaned' || nextStatus === 'confirmed' || nextStatus === 'expired') {
          setWechatQrStatus(nextStatus);
        }

        if (nextStatus === 'confirmed') {
          const credentials = {
            baseurl: result.baseurl,
            bot_token: result.bot_token,
            ilink_bot_id: result.ilink_bot_id,
            ilink_user_id: result.ilink_user_id,
          };
          setWechatCredentials(credentials);

          if (result.bot_token && result.ilink_bot_id && result.ilink_user_id && channelAgentId) {
            try {
              const provider = await requestWechatConnect(
                channelAgentId,
                credentials,
                wechatSettings,
              );
              setWechatProvider(provider);
            } catch (error) {
              setWechatQrStatus('error');
              setWechatQrError(
                error instanceof Error
                  ? error.message
                  : localize('com_agent_channel_wechat_connect_error'),
              );
            }
          }
        }

        if (nextStatus === 'wait' || nextStatus === 'scaned') {
          scheduleWechatPoll(qrcode);
        }
      } catch {
        scheduleWechatPoll(qrcode);
      }
    }, 2000);
  };

  const startWechatQrFlow = async () => {
    clearWechatPollTimer();
    if (!channelAgentId) {
      setWechatActionError(localize('com_agent_channel_agent_required'));
      return;
    }
    setWechatQrOpen(true);
    setWechatQrStatus('loading');
    setWechatQrError('');
    setWechatQrContent('');
    setWechatQrCode('');

    try {
      const qr = await requestWechatQrCode();
      setWechatQrContent(qr.qrcodeContent);
      setWechatQrCode(qr.qrcode);
      setWechatQrStatus('wait');
      setWechatCredentials(null);
      scheduleWechatPoll(qr.qrcode);
    } catch (error) {
      setWechatQrStatus('error');
      setWechatQrError(
        error instanceof Error ? error.message : localize('com_agent_channel_wechat_qr_error'),
      );
      return;
    }
  };

  const closeWechatQrFlow = () => {
    clearWechatPollTimer();
    setWechatQrOpen(false);
    setWechatQrStatus('idle');
    setWechatQrError('');
  };

  const handleWechatStart = async () => {
    if (!channelAgentId) {
      setWechatActionError(localize('com_agent_channel_agent_required'));
      return;
    }
    setWechatActionBusy('start');
    setWechatActionError('');

    try {
      const provider = await requestWechatStart(channelAgentId);
      setWechatProvider(provider);
    } catch (error) {
      setWechatActionError(
        error instanceof Error ? error.message : localize('com_agent_channel_wechat_start_error'),
      );
    } finally {
      setWechatActionBusy(null);
    }
  };

  const handleWechatDisconnect = async () => {
    if (!channelAgentId) {
      setWechatActionError(localize('com_agent_channel_agent_required'));
      return;
    }
    setWechatActionBusy('disconnect');
    setWechatActionError('');

    try {
      const provider = await requestWechatDisconnect(channelAgentId);
      setWechatProvider(provider);
    } catch (error) {
      setWechatActionError(
        error instanceof Error
          ? error.message
          : localize('com_agent_channel_wechat_disconnect_error'),
      );
    } finally {
      setWechatActionBusy(null);
    }
  };

  useEffect(() => () => clearWechatPollTimer(), []);

  useEffect(() => {
    let active = true;
    if (!channelAgentId) {
      setWechatProvider(null);
      return () => {
        active = false;
      };
    }

    requestWechatProvider(channelAgentId)
      .then((provider) => {
        if (active) {
          setWechatProvider(provider);
          if (provider?.settings) {
            setWechatSettings((current) => ({
              ...current,
              ...provider.settings,
              keywords: Array.isArray(provider.settings?.keywords)
                ? provider.settings.keywords
                : current.keywords,
            }));
          }
        }
      })
      .catch(() => {
        if (active) {
          setWechatProvider(null);
        }
      });

    return () => {
      active = false;
    };
  }, [channelAgentId]);

  return (
    <div
      data-testid="agent-channel-page"
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-surface-primary lg:flex-row lg:overflow-hidden"
    >
      <aside className="flex w-full shrink-0 flex-col border-b border-border-light bg-surface-primary-alt lg:h-full lg:w-[320px] lg:border-b-0 lg:border-r">
        <div className="min-h-0 flex-none overflow-x-auto px-3 py-3 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-6">
          <nav
            className="flex gap-2 lg:block lg:space-y-2"
            aria-label={localize('com_agent_message_channels')}
          >
            {channelConfigs.map((channel) => {
              const Icon = channel.icon;
              const isSelected = channel.id === selectedChannel.id;

              return (
                <button
                  type="button"
                  key={channel.id}
                  onClick={() => setSelectedId(channel.id)}
                  className={cn(
                    'flex h-10 min-w-[92px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-center text-[11px] transition-colors lg:h-14 lg:w-full lg:min-w-0 lg:flex-row lg:justify-start lg:gap-4 lg:px-4 lg:text-left lg:text-base',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                    isSelected
                      ? 'bg-surface-active-alt text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <Icon
                    className={cn('size-5 shrink-0 lg:size-6', channel.color)}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 max-w-full truncate lg:flex-1">
                    {localize(`com_agent_channel_${channel.id}`)}
                  </span>
                  {channel.soon ? (
                    <span className="hidden rounded-md bg-surface-hover px-2 py-1 text-xs text-text-tertiary lg:inline">
                      {localize('com_agent_soon')}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden shrink-0 border-t border-border-light p-3 lg:block lg:p-4">
          <div className="rounded-lg border border-border-light bg-surface-primary p-4">
            <div className="flex items-center gap-2">
              <MessageSquare
                className="size-4 text-fuchsia-700 dark:text-fuchsia-300"
                aria-hidden="true"
              />
              <MessageSquare
                className="size-4 text-indigo-700 dark:text-indigo-300"
                aria-hidden="true"
              />
              <Send className="size-4 text-sky-700 dark:text-sky-300" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-text-primary">
              {localize('com_agent_channel_quick_start')}
            </h2>
            <p className="mt-2 text-xs leading-5 text-text-tertiary">
              {localize('com_agent_channel_quick_start_desc')}
            </p>
          </div>
          <button
            type="button"
            className="mt-4 flex h-10 w-full items-center justify-between rounded-md px-1 text-sm text-text-secondary transition-colors hover:text-text-primary"
          >
            <span>{localize('com_agent_channel_docs')}</span>
            <span className="text-text-tertiary">•••</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 lg:overflow-y-auto lg:px-10 lg:py-8">
        <section className="mx-auto max-w-4xl">
          <header className="flex flex-col gap-4 border-b border-border-light pb-6 sm:flex-row sm:items-center lg:pb-8">
            <SelectedIcon
              className={cn('size-11 shrink-0', selectedChannel.color)}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-text-primary">
                  {localize(`com_agent_channel_${selectedChannel.id}`)}
                </h1>
                <span className="rounded-full border border-border-light px-2 py-0.5 text-xs text-text-tertiary">
                  {channelAgentId || agentId}
                </span>
              </div>
              <p className="mt-2 text-sm text-text-tertiary">
                {localize(`com_agent_channel_${selectedChannel.id}_subtitle`)}
              </p>
            </div>
            {selectedChannel.openPlatform ? (
              <a
                href={selectedChannel.openPlatform}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary sm:ml-auto"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                {localize('com_agent_channel_open_platform')}
              </a>
            ) : null}
          </header>

          {selectedChannel.scan ? (
            <div className="flex flex-col items-center border-b border-border-light py-10 text-center">
              {wechatProvider ? (
                <div className="mb-6 w-full max-w-xl rounded-xl border border-border-light bg-surface-secondary p-4 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle2
                      className="size-5 text-emerald-700 dark:text-emerald-200"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text-primary">
                        {localize('com_agent_channel_wechat_connected')}
                      </p>
                      <p className="mt-1 truncate text-xs text-text-tertiary">
                        {wechatProvider.applicationId}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-xs font-medium',
                        getWechatRuntimeClassName(wechatProvider.runtimeStatus),
                      )}
                    >
                      {localize(`com_agent_channel_runtime_${wechatProvider.runtimeStatus}`)}
                    </span>
                  </div>
                  {wechatProvider.lastError ? (
                    <p className="mt-3 text-xs text-rose-600 dark:text-rose-200">
                      {wechatProvider.lastError}
                    </p>
                  ) : null}
                  {wechatActionError ? (
                    <p className="mt-3 text-xs text-rose-600 dark:text-rose-200">
                      {wechatActionError}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startWechatQrFlow}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border-light px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <QrCode className="size-4" aria-hidden="true" />
                      {localize('com_agent_channel_wechat_rebind')}
                    </button>
                    <button
                      type="button"
                      onClick={handleWechatStart}
                      disabled={wechatActionBusy === 'start'}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border-light px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-wait disabled:opacity-60"
                    >
                      {wechatActionBusy === 'start' ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="size-4" aria-hidden="true" />
                      )}
                      {localize('com_agent_channel_wechat_reconnect')}
                    </button>
                    <button
                      type="button"
                      onClick={handleWechatDisconnect}
                      disabled={wechatActionBusy === 'disconnect'}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-500/20 px-3 text-sm font-medium text-rose-700 transition-colors hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-60 dark:text-rose-100"
                    >
                      {wechatActionBusy === 'disconnect' ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <X className="size-4" aria-hidden="true" />
                      )}
                      {localize('com_agent_channel_wechat_disconnect')}
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={startWechatQrFlow}
                disabled={!channelAgentId}
                className="inline-flex h-12 items-center gap-3 rounded-lg bg-surface-submit px-5 text-sm font-semibold text-white transition-colors hover:bg-surface-submit-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <QrCode className="size-5" aria-hidden="true" />
                {localize('com_agent_channel_scan_connect')}
              </button>
              <p className="mt-5 max-w-xl text-sm leading-6 text-text-tertiary">
                {localize('com_agent_channel_wechat_scan_hint')}
              </p>
            </div>
          ) : null}

          <section className="space-y-10 py-10">
            {primaryFields.map((field) => {
              const fieldKey = `${selectedChannel.id}-${field.id}`;
              const isPassword = field.kind === 'password';
              const isVisible = showSecret[fieldKey];

              return (
                <div key={field.id} className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                  <div>
                    <label
                      htmlFor={fieldKey}
                      className="block text-base font-semibold text-text-primary"
                    >
                      {localize(field.labelKey)}
                    </label>
                    <p className="mt-2 text-sm leading-5 text-text-tertiary">
                      {localize(field.helperKey ?? 'com_agent_channel_field_default_hint')}
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      id={fieldKey}
                      value={values[selectedChannel.id][field.id] ?? ''}
                      onChange={(event) => updateValue(field.id, event.target.value)}
                      type={isPassword && !isVisible ? 'password' : 'text'}
                      disabled={selectedChannel.soon}
                      placeholder={localize(field.placeholderKey ?? field.labelKey)}
                      className="h-12 w-full rounded-lg border border-border-light bg-surface-hover px-4 pr-11 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-border-medium focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    {isPassword ? (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecret((current) => ({
                            ...current,
                            [fieldKey]: !current[fieldKey],
                          }))
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-tertiary transition-colors hover:text-text-primary"
                        aria-label={localize('com_agent_channel_toggle_secret')}
                      >
                        {isVisible ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            <section className="border-t border-border-light pt-7">
              <button
                type="button"
                onClick={() => setAdvancedOpen((current) => !current)}
                className="flex w-full items-center gap-3 text-left text-xl font-semibold text-text-primary transition-colors hover:text-text-primary"
              >
                <ChevronRight
                  className={cn('size-5 transition-transform', advancedOpen && 'rotate-90')}
                  aria-hidden="true"
                />
                {localize('com_agent_advanced_settings')}
              </button>
              {advancedOpen && selectedChannel.scan ? (
                <div className="mt-6 space-y-8">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={restoreWechatDefaults}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-border-light px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                    >
                      <RefreshCw className="size-4" aria-hidden="true" />
                      {localize('com_agent_channel_restore_defaults')}
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      <label
                        htmlFor="wechat-character-limit"
                        className="block text-base font-semibold text-text-primary"
                      >
                        {localize('com_agent_channel_character_limit')}
                      </label>
                      <p className="mt-2 text-sm leading-5 text-text-tertiary">
                        {localize('com_agent_channel_character_limit_desc')}
                      </p>
                    </div>
                    <input
                      id="wechat-character-limit"
                      type="number"
                      min={1}
                      max={20000}
                      value={wechatSettings.characterLimit}
                      onChange={(event) =>
                        updateWechatSetting(
                          'characterLimit',
                          Number.parseInt(event.target.value, 10) || 1,
                        )
                      }
                      className="h-12 w-full rounded-lg border border-border-light bg-surface-hover px-4 text-sm text-text-primary outline-none transition-colors hover:border-border-medium focus:border-border-medium focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      <label
                        htmlFor="wechat-concurrency-mode"
                        className="block text-base font-semibold text-text-primary"
                      >
                        {localize('com_agent_channel_concurrency_mode')}
                      </label>
                      <p className="mt-2 text-sm leading-5 text-text-tertiary">
                        {localize('com_agent_channel_concurrency_mode_desc')}
                      </p>
                    </div>
                    <select
                      id="wechat-concurrency-mode"
                      value={wechatSettings.concurrencyMode}
                      onChange={(event) =>
                        updateWechatSetting(
                          'concurrencyMode',
                          event.target.value as WechatSettings['concurrencyMode'],
                        )
                      }
                      className="h-12 w-full rounded-lg border border-border-light bg-surface-hover px-4 text-sm text-text-primary outline-none transition-colors hover:border-border-medium focus:border-border-medium focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="queue">
                        {localize('com_agent_channel_concurrency_queue')}
                      </option>
                      <option value="parallel">
                        {localize('com_agent_channel_concurrency_parallel')}
                      </option>
                      <option value="latest">
                        {localize('com_agent_channel_concurrency_latest')}
                      </option>
                    </select>
                  </div>

                  {[
                    [
                      'showUsage',
                      'com_agent_channel_show_usage',
                      'com_agent_channel_show_usage_desc',
                    ],
                    [
                      'showToolCalls',
                      'com_agent_channel_show_tool_calls',
                      'com_agent_channel_show_tool_calls_desc',
                    ],
                  ].map(([key, labelKey, descKey]) => (
                    <div
                      key={key}
                      className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)] md:items-center"
                    >
                      <div>
                        <p className="text-base font-semibold text-text-primary">
                          {localize(labelKey)}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-text-tertiary">
                          {localize(descKey)}
                        </p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={wechatSettings[key as keyof WechatSettings] === true}
                        onClick={() =>
                          updateWechatSetting(
                            key as 'showUsage' | 'showToolCalls',
                            !(wechatSettings[key as keyof WechatSettings] === true),
                          )
                        }
                        className={cn(
                          'relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                          wechatSettings[key as keyof WechatSettings] === true
                            ? 'bg-emerald-500'
                            : 'bg-surface-hover',
                        )}
                      >
                        <span
                          className={cn(
                            'absolute top-1 size-5 rounded-full bg-white shadow transition-transform',
                            wechatSettings[key as keyof WechatSettings] === true
                              ? 'translate-x-6'
                              : 'translate-x-1',
                          )}
                        />
                      </button>
                    </div>
                  ))}

                  <div className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      <p className="text-base font-semibold text-text-primary">
                        {localize('com_agent_channel_keywords')}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-text-tertiary">
                        {localize('com_agent_channel_keywords_desc')}
                      </p>
                    </div>
                    <div className="space-y-3">
                      {wechatSettings.keywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {wechatSettings.keywords.map((keyword) => (
                            <span
                              key={keyword}
                              className="inline-flex h-8 items-center gap-2 rounded-full border border-border-light px-3 text-sm text-text-secondary"
                            >
                              {keyword}
                              <button
                                type="button"
                                onClick={() => removeWechatKeyword(keyword)}
                                className="rounded-full p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                                aria-label={localize('com_agent_channel_remove_keyword')}
                              >
                                <X className="size-3" aria-hidden="true" />
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-text-tertiary">
                          {localize('com_agent_channel_keywords_empty')}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <input
                          value={wechatKeywordDraft}
                          onChange={(event) => setWechatKeywordDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              addWechatKeyword();
                            }
                          }}
                          placeholder={localize('com_agent_channel_keyword_placeholder')}
                          className="h-11 min-w-0 flex-1 rounded-lg border border-dashed border-border-light bg-surface-hover px-4 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-border-medium"
                        />
                        <button
                          type="button"
                          onClick={addWechatKeyword}
                          className="h-11 rounded-lg border border-dashed border-border-light px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
                        >
                          {localize('com_agent_channel_add_keyword')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {advancedOpen && !selectedChannel.scan ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {advancedFields.map((field) => {
                    const fieldKey = `${selectedChannel.id}-${field.id}`;
                    const isPassword = field.kind === 'password';
                    const isVisible = showSecret[fieldKey];

                    return (
                      <label key={field.id} className="space-y-2">
                        <span className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                          {localize(field.labelKey)}
                        </span>
                        <div className="relative">
                          <input
                            id={fieldKey}
                            value={values[selectedChannel.id][field.id] ?? ''}
                            onChange={(event) => updateValue(field.id, event.target.value)}
                            type={isPassword && !isVisible ? 'password' : 'text'}
                            disabled={selectedChannel.soon}
                            placeholder={localize(field.placeholderKey ?? field.labelKey)}
                            className="h-11 w-full rounded-lg border border-border-light bg-surface-hover px-3 pr-10 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary focus:border-border-medium disabled:cursor-not-allowed disabled:opacity-50"
                          />
                          {isPassword ? (
                            <button
                              type="button"
                              onClick={() =>
                                setShowSecret((current) => ({
                                  ...current,
                                  [fieldKey]: !current[fieldKey],
                                }))
                              }
                              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-text-tertiary transition-colors hover:text-text-primary"
                              aria-label={localize('com_agent_channel_toggle_secret')}
                            >
                              {isVisible ? (
                                <EyeOff className="size-4" aria-hidden="true" />
                              ) : (
                                <Eye className="size-4" aria-hidden="true" />
                              )}
                            </button>
                          ) : null}
                        </div>
                      </label>
                    );
                  })}
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      {localize('com_agent_channel_field_callback_url')}
                    </span>
                    <input
                      className="h-11 w-full rounded-lg border border-border-light bg-surface-hover px-3 text-sm text-text-primary outline-none focus:border-border-medium"
                      value={`/api/agents/${channelAgentId || agentId}/channels/${selectedChannel.id}/callback`}
                      readOnly
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
                      {localize('com_agent_channel_retry_policy')}
                    </span>
                    <select className="h-11 w-full rounded-lg border border-border-light bg-surface-hover px-3 text-sm text-text-primary outline-none focus:border-border-medium">
                      <option>{localize('com_agent_channel_retry_standard')}</option>
                      <option>{localize('com_agent_channel_retry_aggressive')}</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>

            <div className="flex flex-col gap-4 border-t border-border-light pt-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-text-primary">
                  {localize(
                    selectedChannel.scan
                      ? 'com_agent_channel_wechat_backend_hint'
                      : 'com_agent_channel_save_local_only',
                  )}
                </p>
                {!selectedChannel.scan && lastSavedPayload?.platform === selectedChannel.id ? (
                  <pre className="mt-3 max-h-40 overflow-auto rounded-lg border border-border-light bg-surface-secondary p-3 text-left text-xs leading-5 text-text-tertiary">
                    {JSON.stringify(lastSavedPayload, null, 2)}
                  </pre>
                ) : null}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={selectedChannel.soon}
                  className={cn(
                    'inline-flex h-12 items-center gap-3 rounded-lg px-5 text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-45',
                    saved
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-400 dark:text-emerald-950'
                      : 'bg-surface-submit text-white hover:bg-surface-submit-hover',
                  )}
                >
                  {saved ? (
                    <Settings2 className="size-5" aria-hidden="true" />
                  ) : (
                    <Save className="size-5" aria-hidden="true" />
                  )}
                  {saved
                    ? localize('com_agent_channel_saved_local')
                    : localize('com_agent_save_channel_config')}
                </button>
              </div>
            </div>
          </section>
        </section>
      </main>

      {wechatQrOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm dark:bg-black/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-qr-title"
        >
          <div className="w-full max-w-[460px] rounded-2xl border border-border-light bg-surface-primary p-6 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-3">
              <h2 id="wechat-qr-title" className="text-lg font-semibold text-text-primary">
                {localize('com_agent_channel_wechat_scan_title')}
              </h2>
              <button
                type="button"
                onClick={closeWechatQrFlow}
                className="rounded-md p-1 text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-primary"
                aria-label={localize('com_ui_close')}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-7">
              {wechatQrStatus === 'loading' ? (
                <Loader2 className="size-10 animate-spin text-text-secondary" aria-hidden="true" />
              ) : null}

              {wechatQrContent && wechatQrStatus !== 'error' ? (
                <div className="rounded-2xl border border-border-light bg-white p-4 dark:bg-white">
                  <QRCodeSVG value={wechatQrContent} size={240} />
                </div>
              ) : null}

              {wechatQrStatus === 'wait' ? (
                <p className="text-center text-sm text-text-secondary">
                  {localize('com_agent_channel_wechat_qr_wait')}
                </p>
              ) : null}

              {wechatQrStatus === 'scaned' ? (
                <p className="text-center text-sm text-blue-600 dark:text-sky-200">
                  {localize('com_agent_channel_wechat_qr_scaned')}
                </p>
              ) : null}

              {wechatQrStatus === 'confirmed' ? (
                <div className="space-y-3 text-center">
                  <p className="inline-flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-200">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {localize('com_agent_channel_wechat_qr_confirmed')}
                  </p>
                  {wechatCredentials?.ilink_bot_id ? (
                    <p className="text-xs text-text-tertiary">{wechatCredentials.ilink_bot_id}</p>
                  ) : null}
                  {wechatProvider ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-100">
                      {localize(`com_agent_channel_runtime_${wechatProvider.runtimeStatus}`)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {wechatQrStatus === 'error' || wechatQrError ? (
                <div className="flex w-full items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-100">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{wechatQrError || localize('com_agent_channel_wechat_qr_error')}</span>
                </div>
              ) : null}

              {wechatQrCode ? (
                <div className="max-w-full truncate rounded-full bg-surface-hover px-3 py-1 text-xs text-text-tertiary">
                  {wechatQrCode}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-border-light pt-4">
              <button
                type="button"
                onClick={startWechatQrFlow}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border-light px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {localize('com_agent_channel_wechat_qr_refresh')}
              </button>
              <button
                type="button"
                onClick={closeWechatQrFlow}
                className="h-10 rounded-md bg-surface-submit px-4 text-sm font-semibold text-white transition-colors hover:bg-surface-submit-hover"
              >
                {localize('com_ui_close')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
