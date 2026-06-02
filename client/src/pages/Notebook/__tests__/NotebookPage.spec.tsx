import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import NotebookPage from '../NotebookPage';

const mockGetHeziNotebookSession = jest.fn();

jest.mock('librechat-data-provider', () => ({
  ...jest.requireActual('librechat-data-provider'),
  dataService: {
    ...jest.requireActual('librechat-data-provider').dataService,
    getHeziNotebookSession: () => mockGetHeziNotebookSession(),
  },
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_nav_notebooklm: 'NotebookLM',
      com_nav_open_sidebar: '打开侧边栏',
    })[key] ?? key,
}));

function renderPage() {
  return render(
    <RecoilRoot>
      <NotebookPage />
    </RecoilRoot>,
  );
}

describe('NotebookPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads NotebookLM through a HeZi session URL', async () => {
    mockGetHeziNotebookSession.mockResolvedValue({
      url: 'https://notebook.example.com/api/auth/hezi/start?token=abc',
      expiresAt: 1,
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTitle('NotebookLM')).toHaveAttribute(
        'src',
        'https://notebook.example.com/api/auth/hezi/start?token=abc',
      ),
    );
  });

  it('renders a mobile-safe sidebar opener', async () => {
    mockGetHeziNotebookSession.mockResolvedValue({
      url: 'https://notebook.example.com',
      expiresAt: 1,
    });

    renderPage();

    expect(screen.getByTestId('open-sidebar-button')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NotebookLM' })).toBeInTheDocument();
    await screen.findByTitle('NotebookLM');
  });

  it('shows a loading state until the iframe loads', () => {
    mockGetHeziNotebookSession.mockResolvedValue({
      url: 'https://notebook.example.com',
      expiresAt: 1,
    });

    renderPage();

    expect(screen.getByTestId('notebook-loading')).toBeInTheDocument();
    return waitFor(() => expect(screen.getByTitle('NotebookLM')).toBeInTheDocument()).then(() => {
      fireEvent.load(screen.getByTitle('NotebookLM'));
      expect(screen.queryByTestId('notebook-loading')).not.toBeInTheDocument();
    });
  });

  it('shows an error when the HeZi session cannot be created', async () => {
    mockGetHeziNotebookSession.mockRejectedValue(new Error('NotebookLM SSO is not configured'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('NotebookLM SSO is not configured');
    expect(screen.queryByTestId('notebook-loading')).not.toBeInTheDocument();
  });
});
