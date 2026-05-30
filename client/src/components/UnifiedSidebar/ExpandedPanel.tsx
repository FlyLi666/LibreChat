import { memo, useCallback, useContext, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useRecoilValue } from 'recoil';
import { HelpCircle, Monitor, Moon, SquarePen, Sun } from 'lucide-react';
import { QueryKeys } from 'librechat-data-provider';
import { Skeleton, Sidebar, Button, TooltipAnchor, ThemeContext } from '@librechat/client';
import type { NavLink } from '~/common';
import { CLOSE_SIDEBAR_ID } from '~/components/Chat/Menus/OpenSidebar';
import { useActivePanel, resolveActivePanel, DEFAULT_PANEL } from '~/Providers';
import { useLocalize, useNewConvo } from '~/hooks';
import { clearMessagesCache, cn } from '~/utils';
import store from '~/store';

const AccountSettings = lazy(() => import('~/components/Nav/AccountSettings'));

const themeOptions = [
  { value: 'system', labelKey: 'com_nav_theme_system', icon: Monitor },
  { value: 'dark', labelKey: 'com_nav_theme_dark', icon: Moon },
  { value: 'light', labelKey: 'com_nav_theme_light', icon: Sun },
] as const;

function SidebarThemeSwitch({ expanded }: { expanded: boolean }) {
  const localize = useLocalize();
  const { theme, setTheme } = useContext(ThemeContext);
  const activeTheme = themeOptions.some((option) => option.value === theme) ? theme : 'system';
  const currentIndex = themeOptions.findIndex((option) => option.value === activeTheme);
  const currentOption = themeOptions[currentIndex] ?? themeOptions[0];
  const nextOption = themeOptions[(currentIndex + 1) % themeOptions.length];
  const CurrentIcon = currentOption.icon;

  if (!expanded) {
    return (
      <TooltipAnchor
        side="right"
        description={`${localize('com_nav_theme')}: ${localize(currentOption.labelKey)}`}
        render={
          <Button
            size="icon"
            variant="ghost"
            aria-label={`${localize('com_nav_theme')}: ${localize(currentOption.labelKey)}`}
            className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            onClick={() => setTheme(nextOption.value)}
          >
            <CurrentIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        }
      />
    );
  }

  return (
    <div className="rounded-xl border border-border-light bg-surface-primary p-1">
      <div className="mb-1 px-1 text-xs font-medium text-text-secondary">
        {localize('com_nav_theme')}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {themeOptions.map((option) => {
          const Icon = option.icon;
          const isActive = option.value === activeTheme;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              aria-label={localize(option.labelKey)}
              onClick={() => setTheme(option.value)}
              className={cn(
                'flex h-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary',
                isActive && 'bg-surface-active-alt text-text-primary',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

const NewChatButton = memo(function NewChatButton({
  setActive,
  expanded = false,
}: {
  setActive: (id: string) => void;
  expanded?: boolean;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { newConversation } = useNewConvo();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const switchToHistory = useRecoilValue(store.newChatSwitchToHistory);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (e.button === 0 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        clearMessagesCache(queryClient, conversation?.conversationId);
        queryClient.invalidateQueries([QueryKeys.messages]);
        newConversation();
        if (switchToHistory) {
          setActive(DEFAULT_PANEL);
        }
      }
    },
    [queryClient, conversation?.conversationId, newConversation, switchToHistory, setActive],
  );

  return (
    <TooltipAnchor
      side="right"
      description={localize('com_ui_new_chat')}
      render={
        <a
          href="/c/new"
          data-testid="new-chat-button"
          aria-label={localize('com_ui_new_chat')}
          className={cn(
            'flex h-9 items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary',
            expanded ? 'w-full justify-start gap-2 px-2 text-sm' : 'w-9 justify-center',
          )}
          onClick={handleClick}
        >
          <SquarePen className="h-5 w-5 flex-shrink-0 text-text-primary" />
          {expanded && <span className="truncate">{localize('com_ui_new_chat')}</span>}
        </a>
      }
    />
  );
});

const SidebarNavButton = memo(function SidebarNavButton({
  link,
  isActive,
  expanded,
  setActive,
  onExpand,
  onCollapse,
}: {
  link: NavLink;
  isActive: boolean;
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const localize = useLocalize();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (link.onClick) {
        link.onClick(e);
        if (!link.Component) {
          onCollapse?.();
        }
        return;
      }
      setActive(link.id);
      onExpand?.();
    },
    [link, onCollapse, onExpand, setActive],
  );

  return (
    <TooltipAnchor
      description={localize(link.title)}
      side="right"
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={localize(link.title)}
          aria-pressed={isActive}
          className={cn(
            'h-9 rounded-lg transition-colors',
            expanded ? 'w-full justify-start gap-2 px-2 text-sm' : 'w-9',
            isActive
              ? 'bg-surface-active-alt text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          )}
          onClick={handleClick}
        >
          <link.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {expanded && <span className="truncate">{localize(link.title)}</span>}
        </Button>
      }
    />
  );
});

const NavIconButton = memo(function NavIconButton({
  link,
  isActive,
  expanded,
  setActive,
  onExpand,
  onCollapse,
}: {
  link: NavLink;
  isActive: boolean;
  expanded: boolean;
  setActive: (id: string) => void;
  onExpand?: () => void;
  onCollapse?: () => void;
}) {
  const localize = useLocalize();

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (link.onClick) {
        link.onClick(e);
        if (!link.Component) {
          onCollapse?.();
        }
        return;
      }
      if (isActive && expanded) {
        onCollapse?.();
        return;
      }
      if (!isActive) {
        setActive(link.id);
      }
      if (!expanded) {
        onExpand?.();
      }
    },
    [link, isActive, setActive, expanded, onExpand, onCollapse],
  );

  return (
    <TooltipAnchor
      description={localize(link.title)}
      side="right"
      render={
        <Button
          size="icon"
          variant="ghost"
          aria-label={localize(link.title)}
          aria-pressed={isActive}
          className={cn(
            'h-9 w-9 rounded-lg',
            isActive
              ? 'bg-surface-active-alt text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
          )}
          onClick={handleClick}
        >
          <link.icon className="h-5 w-5" aria-hidden="true" />
        </Button>
      }
    />
  );
});

function ExpandedPanel({
  links,
  primaryLinks = [],
  workspaceLinks = [],
  assistantLinks = [],
  expanded = true,
  secondaryPanelOpen = false,
  onCollapse,
  onExpand,
}: {
  links: NavLink[];
  primaryLinks?: NavLink[];
  workspaceLinks?: NavLink[];
  assistantLinks?: NavLink[];
  expanded?: boolean;
  secondaryPanelOpen?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const location = useLocation();
  const resolvedAssistantLinks = assistantLinks.length > 0 ? assistantLinks : primaryLinks;
  const conversationsLink = links.find((link) => link.id === DEFAULT_PANEL) ?? links[0];
  const activePanelId = resolveActivePanel(active, links);
  const secondaryLinks = links.filter((link) => link.id !== DEFAULT_PANEL);
  const routeActive = (() => {
    if (location.pathname === '/image') {
      return 'image';
    }
    if (location.pathname === '/notebook') {
      return 'documents';
    }
    if (location.pathname === '/community/mcp' || location.pathname.startsWith('/community/mcp/')) {
      return 'resources';
    }
    if (location.pathname.startsWith('/community')) {
      return 'community-market';
    }
    if (location.pathname === '/agent/lobe-ai/channel') {
      return 'wechat-bot';
    }
    if (location.pathname.startsWith('/agent')) {
      return 'lobe-ai';
    }
    if (location.pathname === '/' || location.pathname.startsWith('/c/')) {
      return 'home';
    }
    return undefined;
  })();
  const effectiveActive = routeActive ?? activePanelId;
  const showPanelLinks = !routeActive && !expanded;
  const showRecentConversations =
    !routeActive ||
    routeActive === 'home' ||
    routeActive === 'lobe-ai' ||
    routeActive === 'wechat-bot';
  const showChatTools = !routeActive || routeActive === 'home' || routeActive === 'lobe-ai';
  const isNavLinkActive = useCallback(
    (link: NavLink) =>
      link.id === effectiveActive || (location.pathname === '/notebook' && link.id === 'notebook'),
    [effectiveActive, location.pathname],
  );

  const toggleLabel = expanded ? 'com_nav_close_sidebar' : 'com_nav_open_sidebar';
  const toggleClick = expanded ? onCollapse : onExpand;
  let panelSizeClass = 'w-[52px] gap-2';
  if (expanded) {
    panelSizeClass = secondaryPanelOpen ? 'w-[300px] gap-3' : 'w-full gap-3';
  }

  return (
    <div
      className={cn(
        'flex h-full flex-shrink-0 flex-col border-r border-border-light bg-surface-primary-alt px-2 py-2',
        panelSizeClass,
      )}
    >
      <div
        className={cn('flex items-center', expanded ? 'justify-between gap-2' : 'justify-center')}
      >
        {expanded && (
          <div className="min-w-0 px-1">
            <div className="truncate text-sm font-semibold text-text-primary">
              {localize('com_nav_hezi_space')}
            </div>
            <div className="truncate text-xs text-text-secondary">
              {localize('com_nav_lobe_ai')}
            </div>
          </div>
        )}
        <TooltipAnchor
          side="right"
          description={localize(toggleLabel)}
          render={
            <Button
              id={expanded ? CLOSE_SIDEBAR_ID : undefined}
              data-testid={expanded ? 'close-sidebar-button' : 'open-sidebar-button'}
              size="icon"
              variant="ghost"
              aria-label={localize(toggleLabel)}
              aria-expanded={expanded}
              className="h-9 w-9 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              onClick={toggleClick}
            >
              <Sidebar aria-hidden="true" className="h-5 w-5" />
            </Button>
          }
        />
      </div>

      <NewChatButton setActive={setActive} expanded={expanded} />

      {expanded ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
          <nav className="flex flex-col gap-1" aria-label={localize('com_nav_workspace')}>
            {workspaceLinks.map((link) => (
              <SidebarNavButton
                key={link.id}
                link={link}
                isActive={isNavLinkActive(link)}
                expanded={expanded}
                setActive={setActive}
                onExpand={onExpand}
                onCollapse={onCollapse}
              />
            ))}
          </nav>

          {showRecentConversations && (
            <section className="flex flex-none flex-col gap-2 overflow-hidden">
              <div className="px-2 text-xs font-medium text-text-secondary">
                {localize('com_nav_recent')}
              </div>
              <div className="overflow-hidden">
                {conversationsLink?.Component ? <conversationsLink.Component /> : null}
              </div>
            </section>
          )}

          <nav className="flex flex-col gap-1" aria-label={localize('com_nav_assistants')}>
            <div className="px-2 text-xs font-medium text-text-secondary">
              {localize('com_nav_assistants')}
            </div>
            {resolvedAssistantLinks.map((link) => (
              <SidebarNavButton
                key={link.id}
                link={link}
                isActive={isNavLinkActive(link)}
                expanded={expanded}
                setActive={setActive}
                onExpand={onExpand}
                onCollapse={onCollapse}
              />
            ))}
          </nav>

          {showChatTools && secondaryLinks.length > 0 && (
            <nav className="flex flex-col gap-1" aria-label={localize('com_nav_chat_tools')}>
              <div className="px-2 text-xs font-medium text-text-secondary">
                {localize('com_nav_chat_tools')}
              </div>
              {secondaryLinks.map((link) => (
                <SidebarNavButton
                  key={link.id}
                  link={link}
                  isActive={isNavLinkActive(link)}
                  expanded={expanded}
                  setActive={setActive}
                  onExpand={onExpand}
                  onCollapse={onCollapse}
                />
              ))}
            </nav>
          )}
        </div>
      ) : (
        <>
          {[...workspaceLinks, ...resolvedAssistantLinks].map((link) => (
            <SidebarNavButton
              key={link.id}
              link={link}
              isActive={isNavLinkActive(link)}
              expanded={expanded}
              setActive={setActive}
              onExpand={onExpand}
              onCollapse={onCollapse}
            />
          ))}
        </>
      )}

      {showPanelLinks && (
        <>
          <div className="mx-2 border-b border-border-light" />
          <div className="flex flex-col gap-1 overflow-y-auto">
            {links.map((link) => (
              <NavIconButton
                key={link.id}
                link={link}
                isActive={link.id === effectiveActive}
                expanded={expanded ?? true}
                setActive={setActive}
                onExpand={onExpand}
                onCollapse={onCollapse}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-auto flex flex-col gap-1">
        <SidebarThemeSwitch expanded={expanded} />
        <TooltipAnchor
          side="right"
          description={localize('com_nav_help_faq')}
          render={
            <Button
              size="icon"
              variant="ghost"
              aria-label={localize('com_nav_help_faq')}
              className={cn(
                'h-9 rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                expanded ? 'w-full justify-start gap-2 px-2 text-sm' : 'w-9',
              )}
            >
              <HelpCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {expanded && <span className="truncate">{localize('com_nav_help_faq')}</span>}
            </Button>
          }
        />
        <Suspense fallback={<Skeleton className="h-9 w-9 rounded-lg" />}>
          <AccountSettings collapsed />
        </Suspense>
      </div>
    </div>
  );
}

export default memo(ExpandedPanel);
