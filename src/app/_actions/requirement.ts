'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

type CreateRequirementInput = {
  subjectInstanceId: string;
  title: string;
  content: string;
  scoreBase: number;
  deadline: Date;
  type: 'FORUM' | 'QUIZ' | 'ASSIGNMENT' | 'ACTIVITY';
};

type EditRequirementInput = {
  requirementId: string;
  title: string;
  content: string;
  scoreBase: number;
  deadline: Date;
};

export async function createRequirement(data: CreateRequirementInput) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.subjectInstanceId || !data.title || !data.content || !data.scoreBase || !data.deadline || !data.type) {
      throw new Error('All fields are required.');
    }

    // Check if subject instance exists and belongs to the user
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: data.subjectInstanceId,
        userId: user.id
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found or you do not have permission to add requirements.');
    }

    // Get the latest requirement number for this subject instance
    const latestRequirement = await prisma.requirement.findFirst({
      where: {
        subjectInstanceId: data.subjectInstanceId,
        type: data.type
      },
      orderBy: {
        requirementNumber: 'desc'
      }
    });

    // Create the requirement and update enrollments in a transaction
    const requirement = await prisma.$transaction(async (tx) => {
      // Create the requirement
      const newRequirement = await tx.requirement.create({
        data: {
          subjectInstanceId: data.subjectInstanceId,
          title: data.title,
          content: data.content,
          scoreBase: data.scoreBase,
          deadline: data.deadline,
          type: data.type,
          requirementNumber: (latestRequirement?.requirementNumber || 0) + 1
        }
      });

      // Update all enrollments for this subject instance
      await tx.enrolment.updateMany({
        where: {
          subjectInstanceId: data.subjectInstanceId
        },
        data: {
          hasNewContent: true
        }
      });

      return newRequirement;
    });

    return {
      success: true,
      data: requirement
    };
  } catch (error) {
    console.error('Error creating requirement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create requirement'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getRequirements(subjectInstanceId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Check if subject instance exists and belongs to the user
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: subjectInstanceId,
        userId: user.id
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found or you do not have permission to view requirements.');
    }

    // Get all requirements for this subject instance
    const requirements = await prisma.requirement.findMany({
      where: {
        subjectInstanceId: subjectInstanceId
      },
      orderBy: [
        { type: 'asc' },
        { requirementNumber: 'asc' }
      ]
    });

    return {
      success: true,
      data: requirements
    };
  } catch (error) {
    console.error('Error fetching requirements:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch requirements'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getStudentRequirements(subjectInstanceId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Get the student's enrollment for this subject instance
    const enrollment = await prisma.enrolment.findFirst({
      where: {
        subjectInstanceId: subjectInstanceId,
        studentId: user.id
      }
    });

    if (!enrollment) {
      throw new Error('You are not enrolled in this subject.');
    }

    // Get all requirements with submissions for this subject instance
    const requirements = await prisma.requirement.findMany({
      where: {
        subjectInstanceId: subjectInstanceId
      },
      include: {
        submissions: {
          where: {
            enrollmentId: enrollment.id
          },
          select: {
            id: true,
            title: true,
            content: true,
            filePath: true,
            graded: true,
            score: true,
            feedback: true,
            status: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: [
        { type: 'asc' },
        { requirementNumber: 'asc' }
      ]
    });

    // Transform the data to include submission status
    const requirementsWithStatus = requirements.map(req => {
      const submission = req.submissions[0]; // Get the first submission if exists
      let submissionStatus: 'GRADED' | 'SUBMITTED' | 'NOT_SUBMITTED' = 'NOT_SUBMITTED';
      
      if (submission) {
        submissionStatus = submission.graded ? 'GRADED' : 'SUBMITTED';
      }

      return {
        ...req,
        submissionStatus,
        submission: submission || null
      };
    });

    return {
      success: true,
      data: requirementsWithStatus
    };
  } catch (error) {
    console.error('Error fetching student requirements:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch requirements'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getStudentRequirementDetail(requirementId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Get the requirement with its subject instance
    const requirement = await prisma.requirement.findUnique({
      where: {
        id: requirementId
      },
      include: {
        subjectInstance: {
          include: {
            subject: true
          }
        }
      }
    });

    if (!requirement) {
      throw new Error('Requirement not found.');
    }

    // Get the student's enrollment for this subject instance
    const enrollment = await prisma.enrolment.findFirst({
      where: {
        subjectInstanceId: requirement.subjectInstanceId,
        studentId: user.id
      }
    });

    if (!enrollment) {
      throw new Error('You are not enrolled in this subject.');
    }

    // Get the submission for this requirement
    const submission = await prisma.submission.findFirst({
      where: {
        requirementId: requirementId,
        enrollmentId: enrollment.id
      }
    });

    return {
      success: true,
      data: {
        ...requirement,
        submission: submission || null,
        submissionStatus: submission 
          ? (submission.graded ? 'GRADED' : 'SUBMITTED')
          : 'NOT_SUBMITTED'
      }
    };
  } catch (error) {
    console.error('Error fetching requirement detail:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch requirement detail'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function editRequirement(data: EditRequirementInput) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.requirementId || !data.title || !data.content || !data.scoreBase || !data.deadline) {
      throw new Error('All fields are required.');
    }

    // Check if requirement exists and belongs to the user's subject instance
    const requirement = await prisma.requirement.findFirst({
      where: {
        id: data.requirementId,
        subjectInstance: {
          userId: user.id
        }
      }
    });

    if (!requirement) {
      throw new Error('Requirement not found or you do not have permission to edit it.');
    }

    // Update the requirement and enrollments in a transaction
    const updatedRequirement = await prisma.$transaction(async (tx) => {
      // Update the requirement
      const updated = await tx.requirement.update({
        where: {
          id: data.requirementId
        },
        data: {
          title: data.title,
          content: data.content,
          scoreBase: data.scoreBase,
          deadline: data.deadline
        }
      });

      // Update all enrollments for this subject instance
      await tx.enrolment.updateMany({
        where: {
          subjectInstanceId: requirement.subjectInstanceId
        },
        data: {
          hasNewContent: true
        }
      });

      return updated;
    });

    return {
      success: true,
      data: updatedRequirement
    };
  } catch (error) {
    console.error('Error updating requirement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update requirement'
    };
  }
}

export async function deleteRequirement(requirementId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Check if requirement exists and belongs to the user's subject instance
    const requirement = await prisma.requirement.findFirst({
      where: {
        id: requirementId,
        subjectInstance: {
          userId: user.id
        }
      }
    });

    if (!requirement) {
      throw new Error('Requirement not found or you do not have permission to delete it.');
    }

    // Delete the requirement and update enrollments in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all submissions first
      await tx.submission.deleteMany({
        where: { requirementId }
      });

      // Delete the requirement itself
      await tx.requirement.delete({
        where: { id: requirementId }
      });

      // Update all enrollments for this subject instance
      await tx.enrolment.updateMany({
        where: {
          subjectInstanceId: requirement.subjectInstanceId
        },
        data: {
          hasNewContent: true
        }
      });
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting requirement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete requirement'
    };
  }
}

export async function getRequirementsBySubjectInstance(subjectInstanceId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const requirements = await prisma.requirement.findMany({
      where: {
        subjectInstanceId: subjectInstanceId,
      },
      orderBy: [
        { type: 'asc' },
        { requirementNumber: 'asc' }
      ],
    });

    return requirements;
  } catch (error) {
    console.error('Error fetching requirements:', error);
    throw new Error('Failed to fetch requirements');
  } finally {
    await prisma.$disconnect();
  }
}
