import { useEffect, useState } from 'react';
import { dataService } from 'librechat-data-provider';
import { useLocalize } from '~/hooks';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';

export default function NotebookPage() {
  const [loading, setLoading] = useState(true);
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');
  const localize = useLocalize();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    dataService
      .getHeziNotebookSession()
      .then((session) => {
        if (cancelled) {
          return;
        }
        setSrc(session.url);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setError(err?.message || 'NotebookLM 暂时无法打开');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
      {error ? (
        <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-secondary p-6">
          <div
            role="alert"
            className="max-w-md rounded-lg border border-border-light bg-surface-primary px-4 py-3 text-sm text-text-secondary"
          >
            {error}
          </div>
        </div>
      ) : (
        src && (
          <iframe
            src={src}
            title="NotebookLM"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            className="min-h-0 flex-1 border-0 bg-surface-primary"
            onLoad={() => setLoading(false)}
          />
        )
      )}
    </div>
  );
}
