// =====================================================
// TIS TIS PLATFORM - File Upload Component
// =====================================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/shared/utils';
import { supabase, ESVA_TENANT_ID } from '@/shared/lib/supabase';

// ======================
// TYPES
// ======================
export type StorageBucket = 'patient-files' | 'quotes-pdf' | 'temp-uploads';

export type FileCategory =
  | 'x-ray'
  | 'photo'
  | 'document'
  | 'lab-result'
  | 'consent-form'
  | 'prescription'
  | 'quote-pdf'
  | 'other';

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  path: string;
  category?: FileCategory;
}

export interface FileUploadProps {
  bucket: StorageBucket;
  /**
   * Path within the bucket (e.g., "tenant-id/patient-id")
   */
  path?: string;
  /**
   * Allowed file types (MIME types or extensions)
   * @example ['image/*', 'application/pdf']
   */
  accept?: string[];
  /**
   * Maximum file size in bytes
   * @default 10MB (10485760)
   */
  maxSize?: number;
  /**
   * Allow multiple file uploads
   */
  multiple?: boolean;
  /**
   * File category for metadata
   */
  category?: FileCategory;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Callback when files are uploaded
   */
  onUpload?: (files: UploadedFile[]) => void;
  /**
   * Callback on upload error
   */
  onError?: (error: string) => void;
  /**
   * Callback for upload progress
   */
  onProgress?: (progress: number) => void;
  /**
   * Disable the upload
   */
  disabled?: boolean;
  /**
   * Show preview for images
   */
  showPreview?: boolean;
}

// ======================
// FILE TYPE HELPERS
// ======================
const FILE_TYPE_ICONS: Record<string, JSX.Element> = {
  'image': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  'application/pdf': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  'default': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
};

function getFileIcon(mimeType: string): JSX.Element {
  if (mimeType.startsWith('image/')) return FILE_TYPE_ICONS['image'];
  if (mimeType === 'application/pdf') return FILE_TYPE_ICONS['application/pdf'];
  return FILE_TYPE_ICONS['default'];
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ======================
// COMPONENT
// ======================
export function FileUpload({
  bucket,
  path = '',
  accept = ['image/*', 'application/pdf'],
  maxSize = 10 * 1024 * 1024, // 10MB
  multiple = false,
  category = 'other',
  className,
  onUpload,
  onError,
  onProgress,
  disabled = false,
  showPreview = true,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate unique file name
  const generateFileName = useCallback((file: File): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').substring(0, 50);
    return `${timestamp}_${randomStr}_${safeName}`;
  }, []);

  // Validate file
  const validateFile = useCallback((file: File): string | null => {
    // Check size
    if (file.size > maxSize) {
      return `El archivo "${file.name}" excede el tamaño máximo de ${formatFileSize(maxSize)}`;
    }

    // Check type
    if (accept.length > 0) {
      const isValidType = accept.some(acceptType => {
        if (acceptType.endsWith('/*')) {
          const baseType = acceptType.replace('/*', '');
          return file.type.startsWith(baseType);
        }
        if (acceptType.startsWith('.')) {
          return file.name.toLowerCase().endsWith(acceptType.toLowerCase());
        }
        return file.type === acceptType;
      });

      if (!isValidType) {
        return `El tipo de archivo "${file.type}" no está permitido`;
      }
    }

    return null;
  }, [accept, maxSize]);

  // Handle file selection
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    const filesToProcess = multiple ? fileArray : [fileArray[0]];

    // Validate all files
    for (const file of filesToProcess) {
      const error = validateFile(file);
      if (error) {
        onError?.(error);
        return;
      }
    }

    setSelectedFiles(filesToProcess);

    // Generate previews for images
    if (showPreview) {
      const newPreviews: string[] = [];
      filesToProcess.forEach(file => {
        if (file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            newPreviews.push(e.target?.result as string);
            setPreviews([...newPreviews]);
          };
          reader.readAsDataURL(file);
        }
      });
    }
  }, [multiple, validateFile, onError, showPreview]);

  // Upload files to Supabase
  const uploadFiles = useCallback(async () => {
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);

    const uploadedFiles: UploadedFile[] = [];
    const totalFiles = selectedFiles.length;

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileName = generateFileName(file);

        // Build full path: {tenant_id}/{optional_path}/{filename}
        const fullPath = path
          ? `${ESVA_TENANT_ID}/${path}/${fileName}`
          : `${ESVA_TENANT_ID}/${fileName}`;

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(fullPath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (error) {
          throw new Error(`Error subiendo ${file.name}: ${error.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(data.path);

        uploadedFiles.push({
          id: data.id || data.path,
          name: file.name,
          size: file.size,
          type: file.type,
          url: urlData.publicUrl,
          path: data.path,
          category,
        });

        // Update progress
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setUploadProgress(progress);
        onProgress?.(progress);
      }

      // Success - notify parent
      onUpload?.(uploadedFiles);

      // Reset state
      setSelectedFiles([]);
      setPreviews([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al subir archivos';
      onError?.(errorMessage);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [selectedFiles, bucket, path, category, generateFileName, onUpload, onError, onProgress]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragActive(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (!disabled) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  // Click to open file dialog
  const handleClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // Remove selected file
  const removeFile = useCallback((index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className={cn('w-full', className)}>
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
          'flex flex-col items-center justify-center min-h-[150px]',
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400',
          disabled && 'opacity-50 cursor-not-allowed',
          isUploading && 'pointer-events-none'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept.join(',')}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          disabled={disabled || isUploading}
        />

        {isUploading ? (
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3">
              <svg className="animate-spin w-full h-full text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <p className="text-sm text-gray-600">Subiendo... {uploadProgress}%</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm text-gray-600 text-center">
              <span className="font-medium text-blue-600">Click para subir</span>
              {' '}o arrastra archivos aquí
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {accept.join(', ')} (máx. {formatFileSize(maxSize)})
            </p>
          </>
        )}
      </div>

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="mt-4 space-y-2">
          {selectedFiles.map((file, index) => (
            <div
              key={`${file.name}-${index}`}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              {/* Preview or Icon */}
              {showPreview && previews[index] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previews[index]}
                  alt={file.name}
                  className="w-12 h-12 object-cover rounded"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center text-gray-400 bg-gray-100 rounded">
                  {getFileIcon(file.type)}
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {formatFileSize(file.size)}
                </p>
              </div>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Upload Button */}
          <button
            type="button"
            onClick={uploadFiles}
            disabled={disabled || isUploading}
            className={cn(
              'w-full py-2.5 px-4 rounded-lg font-medium text-white transition-colors',
              'bg-blue-600 hover:bg-blue-700',
              (disabled || isUploading) && 'opacity-50 cursor-not-allowed'
            )}
          >
            Subir {selectedFiles.length > 1 ? `${selectedFiles.length} archivos` : 'archivo'}
          </button>
        </div>
      )}
    </div>
  );
}

// ======================
// EXPORT DEFAULT
// ======================
export default FileUpload;
