import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AgentRoute from '../AgentRoute';

const mockCreateAgentMutateAsync = jest.fn();
const mockUpdateAgentMutateAsync = jest.fn();
const mockExpandedAgent = {
  id: 'agent-real-id',
  name: 'Lobe AI',
  description: 'Personal assistant',
  instructions: 'Saved instructions',
  model: 'gpt-4',
  model_parameters: {},
  provider: 'openAI',
  tools: ['web_search', 'execute_code'],
};

if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(
      public url: string,
      public init?: RequestInit,
    ) {}
  } as any;
}

jest.mock('~/Providers', () => ({
  useAgentsMapContext: () => ({
    'agent-real-id': {
      id: 'agent-real-id',
      name: 'Lobe AI',
      description: 'Personal assistant',
      avatar: null,
      created_at: 0,
      provider: 'openAI',
      model: 'gpt-4',
      model_parameters: {},
    },
  }),
}));

jest.mock('~/data-provider', () => ({
  useConversationsInfiniteQuery: () => ({
    data: { pages: [{ conversations: [], nextCursor: null }] },
    fetchNextPage: jest.fn(),
    isFetchingNextPage: false,
    isLoading: false,
  }),
}));

jest.mock('~/data-provider/Agents', () => ({
  useCreateAgentMutation: () => ({
    isLoading: false,
    mutateAsync: mockCreateAgentMutateAsync,
  }),
  useGetExpandedAgentByIdQuery: () => ({
    data: mockExpandedAgent,
    isLoading: false,
  }),
  useUpdateAgentMutation: () => ({
    isLoading: false,
    mutateAsync: mockUpdateAgentMutateAsync,
  }),
}));

jest.mock('../ChatRoute', () => ({
  __esModule: true,
  default: () => <div data-testid="chat-route" />,
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_agent_message_channels: 'Message channels',
      com_agent_model_gemini_flash: 'Gemini 3.5 Flash',
      com_agent_back_to_chat: 'Back to chat',
      com_agent_channel_api: 'API',
      com_agent_channel_api_subtitle: 'Programmatic access',
      com_agent_channel_config_hint: 'Configure this channel inline.',
      com_agent_channel_discord: 'Discord',
      com_agent_channel_discord_subtitle: 'Discord bot and server channels',
      com_agent_channel_docs: 'Docs',
      com_agent_channel_feishu: 'Feishu',
      com_agent_channel_feishu_subtitle: 'Feishu custom app',
      com_agent_channel_field_access_token: 'Access Token',
      com_agent_channel_field_app_id: 'Application ID / Bot username',
      com_agent_channel_field_app_secret: 'App Secret',
      com_agent_channel_field_bot_app_id: 'Bot AppID',
      com_agent_channel_field_bot_secret: 'Bot secret',
      com_agent_channel_field_bot_token: 'Bot Token / API Key',
      com_agent_channel_field_callback_url: 'Callback URL',
      com_agent_channel_field_channel_id: 'Channel ID',
      com_agent_channel_field_channel_secret: 'Channel secret',
      com_agent_channel_field_client_id: 'Client ID',
      com_agent_channel_field_client_secret: 'Client Secret',
      com_agent_channel_field_default_hint: 'The token will be encrypted.',
      com_agent_channel_field_device_id: 'Device ID',
      com_agent_channel_field_encoding_aes_key: 'EncodingAESKey',
      com_agent_channel_field_phone_number_id: 'Phone number ID',
      com_agent_channel_field_public_key: 'Public key',
      com_agent_channel_field_relay_token: 'Relay token',
      com_agent_channel_field_signing_secret: 'Signing Secret',
      com_agent_channel_field_token: 'Token',
      com_agent_channel_field_verification_token: 'Verification Token',
      com_agent_channel_field_verify_token: 'Verify Token',
      com_agent_channel_field_webhook_secret: 'Webhook Secret',
      com_agent_channel_imessage: 'iMessage',
      com_agent_channel_imessage_subtitle: 'Apple Messages relay',
      com_agent_channel_lark: 'Lark',
      com_agent_channel_lark_subtitle: 'Lark custom app',
      com_agent_channel_line: 'LINE',
      com_agent_channel_line_subtitle: 'LINE Messaging API',
      com_agent_channel_open_platform: 'Open platform',
      com_agent_channel_qq: 'QQ',
      com_agent_channel_qq_subtitle: 'QQ bot and group messages',
      com_agent_channel_quick_start: 'Start without setup',
      com_agent_channel_quick_start_desc: 'Talk with LobeHub directly.',
      com_agent_channel_retry_aggressive: 'Aggressive retry',
      com_agent_channel_retry_policy: 'Retry policy',
      com_agent_channel_retry_standard: 'Standard retry',
      com_agent_channel_scan_connect: 'Scan to connect',
      com_agent_channel_save_local_only:
        'Saved locally only. Backend persistence is not wired for this channel yet.',
      com_agent_channel_saved_local: 'Saved local config',
      com_agent_channel_slack: 'Slack',
      com_agent_channel_slack_subtitle: 'Slack app and workspace',
      com_agent_channel_telegram: 'Telegram',
      com_agent_channel_telegram_subtitle: 'Telegram bot and webhook',
      com_agent_channel_toggle_secret: 'Show or hide secret',
      com_agent_channel_web: 'Web',
      com_agent_channel_web_subtitle: 'Browser chat',
      com_agent_channel_wechat: 'WeChat',
      com_agent_channel_wechat_backend_hint:
        'WeChat uses the connected channel backend. Use QR binding, disconnect, or reconnect here.',
      com_agent_channel_wechat_connect_error: 'WeChat could not connect.',
      com_agent_channel_wechat_connected: 'WeChat is connected',
      com_agent_channel_wechat_disconnect: 'Disconnect',
      com_agent_channel_wechat_disconnect_error: 'WeChat could not disconnect.',
      com_agent_channel_wechat_qr_confirmed: 'Login confirmed.',
      com_agent_channel_wechat_qr_error: 'Failed to get the QR code.',
      com_agent_channel_wechat_qr_refresh: 'Refresh QR code',
      com_agent_channel_wechat_qr_scaned: 'Scanned.',
      com_agent_channel_wechat_qr_wait: 'Scan this QR code with WeChat.',
      com_agent_channel_wechat_scan_hint: 'Update WeChat and restart it.',
      com_agent_channel_wechat_scan_title: 'Connect with WeChat QR code',
      com_agent_channel_wechat_rebind: 'Rebind',
      com_agent_channel_wechat_reconnect: 'Reconnect',
      com_agent_channel_wechat_start_error: 'WeChat could not reconnect.',
      com_agent_channel_wechat_subtitle: 'Official Account / WeChat plugin',
      com_agent_channel_webhook: 'Webhook',
      com_agent_channel_webhook_subtitle: 'External event delivery',
      com_agent_channel_runtime_connected: 'Connected',
      com_agent_channel_runtime_connecting: 'Connecting',
      com_agent_channel_runtime_disconnected: 'Disconnected',
      com_agent_channel_runtime_failed: 'Failed',
      com_agent_channel_whatsapp: 'WhatsApp',
      com_agent_channel_whatsapp_subtitle: 'WhatsApp Business entry',
      com_agent_channels_subtitle: 'Manage where this assistant can receive messages.',
      com_agent_configure: 'Configure',
      com_agent_conversation_page: 'Conversation page',
      com_agent_conversation_page_hint: 'Page entry reserved for this conversation.',
      com_agent_conversation_page_subtitle: 'Manage the page surface for this topic.',
      com_agent_description: 'Description',
      com_agent_disabled: 'Disabled',
      com_agent_enabled: 'Enabled',
      com_agent_endpoint: 'Endpoint',
      com_agent_advanced_settings: 'Advanced settings',
      com_agent_instructions_markdown: 'Instructions',
      com_agent_load_more_topics: 'Load more topics',
      com_agent_lookup_fallback: 'Agent lookup did not resolve',
      com_agent_lookup_loading: 'Resolving assistant...',
      com_agent_model: 'Model',
      com_agent_name: 'Name',
      com_agent_new_topic_subtitle: 'Open a fresh conversation inside this assistant room.',
      com_agent_new_topic_title: 'Start a new topic',
      com_agent_optional_token: 'Optional token',
      com_agent_profile: 'Assistant profile',
      com_agent_profile_save_error: 'Failed to save assistant profile.',
      com_agent_profile_subtitle: 'Edit the identity, model, skills, and markdown instructions.',
      com_agent_recent_topic: 'Recent assistant topic',
      com_agent_save_channel_config: 'Save configuration',
      com_agent_save_profile: 'Save profile',
      com_agent_saved: 'Saved',
      com_agent_search_topics: 'Search topics',
      com_agent_sort_recent: 'Recent',
      com_agent_sort_title: 'Title',
      com_agent_soon: 'Soon',
      com_agent_task_backlog: 'Backlog',
      com_agent_task_done: 'Done',
      com_agent_task_empty_group: 'No tasks in this group.',
      com_agent_task_no_selection: 'Select a task',
      com_agent_task_no_selection_subtitle: 'Choose a task to see details.',
      com_agent_task_notes: 'Task notes',
      com_agent_task_running: 'Running',
      com_agent_tasks: 'Tasks',
      com_agent_tasks_subtitle: 'Track running, backlog, and done work for this assistant.',
      com_agent_token: 'Token',
      com_agent_topics: 'Topics',
      com_agent_topics_empty: 'No topics for this assistant yet.',
      com_agent_topics_empty_subtitle: 'Assistant-scoped conversations will appear here.',
      com_agent_topics_subtitle: 'Search, sort, and open assistant-scoped topics.',
      com_agent_topics_unavailable: 'Topics need a resolved assistant id.',
      com_ui_add: 'Add',
      com_image_new_topic: 'New topic',
      com_ui_loading: 'Loading...',
      com_ui_new_conversation_title: 'New Conversation Title',
      com_ui_no_results_found: 'No results found',
      com_ui_search: 'Search',
    })[key] ?? key,
}));

function renderAgentRoute(initialEntry: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/agent/:agentId',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/profile',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/topics',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/channel',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/task',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/task/:taskId',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/:conversationId/page',
        element: <AgentRoute />,
      },
      {
        path: '/agent/:agentId/:conversationId?',
        element: <AgentRoute />,
      },
      {
        path: '/c/new',
        element: <div data-testid="fallback-chat" />,
      },
    ],
    { initialEntries: [initialEntry] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

describe('AgentRoute', () => {
  beforeEach(() => {
    mockCreateAgentMutateAsync.mockReset();
    mockCreateAgentMutateAsync.mockResolvedValue({ id: 'agent-created-id' });
    mockUpdateAgentMutateAsync.mockReset();
    mockUpdateAgentMutateAsync.mockResolvedValue({});

    global.fetch = jest.fn(async (url) => {
      if (String(url).endsWith('/api/agents/channel/lobe-ai/wechat')) {
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not connected' }),
        } as Response;
      }

      if (String(url).includes('/status')) {
        return {
          ok: true,
          json: async () => ({ status: 'wait' }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          qrcode: 'qr-real-123',
          qrcodeContent: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
        }),
      } as Response;
    });
  });

  it('renders the assistant layout around the existing chat route', () => {
    renderAgentRoute('/agent/lobe-ai/conversation-123');

    expect(screen.getByTestId('assistant-layout')).toBeInTheDocument();
    expect(screen.getByTestId('agent-sidebar')).toBeInTheDocument();
    expect(screen.getByText('Lobe AI')).toBeInTheDocument();
    expect(screen.getByTestId('chat-route')).toBeInTheDocument();
  });

  it('renders the assistant shell for bare assistant URLs', () => {
    const router = renderAgentRoute('/agent/lobe-ai');

    expect(router.state.location.pathname).toBe('/agent/lobe-ai');
    expect(screen.getByTestId('assistant-layout')).toBeInTheDocument();
    expect(screen.getByTestId('agent-new-topic-entry')).toBeInTheDocument();
  });

  it.each([
    ['/agent/lobe-ai/profile', 'agent-profile-page'],
    ['/agent/lobe-ai/topics', 'agent-topics-page'],
    ['/agent/lobe-ai/channel', 'agent-channel-page'],
    ['/agent/lobe-ai/task', 'agent-task-page'],
    ['/agent/lobe-ai/task/live-profile-polish', 'agent-task-page'],
  ])('renders assistant subroute %s without falling through to chat', (path, testId) => {
    renderAgentRoute(path);

    expect(screen.getByTestId('assistant-layout')).toBeInTheDocument();
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByTestId('chat-route')).not.toBeInTheDocument();
  });

  it('persists assistant profile edits through the agent update mutation', async () => {
    renderAgentRoute('/agent/lobe-ai/profile');

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Lobe AI Saved' },
    });
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Persisted assistant description.' },
    });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Always answer with saved instructions.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() =>
      expect(mockUpdateAgentMutateAsync).toHaveBeenCalledWith({
        agent_id: 'agent-real-id',
        data: expect.objectContaining({
          description: 'Persisted assistant description.',
          instructions: 'Always answer with saved instructions.',
          model: 'gpt-4',
          name: 'Lobe AI Saved',
          skills: expect.arrayContaining(['search', 'code']),
          skills_enabled: true,
          tools: expect.arrayContaining(['web_search', 'execute_code']),
        }),
      }),
    );
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument();
  });

  it('renders Lobe-style message channels including QQ and WeChat configuration surfaces', async () => {
    renderAgentRoute('/agent/lobe-ai/channel');

    expect(screen.getByRole('button', { name: /Discord/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /QQ/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /WeChat/ })).toBeInTheDocument();
    expect(screen.getByText('Application ID / Bot username')).toBeInTheDocument();
    expect(screen.getByText('Bot Token / API Key')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /QQ/ }));
    expect(screen.getByText('Bot AppID')).toBeInTheDocument();
    expect(screen.getByText('Bot secret')).toBeInTheDocument();
    expect(screen.getByText('Callback URL')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Advanced settings' }));
    expect(screen.getByText('Token')).toBeInTheDocument();
    expect(screen.getByText('EncodingAESKey')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /WeChat/ }));
    expect(screen.getByRole('button', { name: 'Scan to connect' })).toBeInTheDocument();
    expect(screen.getByText('Advanced settings')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Scan to connect' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Connect with WeChat QR code')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Scan this QR code with WeChat.')).toBeInTheDocument(),
    );
  });

  it('renders connected WeChat actions and calls reconnect and disconnect APIs', async () => {
    global.fetch = jest.fn(async (url, _init) => {
      const urlString = String(url);

      if (urlString.endsWith('/api/agents/channel/lobe-ai/wechat/start')) {
        return {
          ok: true,
          json: async () => ({
            applicationId: 'wx-bot-001',
            id: 'provider-1',
            runtimeStatus: 'connecting',
          }),
        } as Response;
      }

      if (urlString.endsWith('/api/agents/channel/lobe-ai/wechat/disconnect')) {
        return {
          ok: true,
          json: async () => ({
            applicationId: 'wx-bot-001',
            id: 'provider-1',
            runtimeStatus: 'disconnected',
          }),
        } as Response;
      }

      if (urlString.endsWith('/api/agents/channel/lobe-ai/wechat')) {
        return {
          ok: true,
          json: async () => ({
            applicationId: 'wx-bot-001',
            id: 'provider-1',
            runtimeStatus: 'connected',
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({
          qrcode: 'qr-real-123',
          qrcodeContent: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
        }),
      } as Response;
    });

    renderAgentRoute('/agent/lobe-ai/channel');
    fireEvent.click(screen.getByRole('button', { name: /WeChat/ }));

    expect(await screen.findByText('WeChat is connected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rebind' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reconnect' }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agents/channel/lobe-ai/wechat/start',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/agents/channel/lobe-ai/wechat/disconnect',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('renders the reserved conversation page route without breaking normal chat topics', () => {
    renderAgentRoute('/agent/lobe-ai/conversation-123/page');

    expect(screen.getByTestId('assistant-layout')).toBeInTheDocument();
    expect(screen.getByTestId('agent-conversation-page')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-route')).not.toBeInTheDocument();
  });
});
