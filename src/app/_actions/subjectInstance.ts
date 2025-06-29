'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

type EditSubjectInstanceInput = {
  id: string;
  teacherName: string;
  grade: string;
  section: string;
  enrollment: number;
};

export async function getSubjectInstances() {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    const subjectInstances = await prisma.subjectInstance.findMany({
      where: {
        userId: user.id
      },
      include: {
        subject: true,
        enrolments: {
          select: {
            id: true,
            studentId: true,
            email: true,
            createdAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      data: subjectInstances
    };
  } catch (error) {
    console.error('Error fetching subject instances:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch subject instances'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function createSubjectInstance(data: {
  subjectId: string;
  teacherName: string;
  grade: string;
  section: string;
  icon: string;
}) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.subjectId || !data.teacherName || !data.grade || !data.section || !data.icon) {
      throw new Error('All fields are required.');
    }

    // Generate a random enrollment code
    const enrollmentCode = Math.floor(100000 + Math.random() * 900000);

    // Create the subject instance
    const subjectInstance = await prisma.subjectInstance.create({
      data: {
        subjectId: data.subjectId,
        userId: user.id,
        teacherName: data.teacherName,
        grade: data.grade,
        section: data.section,
        icon: data.icon,
        enrollment: 1, // Active by default
        enrolmentCode: enrollmentCode
      },
      include: {
        subject: true
      }
    });

    return {
      success: true,
      data: subjectInstance
    };
  } catch (error) {
    console.error('Error creating subject instance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subject instance'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function editSubjectInstance(data: EditSubjectInstanceInput) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.id || !data.teacherName || !data.grade || !data.section) {
      throw new Error('All fields are required.');
    }

    // Check if subject instance exists and belongs to the user
    const existingInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: data.id,
        userId: user.id
      }
    });

    if (!existingInstance) {
      throw new Error('Subject instance not found or you do not have permission to edit it.');
    }

    // Update the subject instance
    const updatedInstance = await prisma.subjectInstance.update({
      where: {
        id: data.id,
        userId: user.id
      },
      data: {
        teacherName: data.teacherName,
        grade: data.grade,
        section: data.section,
        enrollment: data.enrollment,
      },
      include: {
        subject: true
      }
    });

    return { 
      success: true, 
      data: updatedInstance 
    };
  } catch (error) {
    console.error('Error updating subject instance:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update subject instance' 
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getSubjectInstance(id: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: id,
        userId: user.id
      },
      include: {
        subject: true,
        announcements: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        moduleFolders: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        uploadedContents: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found.');
    }

    return subjectInstance;
  } catch (error) {
    console.error('Error fetching subject instance:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteSubjectInstance(id: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // First check if the subject instance exists and belongs to the user
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: id,
        userId: user.id
      },
      include: {
        requirements: {
          include: {
            submissions: true
          }
        },
        announcements: true,
        moduleFolders: {
          include: {
            uploadedContents: true
          }
        },
        uploadedContents: true,
        enrolments: true
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found or you do not have permission to delete it.');
    }

    // Delete all related records in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete all submissions first (they depend on requirements and enrollments)
      for (const requirement of subjectInstance.requirements) {
        await tx.submission.deleteMany({
          where: {
            requirementId: requirement.id
          }
        });
      }

      // Delete all requirements
      await tx.requirement.deleteMany({
        where: {
          subjectInstanceId: id
        }
      });

      // Delete all uploaded contents
      await tx.uploadedContent.deleteMany({
        where: {
          subjectInstanceId: id
        }
      });

      // Delete all module folders (this will cascade delete their uploaded contents)
      await tx.moduleFolder.deleteMany({
        where: {
          subjectInstanceId: id
        }
      });

      // Delete all announcements
      await tx.announcement.deleteMany({
        where: {
          subjectInstanceId: id
        }
      });

      // Delete all enrollments
      await tx.enrolment.deleteMany({
        where: {
          subjectInstanceId: id
        }
      });

      // Finally delete the subject instance
      await tx.subjectInstance.delete({
        where: {
          id: id
        }
      });
    });

    return {
      success: true,
      message: 'Subject instance and all related data deleted successfully'
    };
  } catch (error) {
    console.error('Error deleting subject instance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete subject instance'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getStudentSubjectInstance(id: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // First get the student's enrolment for this subject instance
    const enrolment = await prisma.enrolment.findFirst({
      where: {
        subjectInstanceId: id,
        studentId: user.id
      }
    });

    if (!enrolment) {
      throw new Error('You are not enrolled in this subject.');
    }

    // Then fetch the subject instance with all related data
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: id
      },
      include: {
        subject: true,
        announcements: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        moduleFolders: {
          orderBy: {
            createdAt: 'desc'
          }
        },
        uploadedContents: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    return subjectInstance;
  } catch (error) {
    console.error('Error fetching student subject instance:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}
