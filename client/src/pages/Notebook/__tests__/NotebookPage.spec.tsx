import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import NotebookPage from '../NotebookPage';

const mockUseGetStartupConfig = jest.fn();

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => mockUseGetStartupConfig(),
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

  it('embeds the configured NotebookLM URL', () => {
    mockUseGetStartupConfig.mockReturnValue({
      data: { notebookLmUrl: 'https://notebook.example.com' },
    });

    renderPage();

    expect(screen.getByTitle('NotebookLM')).toHaveAttribute('src', 'https://notebook.example.com');
  });

  it('falls back to the production NotebookLM URL', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: {} });

    renderPage();

    expect(screen.getByTitle('NotebookLM')).toHaveAttribute('src', 'https://notebook.flyli.cn');
  });

  it('renders a mobile-safe sidebar opener', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: {} });

    renderPage();

    expect(screen.getByTestId('open-sidebar-button')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'NotebookLM' })).toBeInTheDocument();
  });

  it('shows a loading state until the iframe loads', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: {} });

    renderPage();

    expect(screen.getByTestId('notebook-loading')).toBeInTheDocument();
    fireEvent.load(screen.getByTitle('NotebookLM'));
    expect(screen.queryByTestId('notebook-loading')).not.toBeInTheDocument();
  });
});
