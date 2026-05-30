import { memo, useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useMediaQuery } from '@librechat/client';
import { Bot } from 'lucide-react';
import { getConfigDefaults, PermissionTypes, Permissions } from 'librechat-data-provider';
import { useParams } from 'react-router-dom';
import { useGetStartupConfig } from '~/data-provider';
import ExportAndShareMenu from './ExportAndShareMenu';
import { OpenSidebar, PresetsMenu } from './Menus';
import BookmarkMenu from './Menus/BookmarkMenu';
import { TemporaryChat } from './TemporaryChat';
import AddMultiConvo from './AddMultiConvo';
import { useHasAccess } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const defaultInterface = getConfigDefaults().interface;

function Header() {
  const { data: startupConfig } = useGetStartupConfig();
  const { agentId } = useParams();
  const navVisible = useRecoilValue(store.sidebarExpanded);
  const conversation = useRecoilValue(store.conversationByIndex(0));

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const hasAccessToBookmarks = useHasAccess({
    permissionType: PermissionTypes.BOOKMARKS,
    permission: Permissions.USE,
  });

  const hasAccessToMultiConvo = useHasAccess({
    permissionType: PermissionTypes.MULTI_CONVO,
    permission: Permissions.USE,
  });

  const hasAccessToTemporaryChat = useHasAccess({
    permissionType: PermissionTypes.TEMPORARY_CHAT,
    permission: Permissions.USE,
  });

  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const topicTitle =
    conversation?.title && conversation.title !== 'New Chat' ? conversation.title : '新话题';
  const agentLabel = agentId === 'lobe-ai' ? 'Lobe AI' : agentId;

  return (
    <div className="bg-surface-primary/90 absolute top-0 z-10 flex h-[52px] w-full items-center justify-between p-2 font-semibold text-text-primary backdrop-blur-md dark:bg-[#090b10]/85">
      <div className="hide-scrollbar flex w-full items-center justify-between gap-2 overflow-x-auto">
        <div className="mx-1 flex items-center">
          <OpenSidebar className="md:hidden" />
          {!(navVisible && isSmallScreen) && (
            <div
              className={cn(
                'flex items-center gap-2 pl-2',
                !isSmallScreen ? 'transition-all duration-200 ease-in-out' : '',
              )}
            >
              <div className="flex h-9 max-w-[42vw] items-center gap-2 rounded-xl border border-border-light bg-presentation px-3 py-2 text-sm text-text-primary">
                <Bot className="h-4 w-4 flex-shrink-0 text-text-secondary" aria-hidden="true" />
                <span className="truncate">
                  {agentLabel ? `${agentLabel} / ${topicTitle}` : topicTitle}
                </span>
              </div>
              {isSmallScreen && (
                <>
                  {interfaceConfig.presets === true && interfaceConfig.modelSelect && (
                    <PresetsMenu />
                  )}
                  {hasAccessToBookmarks === true && <BookmarkMenu />}
                  {hasAccessToMultiConvo === true && <AddMultiConvo />}
                  <ExportAndShareMenu
                    isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
                  />
                  {hasAccessToTemporaryChat === true && <TemporaryChat />}
                </>
              )}
            </div>
          )}
        </div>

        {!isSmallScreen && (
          <div className="flex items-center gap-2">
            {interfaceConfig.presets === true && interfaceConfig.modelSelect && <PresetsMenu />}
            {hasAccessToBookmarks === true && <BookmarkMenu />}
            {hasAccessToMultiConvo === true && <AddMultiConvo />}
            <ExportAndShareMenu
              isSharedButtonEnabled={startupConfig?.sharedLinksEnabled ?? false}
            />
            {hasAccessToTemporaryChat === true && <TemporaryChat />}
          </div>
        )}
      </div>
      {/* Empty div for spacing */}
      <div />
    </div>
  );
}

const MemoizedHeader = memo(Header);
MemoizedHeader.displayName = 'Header';

export default MemoizedHeader;
