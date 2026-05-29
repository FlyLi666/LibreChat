import { useState } from 'react';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';

const DEFAULT_NOTEBOOKLM_URL = 'https://notebook.flyli.cn';

export default function NotebookPage() {
  const [loading, setLoading] = useState(true);
  const { data: startupConfig } = useGetStartupConfig();
  const localize = useLocalize();
  const src = startupConfig?.notebookLmUrl || DEFAULT_NOTEBOOKLM_URL;

  return (
    <div className="relative flex h-full w-full flex-col bg-surface-primary">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-light bg-surface-primary px-3 md:hidden">
        <OpenSidebar />
        <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary">
          {localize('com_nav_notebooklm')}
        </h1>
      </div>
      {loading && (
        <div
          aria-hidden="true"
          data-testid="notebook-loading"
          className="absolute inset-x-0 bottom-0 top-12 z-10 animate-pulse bg-surface-secondary md:top-0"
        />
      )}
      <iframe
        src={src}
        title="NotebookLM"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        className="min-h-0 flex-1 border-0 bg-surface-primary"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
