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
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';

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
};

const channelConfigs: ChannelConfig[] = [
  {
    id: 'discord',
    icon: MessageSquare,
    color: 'text-indigo-300',
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
    color: 'text-sky-300',
    openPlatform: 'https://core.telegram.org/bots',
    fields: [
      { id: 'botToken', labelKey: 'com_agent_channel_field_bot_token', kind: 'password' },
      { id: 'webhookSecret', labelKey: 'com_agent_channel_field_webhook_secret', kind: 'password' },
    ],
  },
  {
    id: 'slack',
    icon: MessageSquare,
    color: 'text-fuchsia-300',
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
    color: 'text-cyan-300',
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
    color: 'text-blue-300',
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
    color: 'text-yellow-200',
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
    color: 'text-emerald-300',
    openPlatform: 'https://mp.weixin.qq.com',
    scan: true,
    fields: [],
  },
  {
    id: 'line',
    icon: MessageCircle,
    color: 'text-green-300',
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
    color: 'text-green-300',
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
    color: 'text-lime-300',
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

async function requestWechatQrCode() {
  const response = await fetch('/api/agents/channel/wechat/qrcode', {
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
  const response = await fetch(
    `/api/agents/channel/wechat/qrcode/${encodeURIComponent(qrcode)}/status`,
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatQrCredentials & { status?: WechatQrStatus };
}

async function requestWechatProvider(agentId: string) {
  const response = await fetch(`/api/agents/channel/${encodeURIComponent(agentId)}/wechat`);

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatStart(agentId: string) {
  const response = await fetch(`/api/agents/channel/${encodeURIComponent(agentId)}/wechat/start`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return (await response.json()) as WechatProvider;
}

async function requestWechatDisconnect(agentId: string) {
  const response = await fetch(
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

async function requestWechatConnect(agentId: string, credentials: WechatQrCredentials) {
  const response = await fetch(
    `/api/agents/channel/${encodeURIComponent(agentId)}/wechat/connect`,
    {
      body: JSON.stringify({
        baseurl: credentials.baseurl,
        bot_token: credentials.bot_token,
        ilink_bot_id: credentials.ilink_bot_id,
        ilink_user_id: credentials.ilink_user_id,
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
    return 'bg-emerald-300/18 text-emerald-100';
  }

  if (status === 'failed') {
    return 'bg-rose-300/18 text-rose-100';
  }

  return 'bg-white/10 text-white/60';
}

export default function AgentChannelsPage({ agentId }: { agentId: string }) {
  const localize = useLocalize();
  const wechatPollTimer = useRef<number | null>(null);
  const [selectedId, setSelectedId] = useState<ChannelConfig['id']>('discord');
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

  const handleSave = () => {
    if (!selectedChannel.scan) {
      setLastSavedPayload(
        buildChannelPayload(agentId, selectedChannel, values[selectedChannel.id] ?? {}),
      );
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

          if (result.bot_token && result.ilink_bot_id && result.ilink_user_id) {
            try {
              const provider = await requestWechatConnect(agentId, credentials);
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
    setWechatActionBusy('start');
    setWechatActionError('');

    try {
      const provider = await requestWechatStart(agentId);
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
    setWechatActionBusy('disconnect');
    setWechatActionError('');

    try {
      const provider = await requestWechatDisconnect(agentId);
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
    requestWechatProvider(agentId)
      .then((provider) => {
        if (active) {
          setWechatProvider(provider);
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
  }, [agentId]);

  return (
    <div data-testid="agent-channel-page" className="flex h-full min-h-0 bg-[#050607]">
      <aside className="flex w-[360px] shrink-0 flex-col border-r border-white/10 bg-[#0b0c0f]">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <nav className="space-y-2" aria-label={localize('com_agent_message_channels')}>
            {channelConfigs.map((channel) => {
              const Icon = channel.icon;
              const isSelected = channel.id === selectedChannel.id;

              return (
                <button
                  type="button"
                  key={channel.id}
                  onClick={() => setSelectedId(channel.id)}
                  className={cn(
                    'flex h-14 w-full items-center gap-4 rounded-lg px-4 text-left text-base transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30',
                    isSelected
                      ? 'bg-white/14 text-white'
                      : 'text-white/62 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <Icon className={cn('size-6 shrink-0', channel.color)} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {localize(`com_agent_channel_${channel.id}`)}
                  </span>
                  {channel.soon ? (
                    <span className="bg-white/8 rounded-md px-2 py-1 text-xs text-white/45">
                      {localize('com_agent_soon')}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="shrink-0 border-t border-white/10 p-4">
          <div className="rounded-lg border border-white/10 bg-[#101114] p-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-fuchsia-300" aria-hidden="true" />
              <MessageSquare className="size-4 text-indigo-300" aria-hidden="true" />
              <Send className="size-4 text-sky-300" aria-hidden="true" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-white">
              {localize('com_agent_channel_quick_start')}
            </h2>
            <p className="text-white/42 mt-2 text-xs leading-5">
              {localize('com_agent_channel_quick_start_desc')}
            </p>
          </div>
          <button
            type="button"
            className="text-white/58 mt-4 flex h-10 w-full items-center justify-between rounded-md px-1 text-sm transition-colors hover:text-white"
          >
            <span>{localize('com_agent_channel_docs')}</span>
            <span className="text-white/30">•••</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto px-10 py-8">
        <section className="mx-auto max-w-4xl">
          <header className="flex items-center gap-4 border-b border-white/10 pb-8">
            <SelectedIcon
              className={cn('size-11 shrink-0', selectedChannel.color)}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold text-white">
                  {localize(`com_agent_channel_${selectedChannel.id}`)}
                </h1>
                <span className="border-white/12 text-white/42 rounded-full border px-2 py-0.5 text-xs">
                  {agentId}
                </span>
              </div>
              <p className="mt-2 text-sm text-white/45">
                {localize(`com_agent_channel_${selectedChannel.id}_subtitle`)}
              </p>
            </div>
            {selectedChannel.openPlatform ? (
              <a
                href={selectedChannel.openPlatform}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium text-cyan-200 transition-colors hover:bg-cyan-300/10"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                {localize('com_agent_channel_open_platform')}
              </a>
            ) : null}
          </header>

          {selectedChannel.scan ? (
            <div className="flex flex-col items-center border-b border-white/10 py-10 text-center">
              {wechatProvider ? (
                <div className="bg-emerald-300/8 mb-6 w-full max-w-xl rounded-xl border border-emerald-300/20 p-4 text-left">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-emerald-200" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        {localize('com_agent_channel_wechat_connected')}
                      </p>
                      <p className="text-white/42 mt-1 truncate text-xs">
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
                    <p className="mt-3 text-xs text-rose-200">{wechatProvider.lastError}</p>
                  ) : null}
                  {wechatActionError ? (
                    <p className="mt-3 text-xs text-rose-200">{wechatActionError}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={startWechatQrFlow}
                      className="hover:bg-white/8 inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
                    >
                      <QrCode className="size-4" aria-hidden="true" />
                      {localize('com_agent_channel_wechat_rebind')}
                    </button>
                    <button
                      type="button"
                      onClick={handleWechatStart}
                      disabled={wechatActionBusy === 'start'}
                      className="hover:bg-white/8 inline-flex h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:text-white disabled:cursor-wait disabled:opacity-60"
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
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300/20 px-3 text-sm font-medium text-rose-100 transition-colors hover:bg-rose-300/10 disabled:cursor-wait disabled:opacity-60"
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
                className="inline-flex h-12 items-center gap-3 rounded-lg bg-white px-5 text-sm font-semibold text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <QrCode className="size-5" aria-hidden="true" />
                {localize('com_agent_channel_scan_connect')}
              </button>
              <p className="text-white/38 mt-5 max-w-xl text-sm leading-6">
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
                    <label htmlFor={fieldKey} className="block text-base font-semibold text-white">
                      {localize(field.labelKey)}
                    </label>
                    <p className="text-white/36 mt-2 text-sm leading-5">
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
                      className="border-white/8 bg-white/8 placeholder:text-white/22 hover:border-white/16 focus:border-white/28 h-12 w-full rounded-lg border px-4 pr-11 text-sm text-white outline-none transition-colors focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="text-white/36 absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:text-white"
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

            <section className="border-t border-white/10 pt-7">
              <button
                type="button"
                onClick={() => setAdvancedOpen((current) => !current)}
                className="flex w-full items-center gap-3 text-left text-xl font-semibold text-white transition-colors hover:text-white/80"
              >
                <ChevronRight
                  className={cn('size-5 transition-transform', advancedOpen && 'rotate-90')}
                  aria-hidden="true"
                />
                {localize('com_agent_advanced_settings')}
              </button>
              {advancedOpen ? (
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {advancedFields.map((field) => {
                    const fieldKey = `${selectedChannel.id}-${field.id}`;
                    const isPassword = field.kind === 'password';
                    const isVisible = showSecret[fieldKey];

                    return (
                      <label key={field.id} className="space-y-2">
                        <span className="text-white/38 text-xs font-medium uppercase tracking-[0.12em]">
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
                            className="border-white/8 bg-white/8 placeholder:text-white/22 focus:border-white/28 h-11 w-full rounded-lg border px-3 pr-10 text-sm text-white outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
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
                              className="text-white/36 absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 transition-colors hover:text-white"
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
                    <span className="text-white/38 text-xs font-medium uppercase tracking-[0.12em]">
                      {localize('com_agent_channel_field_callback_url')}
                    </span>
                    <input
                      className="border-white/8 bg-white/8 focus:border-white/28 h-11 w-full rounded-lg border px-3 text-sm text-white outline-none"
                      value={`/api/agents/${agentId}/channels/${selectedChannel.id}/callback`}
                      readOnly
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-white/38 text-xs font-medium uppercase tracking-[0.12em]">
                      {localize('com_agent_channel_retry_policy')}
                    </span>
                    <select className="border-white/8 bg-white/8 focus:border-white/28 h-11 w-full rounded-lg border px-3 text-sm text-white outline-none">
                      <option>{localize('com_agent_channel_retry_standard')}</option>
                      <option>{localize('com_agent_channel_retry_aggressive')}</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </section>

            <div className="flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-white">
                  {localize(
                    selectedChannel.scan
                      ? 'com_agent_channel_wechat_backend_hint'
                      : 'com_agent_channel_save_local_only',
                  )}
                </p>
                {!selectedChannel.scan && lastSavedPayload?.platform === selectedChannel.id ? (
                  <pre className="text-white/48 mt-3 max-h-40 overflow-auto rounded-lg border border-white/10 bg-black/25 p-3 text-left text-xs leading-5">
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
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:cursor-not-allowed disabled:opacity-45',
                    saved
                      ? 'bg-emerald-400 text-emerald-950'
                      : 'bg-white text-black hover:bg-white/85',
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wechat-qr-title"
        >
          <div className="w-full max-w-[460px] rounded-2xl border border-white/10 bg-[#14161d] p-6 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-3">
              <h2 id="wechat-qr-title" className="text-lg font-semibold text-white">
                {localize('com_agent_channel_wechat_scan_title')}
              </h2>
              <button
                type="button"
                onClick={closeWechatQrFlow}
                className="rounded-md p-1 text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                aria-label={localize('com_ui_close')}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-col items-center gap-4 py-7">
              {wechatQrStatus === 'loading' ? (
                <Loader2 className="size-10 animate-spin text-white/60" aria-hidden="true" />
              ) : null}

              {wechatQrContent && wechatQrStatus !== 'error' ? (
                <div className="rounded-2xl bg-white p-4">
                  <QRCodeSVG value={wechatQrContent} size={240} />
                </div>
              ) : null}

              {wechatQrStatus === 'wait' ? (
                <p className="text-white/52 text-center text-sm">
                  {localize('com_agent_channel_wechat_qr_wait')}
                </p>
              ) : null}

              {wechatQrStatus === 'scaned' ? (
                <p className="text-center text-sm text-sky-200">
                  {localize('com_agent_channel_wechat_qr_scaned')}
                </p>
              ) : null}

              {wechatQrStatus === 'confirmed' ? (
                <div className="space-y-3 text-center">
                  <p className="inline-flex items-center gap-2 text-sm text-emerald-200">
                    <CheckCircle2 className="size-4" aria-hidden="true" />
                    {localize('com_agent_channel_wechat_qr_confirmed')}
                  </p>
                  {wechatCredentials?.ilink_bot_id ? (
                    <p className="text-white/38 text-xs">{wechatCredentials.ilink_bot_id}</p>
                  ) : null}
                  {wechatProvider ? (
                    <p className="text-xs text-emerald-100">
                      {localize(`com_agent_channel_runtime_${wechatProvider.runtimeStatus}`)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {wechatQrStatus === 'error' || wechatQrError ? (
                <div className="flex w-full items-start gap-3 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span>{wechatQrError || localize('com_agent_channel_wechat_qr_error')}</span>
                </div>
              ) : null}

              {wechatQrCode ? (
                <div className="bg-white/8 text-white/34 max-w-full truncate rounded-full px-3 py-1 text-xs">
                  {wechatQrCode}
                </div>
              ) : null}
            </div>

            <div className="flex justify-end gap-2 border-t border-white/10 pt-4">
              <button
                type="button"
                onClick={startWechatQrFlow}
                className="hover:bg-white/8 inline-flex h-10 items-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {localize('com_agent_channel_wechat_qr_refresh')}
              </button>
              <button
                type="button"
                onClick={closeWechatQrFlow}
                className="h-10 rounded-md bg-white px-4 text-sm font-semibold text-black transition-colors hover:bg-white/85"
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
