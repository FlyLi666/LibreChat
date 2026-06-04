import { LocalStorageKeys } from 'librechat-data-provider';
import { getAppTitle, normalizeDocumentTitle, setDocumentTitle } from '../documentTitle';

describe('documentTitle utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    document.title = '';
  });

  it('uses the HeZi product title when local storage has no configured title', () => {
    setDocumentTitle();

    expect(document.title).toBe('HeZi');
    expect(getAppTitle()).toBe('HeZi');
  });

  it('uses the configured app title as fallback for blank conversation titles', () => {
    localStorage.setItem(LocalStorageKeys.APP_TITLE, 'HeZi Preview');

    setDocumentTitle('  ');

    expect(document.title).toBe('HeZi Preview');
  });

  it('keeps non-empty conversation titles', () => {
    localStorage.setItem(LocalStorageKeys.APP_TITLE, 'HeZi');

    setDocumentTitle('Research notes');

    expect(document.title).toBe('Research notes');
  });

  it('rebrands legacy LibreChat title suffixes', () => {
    localStorage.setItem(LocalStorageKeys.APP_TITLE, 'HeZi');

    setDocumentTitle('Agent Marketplace | LibreChat');

    expect(document.title).toBe('Agent Marketplace | HeZi');
  });

  it('does not rewrite LibreChat mentions inside regular titles', () => {
    expect(normalizeDocumentTitle('Terms of Service for LibreChat', 'HeZi')).toBe(
      'Terms of Service for LibreChat',
    );
  });
});
