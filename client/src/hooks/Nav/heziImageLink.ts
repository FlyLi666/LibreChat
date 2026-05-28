import { Image } from 'lucide-react';
import type { NavLink } from '~/common';

export function createHeziImageLink(navigate: (to: string) => void): NavLink {
  return {
    title: 'com_nav_image_gen',
    label: '',
    icon: Image,
    id: 'image',
    onClick: () => navigate('/image'),
  };
}
