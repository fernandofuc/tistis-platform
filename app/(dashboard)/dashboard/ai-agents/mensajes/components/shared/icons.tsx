// =====================================================
// TIS TIS PLATFORM - Shared Icons for Agent Messages Module
// Centralized icon definitions for all tabs
// Design: Premium TIS TIS (Apple/Google aesthetics)
// =====================================================

import React from 'react';

// ======================
// ICON TYPE
// ======================
export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizeClasses: Record<IconSize, string> = {
  xs: 'w-3 h-3',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
  xl: 'w-7 h-7',
};

// ======================
// ICON COMPONENT FACTORY
// ======================
interface IconProps {
  size?: IconSize;
  className?: string;
}

const createIcon = (
  path: React.ReactNode,
  defaultSize: IconSize = 'md',
  viewBox: string = '0 0 24 24',
  fill: string = 'none',
  displayName: string = 'Icon'
) => {
  const IconComponent = ({ size = defaultSize, className = '' }: IconProps) => (
    <svg
      className={`${sizeClasses[size]} ${className}`}
      fill={fill}
      stroke={fill === 'none' ? 'currentColor' : 'none'}
      viewBox={viewBox}
    >
      {path}
    </svg>
  );
  IconComponent.displayName = displayName;
  return IconComponent;
};

// ======================
// GENERAL ICONS
// ======================
export const SaveIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
  'sm', '0 0 24 24', 'none', 'SaveIcon'
);

export const CheckIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />,
  'sm', '0 0 24 24', 'none', 'CheckIcon'
);

export const CheckCircleIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />,
  'md', '0 0 24 24', 'none', 'CheckCircleIcon'
);

export const XIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />,
  'sm', '0 0 24 24', 'none', 'XIcon'
);

export const ChevronDownIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />,
  'md', '0 0 24 24', 'none', 'ChevronDownIcon'
);

export const InfoIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  'sm', '0 0 24 24', 'none', 'InfoIcon'
);

export const AlertIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />,
  'md', '0 0 24 24', 'none', 'AlertIcon'
);

export const RefreshIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />,
  'sm', '0 0 24 24', 'none', 'RefreshIcon'
);

export const EditIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />,
  'sm', '0 0 24 24', 'none', 'EditIcon'
);

// ======================
// FEATURE ICONS
// ======================
export const BrainIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />,
  'md', '0 0 24 24', 'none', 'BrainIcon'
);

export const SparklesIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />,
  'md', '0 0 24 24', 'none', 'SparklesIcon'
);

export const ClockIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
  'md', '0 0 24 24', 'none', 'ClockIcon'
);

export const CalendarIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  'md', '0 0 24 24', 'none', 'CalendarIcon'
);

export const LinkIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  'md', '0 0 24 24', 'none', 'LinkIcon'
);

export const SettingsIcon = createIcon(
  <>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </>,
  'xl', '0 0 24 24', 'none', 'SettingsIcon'
);

export const MoonIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />,
  'md', '0 0 24 24', 'none', 'MoonIcon'
);

export const TextIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />,
  'md', '0 0 24 24', 'none', 'TextIcon'
);

export const DocumentTextIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  'md', '0 0 24 24', 'none', 'DocumentTextIcon'
);

export const EyeIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />,
  'md', '0 0 24 24', 'none', 'EyeIcon'
);

export const ClipboardCopyIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />,
  'md', '0 0 24 24', 'none', 'ClipboardCopyIcon'
);

export const MessagesIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  'md', '0 0 24 24', 'none', 'MessagesIcon'
);

// ======================
// PROFILE ICONS
// ======================
export const UserIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  'xl', '0 0 24 24', 'none', 'UserIcon'
);

export const UserSmallIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
  'md', '0 0 24 24', 'none', 'UserSmallIcon'
);

export const BuildingIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
  'xl', '0 0 24 24', 'none', 'BuildingIcon'
);

export const RobotIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
  'md', '0 0 24 24', 'none', 'RobotIcon'
);

// ======================
// ASSISTANT TYPE ICONS
// ======================
export const StarIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
  'lg', '0 0 24 24', 'none', 'StarIcon'
);

export const ChatBubbleIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
  'lg', '0 0 24 24', 'none', 'ChatBubbleIcon'
);

export const RedirectIcon = createIcon(
  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
  'lg', '0 0 24 24', 'none', 'RedirectIcon'
);

// ======================
// SOCIAL CHANNEL ICONS (filled)
// ======================
export const WhatsAppIcon = createIcon(
  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />,
  'sm', '0 0 24 24', 'currentColor', 'WhatsAppIcon'
);

export const InstagramIcon = createIcon(
  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />,
  'sm', '0 0 24 24', 'currentColor', 'InstagramIcon'
);

export const MessengerIcon = createIcon(
  <path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259 6.559-6.963 3.13 3.259 5.889-3.259-6.559 6.963z" />,
  'sm', '0 0 24 24', 'currentColor', 'MessengerIcon'
);

// ======================
// LOADING SPINNER
// ======================
const SpinnerIconComponent = ({ size = 'sm', className = '' }: IconProps) => (
  <svg className={`${sizeClasses[size]} animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);
SpinnerIconComponent.displayName = 'SpinnerIcon';
export const SpinnerIcon = SpinnerIconComponent;

// ======================
// LEGACY ICON OBJECTS (for backward compatibility)
// ======================
export const icons = {
  save: <SaveIcon />,
  check: <CheckIcon />,
  checkCircle: <CheckCircleIcon />,
  x: <XIcon />,
  chevronDown: <ChevronDownIcon />,
  info: <InfoIcon />,
  alert: <AlertIcon />,
  refresh: <RefreshIcon />,
  edit: <EditIcon />,
  brain: <BrainIcon />,
  sparkles: <SparklesIcon />,
  clock: <ClockIcon />,
  calendar: <CalendarIcon />,
  link: <LinkIcon />,
  settings: <SettingsIcon />,
  moon: <MoonIcon />,
  text: <TextIcon />,
  messages: <MessagesIcon />,
  user: <UserIcon />,
  userSmall: <UserSmallIcon />,
  building: <BuildingIcon />,
  robot: <RobotIcon />,
  documentText: <DocumentTextIcon />,
  eye: <EyeIcon />,
  clipboardCopy: <ClipboardCopyIcon />,
  // Prompt config icons
  currency: <InfoIcon />,
  shield: <CheckCircleIcon />,
  trending: <SparklesIcon />,
  trash: <XIcon />,
  plus: <SparklesIcon />,
  // Assistant types
  assistantComplete: <StarIcon />,
  assistantBrand: <ChatBubbleIcon />,
  redirectOnly: <RedirectIcon />,
  // Social
  whatsapp: <WhatsAppIcon />,
  instagram: <InstagramIcon />,
  messenger: <MessengerIcon />,
  // Loading
  spinner: <SpinnerIcon />,
};

// ======================
// CHANNEL ICONS CONFIG
// ======================
export const channelIconsConfig: Record<string, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  name: string;
}> = {
  whatsapp: {
    icon: <WhatsAppIcon />,
    color: 'text-green-600',
    bg: 'bg-green-50',
    name: 'WhatsApp'
  },
  instagram: {
    icon: <InstagramIcon />,
    color: 'text-pink-600',
    bg: 'bg-pink-50',
    name: 'Instagram'
  },
  facebook: {
    icon: <MessengerIcon />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    name: 'Facebook'
  },
  messenger: {
    icon: <MessengerIcon />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    name: 'Messenger'
  },
  tiktok: {
    icon: <InstagramIcon />,
    color: 'text-gray-800',
    bg: 'bg-gray-100',
    name: 'TikTok'
  },
};

export default icons;
