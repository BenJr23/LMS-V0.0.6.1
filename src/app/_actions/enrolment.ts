'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export async function enrollInSubject(subjectInstanceId: string, enrollmentCode: number) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Check if the subject instance exists and is active
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: subjectInstanceId,
        enrollment: 1 // Only active instances
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found or not available for enrollment.');
    }

    // Check if the enrollment code matches
    if (subjectInstance.enrolmentCode !== enrollmentCode) {
      throw new Error('Invalid enrollment code.');
    }

    // Check if user is already enrolled
    const existingEnrollment = await prisma.enrolment.findFirst({
      where: {
        subjectInstanceId: subjectInstanceId,
        studentId: user.id
      }
    });

    if (existingEnrollment) {
      throw new Error('You are already enrolled in this subject.');
    }

    // Create the enrollment
    const enrollment = await prisma.enrolment.create({
      data: {
        subjectInstanceId: subjectInstanceId,
        studentId: user.id,
        email: user.emailAddresses[0]?.emailAddress || '',
        code: enrollmentCode
      }
    });

    return {
      success: true,
      data: enrollment
    };
  } catch (error) {
    console.error('Error enrolling in subject:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to enroll in subject'
    };
  } finally {
    await prisma.$disconnect();
  }
}
