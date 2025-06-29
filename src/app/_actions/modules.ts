'use server';

import { currentUser } from '@clerk/nextjs/server';
import { getPrismaClient } from '../../lib/prisma';
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client with service role key to bypass RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function createModuleFolder(data: { subjectInstanceId: string; folderName: string }) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Validate required fields
    if (!data.subjectInstanceId || !data.folderName) {
      throw new Error('Subject instance ID and folder name are required.');
    }

    // Check if subject instance exists and belongs to the user
    const subjectInstance = await prisma.subjectInstance.findUnique({
      where: {
        id: data.subjectInstanceId,
        userId: user.id
      }
    });

    if (!subjectInstance) {
      throw new Error('Subject instance not found or you do not have permission to add modules.');
    }

    // Create the module folder
    const moduleFolder = await prisma.moduleFolder.create({
      data: {
        subjectInstanceId: data.subjectInstanceId,
        userId: user.id,
        folderName: data.folderName
      }
    });

    return {
      success: true,
      data: moduleFolder
    };
  } catch (error) {
    console.error('Error creating module folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create module folder'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function uploadModuleFile(file: File, moduleFolderId: string, fileName?: string) {
  try {
    const user = await currentUser();

    if (!user || !user.id) {
      throw new Error('User not authenticated.');
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get file extension
    const fileExtension = file.name.split('.').pop() || '';
    
    // Create a unique filename while preserving the original name
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const originalName = fileName || file.name.replace(/\.[^/.]+$/, ''); // Use custom name or remove extension
    const finalFileName = `${originalName}_${timestamp}_${randomString}.${fileExtension}`;

    const filePath = `modules/${moduleFolderId}/${finalFileName}`;

    console.log('Attempting to upload module file:', {
      path: filePath,
      type: file.type,
      size: file.size,
      originalName: file.name,
      moduleFolderId
    });

    const { error } = await supabase.storage
      .from('lms')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (error) {
      console.error('Error uploading module file:', error);
      throw new Error('Failed to upload file');
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('lms')
      .getPublicUrl(filePath);

    console.log('Module file uploaded successfully:', {
      path: filePath,
      publicUrl
    });

    return {
      success: true,
      path: filePath,
      publicUrl
    };
  } catch (error) {
    console.error('Error in uploadModuleFile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload file'
    };
  }
}

export async function createUploadedContent(data: {
  fileName: string;
  filePath: string;
  subjectInstanceId: string;
  moduleFolderId: string;
}) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Create uploaded content and update enrolments in a transaction
    const uploadedContent = await prisma.$transaction(async (tx) => {
      const newContent = await tx.uploadedContent.create({
        data: {
          fileName: data.fileName,
          filePath: data.filePath,
          subjectInstanceId: data.subjectInstanceId,
          moduleFolderId: data.moduleFolderId
        }
      });
      // Update all enrolments for this subject instance
      await tx.enrolment.updateMany({
        where: { subjectInstanceId: data.subjectInstanceId },
        data: { hasNewContent: true }
      });
      return newContent;
    });

    return {
      success: true,
      data: uploadedContent
    };
  } catch (error) {
    console.error('Error creating uploaded content:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create uploaded content'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteModuleFile(fileId: string, filePath: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // First, delete the file from Supabase storage
    const { error: storageError } = await supabase.storage
      .from('lms')
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
      return {
        success: false,
        error: 'Failed to delete file from storage'
      };
    }

    // Then, delete the database record
    await prisma.uploadedContent.delete({
      where: {
        id: fileId
      }
    });

    console.log('Module file deleted successfully:', {
      fileId,
      filePath
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error in deleteModuleFile:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function editModuleFolder({
  folderId,
  folderName
}: { folderId: string; folderName: string }) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Validate input
    if (!folderId || !folderName.trim()) {
      return {
        success: false,
        error: 'All fields are required'
      };
    }

    // Find the folder and check ownership
    const folder = await prisma.moduleFolder.findUnique({
      where: { id: folderId }
    });
    if (!folder || folder.userId !== user.id) {
      return {
        success: false,
        error: 'Folder not found or you do not have permission to edit it.'
      };
    }

    // Prevent duplicate folder names for the same subjectInstanceId
    const existingFolder = await prisma.moduleFolder.findFirst({
      where: {
        subjectInstanceId: folder.subjectInstanceId,
        folderName: folderName.trim(),
        NOT: { id: folderId }
      }
    });
    if (existingFolder) {
      return {
        success: false,
        error: 'A folder with this name already exists.'
      };
    }

    // Update the folder name and update enrolments in a transaction
    const updatedFolder = await prisma.$transaction(async (tx) => {
      const updated = await tx.moduleFolder.update({
        where: { id: folderId },
        data: { folderName: folderName.trim() }
      });
      // Update all enrolments for this subject instance
      await tx.enrolment.updateMany({
        where: { subjectInstanceId: folder.subjectInstanceId },
        data: { hasNewContent: true }
      });
      return updated;
    });

    return {
      success: true,
      data: updatedFolder
    };
  } catch (error) {
    console.error('Error editing module folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to edit module folder'
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function deleteModuleFolder(folderId: string) {
  const prisma = getPrismaClient();
  
  try {
    const user = await currentUser();
    if (!user) {
      return {
        success: false,
        error: 'User not authenticated'
      };
    }

    // Find the folder and check ownership
    const folder = await prisma.moduleFolder.findUnique({
      where: { id: folderId },
      include: { uploadedContents: true }
    });
    if (!folder || folder.userId !== user.id) {
      return {
        success: false,
        error: 'Folder not found or you do not have permission to delete it.'
      };
    }

    // Delete all files from Supabase storage
    const filePaths = folder.uploadedContents.map((file: { filePath: string }) => file.filePath);
    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from('lms')
        .remove(filePaths);
      if (storageError) {
        console.error('Error deleting files from storage:', storageError);
        return {
          success: false,
          error: 'Failed to delete files from storage'
        };
      }
    }

    // Delete the folder and all its contents from the database
    await prisma.moduleFolder.delete({
      where: { id: folderId }
    });

    return {
      success: true
    };
  } catch (error) {
    console.error('Error deleting module folder:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete module folder'
    };
  } finally {
    await prisma.$disconnect();
  }
}
