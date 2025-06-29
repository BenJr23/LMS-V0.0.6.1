import { PrismaClient } from '../generated/prisma'

// Always create a new Prisma client instance
// This prevents connection pooling issues in serverless environments
const createPrismaClient = () => {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

// Export a function that creates a new client each time
export const getPrismaClient = () => {
  return createPrismaClient()
}

// For backward compatibility, also export a default instance
// but this will create a new client each time it's imported
export const prisma = createPrismaClient()

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}