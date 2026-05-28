import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { TConversation } from 'librechat-data-provider';
import ExportModal from './ExportModal';

const pngHint =
  "PNG generation is slow. Please wait patiently. If download hasn't started within 1 minute, retry once. Do not click repeatedly.";

jest.mock('~/hooks', () => ({
  useExportConversation: () => ({ exportConversation: jest.fn() }),
  useLocalize: () => (key: string) =>
    ({
      com_endpoint_export: 'Export',
      com_nav_export_all_message_branches: 'All branches',
      com_nav_export_conversation: 'Export conversation',
      com_nav_export_filename: 'Filename',
      com_nav_export_filename_placeholder: 'Filename',
      com_nav_export_include_endpoint_options: 'Include endpoint options',
      com_nav_export_recursive: 'Recursive',
      com_nav_export_recursive_or_sequential: 'Recursive or sequential',
      com_nav_export_type: 'Type',
      com_nav_not_supported: 'Not supported',
      com_ui_export_png_hint: pngHint,
    })[key] ?? `missing:${key}`,
}));

jest.mock('@librechat/client', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Checkbox: ({
    checked,
    disabled,
    id,
    onCheckedChange,
    ...props
  }: {
    checked: boolean | 'indeterminate';
    disabled?: boolean;
    id?: string;
    onCheckedChange?: (value: boolean) => void;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={checked === true}
      disabled={disabled}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
  Dropdown: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      aria-label="export type"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
  OGDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  OGDialogTemplate: ({
    title,
    main,
    buttons,
  }: {
    title: React.ReactNode;
    main: React.ReactNode;
    buttons: React.ReactNode;
  }) => (
    <section>
      <h1>{title}</h1>
      {main}
      {buttons}
    </section>
  ),
}));

describe('ExportModal', () => {
  const conversation = { title: 'Research Notes' } as TConversation;

  it('shows the PRD PNG delay hint only for PNG export', () => {
    render(<ExportModal open={true} onOpenChange={jest.fn()} conversation={conversation} />);

    expect(screen.getByTestId('export-png-hint')).toHaveTextContent(pngHint);

    fireEvent.change(screen.getByLabelText('export type'), { target: { value: 'markdown' } });

    expect(screen.queryByTestId('export-png-hint')).not.toBeInTheDocument();
  });
});
