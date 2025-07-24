'use server';

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '../../lib/prisma';

/**
 * Returns classroom progress for a given subjectInstanceId (classroom).
 * Only the teacher who owns the subject instance can access this data.
 *
 * @param subjectInstanceId - The ID of the subject instance (classroom)
 * @returns { id, name, section, requirements, students, submissions }
 */
export async function getClassroomProgress(subjectInstanceId: string) {
  try {
    const user = await currentUser();
    if (!user || !user.id) {
      return { success: false, error: 'User not authenticated' };
    }

    // Fetch the subject instance and verify ownership
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: { id: subjectInstanceId, userId: user.id },
      include: {
        requirements: {
          select: { id: true, title: true },
          orderBy: { createdAt: 'asc' },
        },
        enrolments: true,
      },
    });
    if (!subjectInstance) {
      return { success: false, error: 'Classroom not found or access denied' };
    }

    // Get all students enrolled in this classroom
    const studentIds = subjectInstance.enrolments.map(e => e.studentId);
    const studentsFromDb = await prisma.student.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, name: true },
    });
    // Map studentId to name from DB
    const studentIdToName: Record<string, string> = {};
    studentsFromDb.forEach(s => { studentIdToName[s.id] = s.name; });
    // Build students array using enrolment.email if name is missing
    const students = subjectInstance.enrolments.map(e => ({
      id: e.studentId,
      name: studentIdToName[e.studentId] || e.email,
    }));

    // Get all submissions for requirements in this classroom
    const requirementIds = subjectInstance.requirements.map(r => r.id);
    const enrolmentIds = subjectInstance.enrolments.map(e => e.id);
    const submissions = await prisma.submission.findMany({
      where: {
        requirementId: { in: requirementIds },
        enrollmentId: { in: enrolmentIds },
      },
      select: {
        requirementId: true,
        enrollmentId: true,
      },
    });

    // Map enrolmentId to studentId
    const enrolmentIdToStudentId: Record<string, string> = {};
    subjectInstance.enrolments.forEach(e => {
      enrolmentIdToStudentId[e.id] = e.studentId;
    });

    // Transform submissions to { requirementId, studentId }
    const transformedSubmissions = submissions.map(s => ({
      requirementId: s.requirementId,
      studentId: enrolmentIdToStudentId[s.enrollmentId] || '',
    }));

    // Return data in the same structure as the mock
    return {
      success: true,
      data: {
        id: subjectInstance.id,
        name: subjectInstance.subjectId, // You may want to join subject for the name
        section: subjectInstance.section,
        requirements: subjectInstance.requirements,
        students,
        submissions: transformedSubmissions,
      },
    };
  } catch (error) {
    console.error('Error fetching classroom progress:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch classroom progress' };
  }
}
