'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export async function getTeacherRequirementDetail(requirementId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Get the requirement with all submissions
    const requirement = await prisma.requirement.findUnique({
      where: {
        id: requirementId,
        subjectInstance: {
          userId: user.id // Ensure the teacher owns this subject instance
        }
      },
      include: {
        subjectInstance: {
          include: {
            subject: true
          }
        },
        submissions: {
          include: {
            enrollment: {
              select: {
                studentId: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!requirement) {
      throw new Error('Requirement not found or you do not have permission to view it.');
    }

    return {
      success: true,
      data: requirement
    };
  } catch (error) {
    console.error('Error fetching teacher requirement detail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch requirement detail'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function submitGrade(submissionId: string, score: number, feedback: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Get the submission with its requirement and subject instance
    const submission = await prisma.submission.findUnique({
      where: {
        id: submissionId
      },
      include: {
        requirement: {
          include: {
            subjectInstance: true
          }
        }
      }
    });

    if (!submission) {
      throw new Error('Submission not found.');
    }

    // Verify that the user is the teacher of this subject instance
    if (submission.requirement.subjectInstance.userId !== user.id) {
      throw new Error('You do not have permission to grade this submission.');
    }

    // Update the submission with grade and feedback
    const updatedSubmission = await prisma.submission.update({
      where: {
        id: submissionId
      },
      data: {
        score: score,
        feedback: feedback,
        graded: true
      }
    });

    return {
      success: true,
      data: updatedSubmission
    };
  } catch (error) {
    console.error('Error submitting grade:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit grade'
    };
  } finally {
    await prisma.$disconnect();
  }
}
