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
  // Use webpack only when not using Turbopack
  ...(process.env.TURBOPACK ? {} : {
    webpack: (config, { isServer }) => {
      if (isServer) {
        config.plugins = [...config.plugins, new PrismaPlugin()]
      }
      return config
    },
  }),
  // Updated property name for server external packages
  serverExternalPackages: ['@prisma/client']
}

export default nextConfig 