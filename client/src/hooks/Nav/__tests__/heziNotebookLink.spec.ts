import { SystemRoles } from 'librechat-data-provider';
import { createHeziNotebookLink } from '../heziNotebookLink';

describe('createHeziNotebookLink', () => {
  it('returns no link for normal users', () => {
    expect(createHeziNotebookLink(SystemRoles.USER, jest.fn())).toBeNull();
  });

  it('returns a NotebookLM navigation link for admins', () => {
    const navigate = jest.fn();
    const link = createHeziNotebookLink(SystemRoles.ADMIN, navigate);

    expect(link).toMatchObject({
      id: 'notebook',
      title: 'com_nav_notebooklm',
      label: '',
    });

    link?.onClick?.();
    expect(navigate).toHaveBeenCalledWith('/notebook');
  });
});
