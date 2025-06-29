import { revalidatePath } from 'next/cache';

export type ServerActionResult<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
};

export function createServerAction<T extends unknown[], R>(
  action: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<ServerActionResult<R>> => {
    try {
      const result = await action(...args);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Server action error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  };
}

export function createServerActionWithRevalidation<T extends unknown[], R>(
  action: (...args: T) => Promise<R>,
  pathsToRevalidate: string[]
) {
  return async (...args: T): Promise<ServerActionResult<R>> => {
    try {
      const result = await action(...args);
      
      // Revalidate paths
      pathsToRevalidate.forEach(path => {
        revalidatePath(path);
      });
      
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Server action error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      };
    }
  };
} 