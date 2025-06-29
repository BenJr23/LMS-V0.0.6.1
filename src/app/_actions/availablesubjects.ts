'use server';

import { getPrismaClient } from '@/lib/prisma';
import { createServerAction } from '@/lib/server-actions';

export async function getAvailableSubjects() {
  const prisma = getPrismaClient();
  
  try {
    const subjects = await prisma.subject.findMany({
      include: {
        instances: {
          where: {
            enrollment: 1, // 1 for active instances
          },
          include: {
            enrolments: {
              include: {
                submissions: true,
              },
            },
          },
        },
      },
      orderBy: {
        code: 'asc',
      },
    });

    return {
      success: true,
      data: subjects,
    };
  } catch (error) {
    console.error('Error fetching available subjects:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch available subjects',
    };
  } finally {
    await prisma.$disconnect();
  }
}

export const getAvailableSubjectsAction = createServerAction(getAvailableSubjects);
