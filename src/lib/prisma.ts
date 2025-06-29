import { PrismaClient } from '../generated/prisma'

// In production, create a new client for EVERY request
// This is the most aggressive approach to prevent prepared statement conflicts
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    // Add connection string with pooling parameters for production
    ...(process.env.NODE_ENV === 'production' && {
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    }),
  })
}

// For development, use a singleton pattern
// For production, create a new client every time
let globalPrisma: PrismaClient | undefined

if (process.env.NODE_ENV === 'production') {
  // In production, always create a new client
  globalPrisma = undefined
} else {
  // In development, reuse the same client
  if (!globalPrisma) {
    globalPrisma = createPrismaClient()
  }
}

// Export a function that always returns a fresh client in production
export const getPrismaClient = () => {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient()
  }
  return globalPrisma!
}

// For backward compatibility, also export a default instance
// but this will create a new client each time in production
export const prisma = process.env.NODE_ENV === 'production' 
  ? createPrismaClient() 
  : globalPrisma!

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}