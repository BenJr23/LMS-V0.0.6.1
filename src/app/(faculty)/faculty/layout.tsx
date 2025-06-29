import { Suspense } from 'react';
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import FacultyLayoutClient from './FacultyLayoutClient';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';

export default async function FacultyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect('/faculty-login');
  }

  return (
    <ErrorBoundary fallback={<div>Something went wrong. Please refresh the page.</div>}>
      <Suspense fallback={<LoadingSpinner />}>
        <FacultyLayoutClient>
          {children}
        </FacultyLayoutClient>
      </Suspense>
    </ErrorBoundary>
  );
}