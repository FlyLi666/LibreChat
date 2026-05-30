import { memo, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { NavLink } from '~/common';
import { DEFAULT_PANEL, resolveActivePanel, useActivePanel } from '~/Providers';
import SidePanelNav from '~/components/SidePanel/Nav';
import ExpandedPanel from './ExpandedPanel';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

function Sidebar({
  workspaceLinks,
  assistantLinks,
  panelLinks,
  expanded,
  onCollapse,
  onExpand,
  onResizeStart,
  onResizeKeyboard,
  onSecondaryPanelChange,
  mobile = false,
}: {
  workspaceLinks: NavLink[];
  assistantLinks: NavLink[];
  panelLinks: NavLink[];
  expanded: boolean;
  onCollapse: () => void;
  onExpand: () => void;
  onResizeStart?: (e: React.MouseEvent) => void;
  onResizeKeyboard?: (direction: 'shrink' | 'grow') => void;
  onSecondaryPanelChange?: (open: boolean) => void;
  mobile?: boolean;
}) {
  const localize = useLocalize();
  const { active, setActive } = useActivePanel();
  const secondaryPanelLinks = panelLinks.filter((link) => link.id !== DEFAULT_PANEL);
  const activePanelId = resolveActivePanel(active, panelLinks);
  const activePanelLink = secondaryPanelLinks.find((link) => link.id === activePanelId);
  const showSecondaryPanel =
    expanded && secondaryPanelLinks.some((link) => link.id === activePanelId && link.Component);

  useEffect(() => {
    onSecondaryPanelChange?.(showSecondaryPanel);
  }, [onSecondaryPanelChange, showSecondaryPanel]);

  if (mobile && showSecondaryPanel) {
    return (
      <div className="flex h-full w-full flex-col bg-surface-primary-alt">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-light px-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text-primary"
            aria-label={localize('com_ui_back')}
            onClick={() => setActive(DEFAULT_PANEL)}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="min-w-0 truncate text-sm font-semibold text-text-primary">
            {activePanelLink ? localize(activePanelLink.title) : localize('com_nav_hezi_space')}
          </div>
        </div>
        <nav className="min-h-0 flex-1 overflow-hidden" aria-hidden={false}>
          <SidePanelNav links={secondaryPanelLinks} />
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full w-full overflow-hidden">
        <ExpandedPanel
          links={panelLinks}
          workspaceLinks={workspaceLinks}
          assistantLinks={assistantLinks}
          expanded={expanded}
          secondaryPanelOpen={showSecondaryPanel}
          onCollapse={onCollapse}
          onExpand={onExpand}
        />
        <nav
          className={cn(
            'min-h-0 overflow-hidden border-r border-border-light bg-surface-primary-alt',
            showSecondaryPanel ? 'w-full opacity-100' : 'pointer-events-none w-0 opacity-0',
          )}
          style={{ transition: expanded ? 'opacity 200ms ease 80ms' : 'opacity 150ms ease' }}
          aria-hidden={!showSecondaryPanel}
        >
          <SidePanelNav links={secondaryPanelLinks} />
        </nav>
      </div>
      {!mobile && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={expanded ? 0 : -1}
          className={cn(
            'absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize transition-colors hover:bg-border-medium active:bg-border-heavy',
            expanded ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
          style={{ transition: expanded ? 'opacity 200ms ease 80ms' : 'opacity 150ms ease' }}
          onMouseDown={onResizeStart}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              onResizeKeyboard?.('shrink');
            } else if (e.key === 'ArrowRight') {
              onResizeKeyboard?.('grow');
            }
          }}
        />
      )}
    </>
  );
}

export default memo(Sidebar);
