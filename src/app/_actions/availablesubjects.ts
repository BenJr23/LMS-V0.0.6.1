'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export const getActiveSubjectInstances = async () => {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      throw new Error('User not authenticated');
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

    return subjectInstances;
  } catch (error) {
    console.error('Error fetching active subject instances:', error);
    throw new Error('Failed to fetch active subject instances');
  } finally {
    await prisma.$disconnect();
  }
};
