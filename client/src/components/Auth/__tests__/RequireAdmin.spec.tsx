import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen } from '@testing-library/react';
import { SystemRoles } from 'librechat-data-provider';
import RequireAdmin from '../RequireAdmin';

const mockUseAuthContext = jest.fn();

jest.mock('~/hooks', () => ({
  useAuthContext: () => mockUseAuthContext(),
}));

jest.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => (
    <div data-testid="redirect" data-replace={String(replace)} data-to={to} />
  ),
}));

describe('RequireAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children for admin users', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: SystemRoles.ADMIN } });

    render(
      <RequireAdmin>
        <div data-testid="admin-content" />
      </RequireAdmin>,
    );

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
  });

  it('redirects non-admin users to a new chat', () => {
    mockUseAuthContext.mockReturnValue({ user: { role: SystemRoles.USER } });

    render(
      <RequireAdmin>
        <div data-testid="admin-content" />
      </RequireAdmin>,
    );

    expect(screen.getByTestId('redirect')).toHaveAttribute('data-to', '/c/new');
    expect(screen.getByTestId('redirect')).toHaveAttribute('data-replace', 'true');
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });
});
