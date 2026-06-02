import { SystemRoles } from 'librechat-data-provider';
import { createHeziNotebookLink } from '../heziNotebookLink';

describe('createHeziNotebookLink', () => {
  it('returns a NotebookLM navigation link for signed-in users', () => {
    const navigate = jest.fn();
    const link = createHeziNotebookLink(SystemRoles.USER, navigate);

    expect(link).toMatchObject({
      id: 'notebook',
      title: 'com_nav_notebooklm',
      label: '',
    });

    link?.onClick?.();
    expect(navigate).toHaveBeenCalledWith('/notebook');
  });
});
