import { NotebookTabs } from 'lucide-react';
import { SystemRoles } from 'librechat-data-provider';
import type { NavLink } from '~/common';

export function createHeziNotebookLink(
  role: string | null | undefined,
  navigate: (to: string) => void,
): NavLink | null {
  if (role !== SystemRoles.ADMIN) {
    return null;
  }

  return {
    title: 'com_nav_notebooklm',
    label: '',
    icon: NotebookTabs,
    id: 'notebook',
    onClick: () => navigate('/notebook'),
  };
}
