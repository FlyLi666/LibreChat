import { LocalStorageKeys } from 'librechat-data-provider';

export const DEFAULT_APP_TITLE = 'HeZi';

export function getAppTitle(fallback = DEFAULT_APP_TITLE) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  return window.localStorage.getItem(LocalStorageKeys.APP_TITLE) || fallback;
}

export function setDocumentTitle(title?: string | null) {
  if (typeof document === 'undefined') {
    return;
  }

  const normalizedTitle = title?.trim();
  const appTitle = getAppTitle();
  document.title = normalizeDocumentTitle(normalizedTitle, appTitle);
}

export function normalizeDocumentTitle(title?: string | null, appTitle = DEFAULT_APP_TITLE) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return appTitle;
  }

  if (normalizedTitle === 'LibreChat') {
    return appTitle;
  }

  return normalizedTitle.replace(/\s+\|\s+LibreChat$/, ` | ${appTitle}`);
}
