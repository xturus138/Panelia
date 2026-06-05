import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Panelia',
    short_name: 'Panelia',
    description: 'A Mihon-inspired PWA manga reader.',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icons/icon-192x192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512x512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
    ],
  }
}