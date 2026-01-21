'use client';

// =====================================================
// TIS TIS PLATFORM - Microphone Permission Hook
// Hook para verificar y solicitar permisos de micrófono
// FASE 4: UI Improvements
// =====================================================

import { useState, useEffect, useCallback, useRef } from 'react';

// ======================
// TYPES
// ======================

export type MicrophonePermissionState = 'granted' | 'denied' | 'prompt' | 'checking';

export interface UseMicrophonePermissionReturn {
  /** Estado actual del permiso */
  permissionState: MicrophonePermissionState;
  /** Si se está verificando el permiso */
  isChecking: boolean;
  /** Si el permiso fue concedido */
  isGranted: boolean;
  /** Si el permiso fue denegado */
  isDenied: boolean;
  /** Función para solicitar permiso */
  requestPermission: () => Promise<boolean>;
  /** Función para re-verificar el estado */
  checkPermission: () => Promise<void>;
}

// ======================
// HELPERS
// ======================

/**
 * Verifica si la Permissions API está disponible
 */
function hasPermissionsAPI(): boolean {
  return typeof navigator !== 'undefined' && 'permissions' in navigator;
}

/**
 * Verifica si la MediaDevices API está disponible
 */
function hasMediaDevicesAPI(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * Obtiene el stream de audio del micrófono
 */
async function getMicrophoneStream(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/**
 * Detiene todos los tracks de un stream
 */
function stopStreamTracks(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

// ======================
// HOOK
// ======================

export function useMicrophonePermission(): UseMicrophonePermissionReturn {
  const [permissionState, setPermissionState] = useState<MicrophonePermissionState>('checking');
  const [isChecking, setIsChecking] = useState(true);

  // Ref para almacenar el PermissionStatus y poder limpiar el listener
  const permissionStatusRef = useRef<PermissionStatus | null>(null);

  // Verificar estado del permiso
  const checkPermission = useCallback(async () => {
    // Guard: verificar que estamos en el browser
    if (typeof window === 'undefined') {
      setPermissionState('prompt');
      setIsChecking(false);
      return;
    }

    setIsChecking(true);

    try {
      // Usar Permissions API si está disponible
      if (hasPermissionsAPI()) {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        setPermissionState(result.state as MicrophonePermissionState);

        // Guardar referencia para cleanup
        permissionStatusRef.current = result;

        // Escuchar cambios en el permiso
        result.onchange = () => {
          setPermissionState(result.state as MicrophonePermissionState);
        };
      } else if (hasMediaDevicesAPI()) {
        // Fallback: intentar obtener un stream para verificar
        try {
          const stream = await getMicrophoneStream();
          stopStreamTracks(stream);
          setPermissionState('granted');
        } catch {
          // Si falla, asumimos que está en 'prompt' o 'denied'
          setPermissionState('prompt');
        }
      } else {
        // No hay API disponible
        setPermissionState('prompt');
      }
    } catch (error) {
      console.error('[useMicrophonePermission] Error checking permission:', error);
      setPermissionState('prompt');
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Solicitar permiso de micrófono
  const requestPermission = useCallback(async (): Promise<boolean> => {
    // Guard: verificar que estamos en el browser
    if (typeof window === 'undefined') {
      setPermissionState('denied');
      return false;
    }

    // Verificar que mediaDevices está disponible
    if (!hasMediaDevicesAPI()) {
      setPermissionState('denied');
      return false;
    }

    setIsChecking(true);

    try {
      const stream = await getMicrophoneStream();
      // Detener los tracks inmediatamente
      stopStreamTracks(stream);
      setPermissionState('granted');
      return true;
    } catch (error) {
      console.error('[useMicrophonePermission] Permission denied:', error);
      // Verificar si fue un error de permiso o de dispositivo
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          setPermissionState('denied');
        } else if (error.name === 'NotFoundError') {
          // No hay micrófono disponible
          setPermissionState('denied');
        }
      } else {
        setPermissionState('denied');
      }
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Verificar permiso al montar y cleanup al desmontar
  useEffect(() => {
    checkPermission();

    // Cleanup: remover listener cuando el componente se desmonta
    return () => {
      if (permissionStatusRef.current) {
        permissionStatusRef.current.onchange = null;
        permissionStatusRef.current = null;
      }
    };
  }, [checkPermission]);

  return {
    permissionState,
    isChecking,
    isGranted: permissionState === 'granted',
    isDenied: permissionState === 'denied',
    requestPermission,
    checkPermission,
  };
}

export default useMicrophonePermission;
