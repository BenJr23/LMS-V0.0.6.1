'use server';

import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '../../lib/prisma';

export interface CalendarEvent {
  id: string;
  title: string;
  course: string;
  courseCode: string;
  date: string;
  type: string;
  deadline: Date;
  color: string;
  requirementId: string;
  subjectInstanceId: string;
}

export const getCalendarEvents = async (startDate?: Date, endDate?: Date) => {
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      return {
        success: false,
        error: 'User not authenticated.'
      };
    }

    // If no date range provided, get current week
    if (!startDate || !endDate) {
      const today = new Date();
      const dayOfWeek = today.getDay();
      startDate = new Date(today);
      startDate.setDate(today.getDate() - dayOfWeek);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
    }

    // Get all enrolled subjects with requirements
    const enrolledSubjects = await prisma.enrolment.findMany({
      where: {
        studentId: user.id,
      },
      include: {
        subjectInstance: {
          include: {
            subject: true,
            requirements: {
              where: {
                deadline: {
                  gte: startDate,
                  lte: endDate
                },
                // Exclude requirements that already have submissions
                submissions: {
                  none: {
                    enrollment: {
                      studentId: user.id
                    }
                  }
                }
              },
              orderBy: {
                deadline: 'asc'
              }
            }
          },
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform requirements into calendar events
    const events: CalendarEvent[] = [];
    
    enrolledSubjects.forEach(enrollment => {
      enrollment.subjectInstance.requirements.forEach(requirement => {
        const eventDate = new Date(requirement.deadline);
        const dateStr = `${eventDate.toLocaleString('en-US', { month: 'short' })} ${eventDate.getDate()}`;
        
        // Determine color based on requirement type
        let color = 'bg-blue-100 text-blue-800';
        switch (requirement.type) {
          case 'ASSIGNMENT':
            color = 'bg-red-100 text-red-800';
            break;
          case 'QUIZ':
            color = 'bg-yellow-100 text-yellow-800';
            break;
          case 'FORUM':
            color = 'bg-green-100 text-green-800';
            break;
          case 'ACTIVITY':
            color = 'bg-purple-100 text-purple-800';
            break;
          default:
            color = 'bg-blue-100 text-blue-800';
        }

        events.push({
          id: requirement.id,
          title: requirement.title,
          course: enrollment.subjectInstance.subject.name,
          courseCode: enrollment.subjectInstance.subject.code,
          date: dateStr,
          type: requirement.type,
          deadline: requirement.deadline,
          color: color,
          requirementId: requirement.id,
          subjectInstanceId: enrollment.subjectInstance.id
        });
      });
    });

    return {
      success: true,
      data: events
    };
  } catch (error) {
    console.error("[GET_CALENDAR_EVENTS]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch calendar events'
    };
  }
};

export const getCalendarEventsForWeek = async (weekStart: Date) => {
  try {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    return await getCalendarEvents(weekStart, weekEnd);
  } catch (error) {
    console.error("[GET_CALENDAR_EVENTS_FOR_WEEK]", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch calendar events for week'
    };
  }
}; 