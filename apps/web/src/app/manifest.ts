import type { MetadataRoute } from 'next';
import { site } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.nameFa} | ${site.nameEn}`,
    short_name: site.nameFa,
    description: site.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f1ea',
    theme_color: '#f5f1ea',
    lang: 'fa-IR',
    icons: [{ src: '/logo.jpg', sizes: '1254x1254', type: 'image/jpeg' }],
  };
}
