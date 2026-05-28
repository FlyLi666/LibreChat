import { useState } from 'react';
import { useGetStartupConfig } from '~/data-provider';

const DEFAULT_NOTEBOOKLM_URL = 'https://notebook.flyli.cn';

export default function NotebookPage() {
  const [loading, setLoading] = useState(true);
  const { data: startupConfig } = useGetStartupConfig();
  const src = startupConfig?.notebookLmUrl || DEFAULT_NOTEBOOKLM_URL;

  return (
    <div className="relative flex h-full w-full flex-col bg-surface-primary">
      {loading && (
        <div
          aria-hidden="true"
          data-testid="notebook-loading"
          className="absolute inset-0 z-10 animate-pulse bg-surface-secondary"
        />
      )}
      <iframe
        src={src}
        title="NotebookLM"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        className="h-full w-full border-0 bg-surface-primary"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
