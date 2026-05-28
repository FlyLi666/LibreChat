import { createHeziImageLink } from '../heziImageLink';

describe('createHeziImageLink', () => {
  it('returns a 生图 navigation link for all signed-in users', () => {
    const navigate = jest.fn();
    const link = createHeziImageLink(navigate);

    expect(link).toMatchObject({
      id: 'image',
      title: 'com_nav_image_gen',
      label: '',
    });

    link.onClick?.();
    expect(navigate).toHaveBeenCalledWith('/image');
  });
});
