import { NotebookTabs } from 'lucide-react';
import type { NavLink } from '~/common';

export function createHeziNotebookLink(
  _role: string | null | undefined,
  navigate: (to: string) => void,
): NavLink | null {
  return {
    title: 'com_nav_notebooklm',
    label: '',
    icon: NotebookTabs,
    id: 'notebook',
    onClick: () => navigate('/notebook'),
  };
}
