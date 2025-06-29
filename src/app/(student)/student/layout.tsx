import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import StudentLayoutClient from './StudentLayoutClient';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/student-login');
  }

  return (
    <ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <Suspense fallback={<LoadingSpinner />}>
        <StudentLayoutClient>
          {children}
        </StudentLayoutClient>
      </Suspense>
    </ErrorBoundary>
  );
}