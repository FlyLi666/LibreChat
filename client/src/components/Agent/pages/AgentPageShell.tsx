import type { ReactNode } from 'react';

type AgentPageShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
  testId: string;
};

export default function AgentPageShell({
  eyebrow,
  title,
  description,
  children,
  actions,
  testId,
}: AgentPageShellProps) {
  return (
    <div
      data-testid={testId}
      className="flex h-full min-h-0 flex-col overflow-y-auto bg-surface-primary text-text-primary"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 border-b border-border-light pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-text-tertiary">
              {eyebrow}
            </div>
            <h1 className="text-2xl font-semibold tracking-normal text-text-primary sm:text-3xl">
              {title}
            </h1>
            <p className="text-sm leading-6 text-text-secondary">{description}</p>
          </div>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
