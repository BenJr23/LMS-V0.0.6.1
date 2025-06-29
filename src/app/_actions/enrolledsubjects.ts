'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export const getEnrolledSubjects = async () => {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated.'
      };
    }

    const enrolledSubjects = await prisma.enrolment.findMany({
      where: {
        studentId: user.id,
      },
      include: {
        subjectInstance: {
          include: {
            subject: true,
            requirements: {
              orderBy: [
                { type: 'asc' },
                { requirementNumber: 'asc' }
              ]
            }
          },
        },
        submissions: {
          include: {
            requirement: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      data: enrolledSubjects
    };
  } catch (error) {
    console.error('Error fetching enrolled subjects:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch enrolled subjects'
    };
  } finally {
    await prisma.$disconnect();
  }
};

export async function updateEnrollmentStatus(enrollmentId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Update the enrollment status
    const updatedEnrollment = await prisma.enrolment.update({
      where: {
        id: enrollmentId,
        studentId: user.id
      },
      data: {
        hasNewContent: false
      }
    });

    return {
      success: true,
      data: updatedEnrollment
    };
  } catch (error) {
    console.error('Error updating enrollment status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update enrollment status'
    };
  } finally {
    await prisma.$disconnect();
  }
} 