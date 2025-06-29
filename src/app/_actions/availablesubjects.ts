'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export const getActiveSubjectInstances = async () => {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated.'
      };
    }

    const subjectInstances = await prisma.subjectInstance.findMany({
      where: {
        enrollment: 1, // Only active instances
      },
      include: {
        subject: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: subjectInstances
    };
  } catch (error) {
    console.error('Error fetching active subject instances:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch active subject instances'
    };
  } finally {
    await prisma.$disconnect();
  }
};
