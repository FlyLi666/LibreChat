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
  document.title = normalizedTitle || getAppTitle();
}
