'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';

export async function createAnnouncement(data: {
  subjectInstanceId: string;
  title: string;
  content: string;
}) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.subjectInstanceId || !data.title || !data.content) {
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
      throw new Error('Subject instance not found or you do not have permission to add announcements.');
    }

    // Create the announcement and update enrollments in a transaction
    const announcement = await prisma.$transaction(async (tx) => {
      // Create the announcement
      const newAnnouncement = await tx.announcement.create({
        data: {
          subjectInstanceId: data.subjectInstanceId,
          userId: user.id,
          title: data.title,
          content: data.content
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

      return newAnnouncement;
    });

    return {
      success: true,
      data: announcement
    };
  } catch (error) {
    console.error('Error creating announcement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create announcement'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getAnnouncements(subjectInstanceId: string) {
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
      throw new Error('Subject instance not found or you do not have permission to view announcements.');
    }

    // Get all announcements for this subject instance
    const announcements = await prisma.announcement.findMany({
      where: {
        subjectInstanceId: subjectInstanceId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      data: announcements
    };
  } catch (error) {
    console.error('Error fetching announcements:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch announcements'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function getStudentAnnouncements(subjectInstanceId: string) {
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

    // Get all announcements for this subject instance
    const announcements = await prisma.announcement.findMany({
      where: {
        subjectInstanceId: subjectInstanceId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      success: true,
      data: announcements
    };
  } catch (error) {
    console.error('Error fetching student announcements:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch announcements'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function editAnnouncement(data: {
  announcementId: string;
  title: string;
  content: string;
}) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.announcementId || !data.title || !data.content) {
      throw new Error('All fields are required.');
    }

    // Check if announcement exists and belongs to the user
    const announcement = await prisma.announcement.findUnique({
      where: {
        id: data.announcementId,
        userId: user.id
      }
    });

    if (!announcement) {
      throw new Error('Announcement not found or you do not have permission to edit it.');
    }

    // Update the announcement
    const updatedAnnouncement = await prisma.announcement.update({
      where: {
        id: data.announcementId
      },
      data: {
        title: data.title,
        content: data.content
      }
    });

    return {
      success: true,
      data: updatedAnnouncement
    };
  } catch (error) {
    console.error('Error editing announcement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit announcement'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteAnnouncement(announcementId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Check if announcement exists and belongs to the user
    const announcement = await prisma.announcement.findUnique({
      where: {
        id: announcementId,
        userId: user.id
      }
    });

    if (!announcement) {
      throw new Error('Announcement not found or you do not have permission to delete it.');
    }

    // Delete the announcement
    await prisma.announcement.delete({
      where: {
        id: announcementId
      }
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting announcement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete announcement'
    };
  } finally {
    await prisma.$disconnect();
  }
}
