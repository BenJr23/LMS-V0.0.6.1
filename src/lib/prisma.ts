import { PrismaClient } from '../generated/prisma'

// Connection pool for serverless environments
let prisma: PrismaClient

declare global {
  var __db: PrismaClient | undefined
}

// This is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient({
    log: ['error'],
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })
} else {
  if (!global.__db) {
    global.__db = new PrismaClient({
      log: ['query', 'error', 'warn'],
    })
  }
  prisma = global.__db
}

export { prisma }

// Graceful shutdown
if (process.env.NODE_ENV === 'production') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect()
    })
}