import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'stdmlwckqsvozjbivglp.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/lms/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }
    return config
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  }
}

export default nextConfig 