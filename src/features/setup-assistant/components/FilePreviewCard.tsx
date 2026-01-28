'use client';

// =====================================================
// TIS TIS PLATFORM - File Preview Card Component
// Cowork-inspired file attachment card for chat input
// Shows filename, type badge, and remove button
// =====================================================

import React, { memo, useMemo } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { cn } from '@/src/shared/utils';
import {
  X,
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  FileCode,
} from 'lucide-react';

// =====================================================
// TYPES
// =====================================================

export interface FilePreviewCardProps {
  /** Full URL of the uploaded file */
  url: string;
  /** Display filename */
  filename: string;
  /** MIME type of the file */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Type classification */
  type: 'image' | 'document';
  /** Called when remove button is clicked */
  onRemove: () => void;
  /** Optional className for container */
  className?: string;
}

// =====================================================
// CONSTANTS
// =====================================================

const appleEasing = [0.25, 0.1, 0.25, 1] as const;

// File type configurations
const FILE_TYPE_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  // Documents
  'application/pdf': {
    label: 'PDF',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    icon: FileText,
  },
  'application/msword': {
    label: 'DOC',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: FileText,
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    label: 'DOCX',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    icon: FileText,
  },
  'text/plain': {
    label: 'TXT',
    color: 'text-slate-600',
    bgColor: 'bg-slate-100',
    icon: FileText,
  },
  'text/markdown': {
    label: 'MD',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    icon: FileCode,
  },
  'text/csv': {
    label: 'CSV',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: FileSpreadsheet,
  },
  'application/vnd.ms-excel': {
    label: 'XLS',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: FileSpreadsheet,
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    label: 'XLSX',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    icon: FileSpreadsheet,
  },
  // Images (fallback, images use thumbnail)
  'image/png': {
    label: 'PNG',
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    icon: FileImage,
  },
  'image/jpeg': {
    label: 'JPG',
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    icon: FileImage,
  },
  'image/gif': {
    label: 'GIF',
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    icon: FileImage,
  },
  'image/webp': {
    label: 'WEBP',
    color: 'text-tis-coral',
    bgColor: 'bg-tis-coral/10',
    icon: FileImage,
  },
};

const DEFAULT_CONFIG = {
  label: 'FILE',
  color: 'text-slate-500',
  bgColor: 'bg-slate-100',
  icon: File,
};

// =====================================================
// HELPERS
// =====================================================

function getFileConfig(mimeType: string, filename: string) {
  // Check MIME type first
  if (FILE_TYPE_CONFIG[mimeType]) {
    return FILE_TYPE_CONFIG[mimeType];
  }

  // Fallback to extension
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'md') {
    return FILE_TYPE_CONFIG['text/markdown'];
  }
  if (ext === 'csv') {
    return FILE_TYPE_CONFIG['text/csv'];
  }
  if (ext === 'pdf') {
    return FILE_TYPE_CONFIG['application/pdf'];
  }
  if (ext === 'doc') {
    return FILE_TYPE_CONFIG['application/msword'];
  }
  if (ext === 'docx') {
    return FILE_TYPE_CONFIG['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  }
  if (ext === 'xls') {
    return FILE_TYPE_CONFIG['application/vnd.ms-excel'];
  }
  if (ext === 'xlsx') {
    return FILE_TYPE_CONFIG['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
  }
  if (ext === 'txt') {
    return FILE_TYPE_CONFIG['text/plain'];
  }

  return DEFAULT_CONFIG;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateFilename(filename: string, maxLength = 24): string {
  if (filename.length <= maxLength) return filename;

  // Check if file has an extension
  const lastDotIndex = filename.lastIndexOf('.');
  const hasExtension = lastDotIndex > 0 && lastDotIndex < filename.length - 1;

  if (!hasExtension) {
    // No extension: simple truncation
    return filename.slice(0, maxLength - 3) + '...';
  }

  const ext = filename.slice(lastDotIndex + 1);
  const nameWithoutExt = filename.slice(0, lastDotIndex);

  // Ensure we have enough room for the truncated name + ... + . + ext
  const availableLength = maxLength - ext.length - 4; // 3 for '...' + 1 for '.'
  if (availableLength <= 0) {
    // Extension is too long, just truncate the whole thing
    return filename.slice(0, maxLength - 3) + '...';
  }

  const truncatedName = nameWithoutExt.slice(0, availableLength) + '...';
  return `${truncatedName}.${ext}`;
}

// =====================================================
// COMPONENT
// =====================================================

export const FilePreviewCard = memo(function FilePreviewCard({
  url,
  filename,
  mimeType,
  size,
  type,
  onRemove,
  className,
}: FilePreviewCardProps) {
  const config = useMemo(() => getFileConfig(mimeType, filename), [mimeType, filename]);
  const displayName = useMemo(() => truncateFilename(filename), [filename]);
  const displaySize = useMemo(() => formatFileSize(size), [size]);
  const IconComponent = config.icon;

  // For images, show thumbnail preview
  if (type === 'image') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -5 }}
        transition={{ duration: 0.2, ease: appleEasing }}
        className={cn(
          'relative group inline-flex items-center gap-3 px-3 py-2.5',
          'bg-white rounded-xl border border-slate-200',
          'shadow-sm hover:shadow-md transition-shadow duration-200',
          className
        )}
      >
        {/* Image Thumbnail */}
        <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
          <Image
            src={url}
            alt={filename}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* File Info */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">
            {displayName}
          </span>
          <span className="text-xs text-slate-400">
            {displaySize}
          </span>
        </div>

        {/* Type Badge */}
        <span className={cn(
          'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
          config.bgColor,
          config.color
        )}>
          {config.label}
        </span>

        {/* Remove Button */}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Eliminar ${filename}`}
          className={cn(
            'ml-1 p-1 rounded-full',
            'text-slate-400 hover:text-red-500',
            'hover:bg-red-50 transition-colors duration-150'
          )}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    );
  }

  // For documents, show icon-based card
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -5 }}
      transition={{ duration: 0.2, ease: appleEasing }}
      className={cn(
        'relative group inline-flex items-center gap-3 px-3 py-2.5',
        'bg-white rounded-xl border border-slate-200',
        'shadow-sm hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {/* File Icon */}
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
        config.bgColor
      )}>
        <IconComponent className={cn('w-5 h-5', config.color)} />
      </div>

      {/* File Info */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-slate-700 truncate max-w-[140px]">
          {displayName}
        </span>
        <span className="text-xs text-slate-400">
          {displaySize}
        </span>
      </div>

      {/* Type Badge */}
      <span className={cn(
        'px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide',
        config.bgColor,
        config.color
      )}>
        {config.label}
      </span>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Eliminar ${filename}`}
        className={cn(
          'ml-1 p-1 rounded-full',
          'text-slate-400 hover:text-red-500',
          'hover:bg-red-50 transition-colors duration-150'
        )}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
});

// =====================================================
// EXPORTS
// =====================================================

export default FilePreviewCard;
