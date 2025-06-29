import { PrismaNextjsMonorepoWorkaroundPlugin } from '@prisma/nextjs-monorepo-workaround-plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      config.plugins = config.plugins || []
      config.plugins.push(new PrismaNextjsMonorepoWorkaroundPlugin())
    }
    return config
  },
  // Optimize for deployment
  compress: true,
  poweredByHeader: false,
  generateEtags: false,
  // Error handling
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stdmlwckqsvozjbivglp.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/lms/**',
      },
    ],
    domains: [],
    formats: ['image/webp', 'image/avif'],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
        ],
      },
    ]
  },
  // Redirects for better UX
  async redirects() {
    return [
      {
        source: '/',
        destination: '/faculty-login',
        permanent: false,
      },
    ]
  },
}

export default nextConfig 