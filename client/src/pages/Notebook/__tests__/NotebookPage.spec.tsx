import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import NotebookPage from '../NotebookPage';

const mockUseGetStartupConfig = jest.fn();

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => mockUseGetStartupConfig(),
}));

describe('NotebookPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('embeds the configured NotebookLM URL', () => {
    mockUseGetStartupConfig.mockReturnValue({
      data: { notebookLmUrl: 'https://notebook.example.com' },
    });

    render(<NotebookPage />);

    expect(screen.getByTitle('NotebookLM')).toHaveAttribute('src', 'https://notebook.example.com');
  });

  it('falls back to the production NotebookLM URL', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: {} });

    render(<NotebookPage />);

    expect(screen.getByTitle('NotebookLM')).toHaveAttribute('src', 'https://notebook.flyli.cn');
  });

  it('shows a loading state until the iframe loads', () => {
    mockUseGetStartupConfig.mockReturnValue({ data: {} });

    render(<NotebookPage />);

    expect(screen.getByTestId('notebook-loading')).toBeInTheDocument();
    fireEvent.load(screen.getByTitle('NotebookLM'));
    expect(screen.queryByTestId('notebook-loading')).not.toBeInTheDocument();
  });
});
