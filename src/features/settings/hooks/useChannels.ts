// =====================================================
// TIS TIS PLATFORM - Channels Hook
// React hook for channel connections state management
// =====================================================

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import * as channelsService from '../services/channels.service';
import {
  CHANNEL_METADATA,
  type ChannelConnection,
  type ChannelType,
  type ChannelGroup,
  type CreateChannelRequest,
  type UpdateChannelRequest,
  type EffectiveChannelAIConfig,
} from '../types/channels.types';

// ======================
// MAIN CHANNELS HOOK
// ======================

export function useChannels() {
  const [channels, setChannels] = useState<ChannelConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await channelsService.getChannels();
      setChannels(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar canales');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Group channels by type for UI display
  const channelGroups = useMemo<ChannelGroup[]>(() => {
    return channelsService.groupChannelsByType(channels, CHANNEL_METADATA);
  }, [channels]);

  // Create new channel
  const createChannel = useCallback(async (data: CreateChannelRequest): Promise<ChannelConnection> => {
    const newChannel = await channelsService.createChannel(data);
    setChannels(prev => [...prev, newChannel]);
    return newChannel;
  }, []);

  // Update channel
  const updateChannel = useCallback(async (id: string, updates: Partial<UpdateChannelRequest>): Promise<ChannelConnection> => {
    const updated = await channelsService.updateChannel(id, updates);
    setChannels(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
    return updated;
  }, []);

  // Delete channel
  const deleteChannel = useCallback(async (id: string): Promise<void> => {
    await channelsService.deleteChannel(id);
    setChannels(prev => prev.filter(c => c.id !== id));
  }, []);

  // Toggle AI for a channel
  const toggleAI = useCallback(async (channelId: string, enabled: boolean): Promise<void> => {
    await channelsService.toggleChannelAI(channelId, enabled);
    setChannels(prev => prev.map(c =>
      c.id === channelId ? { ...c, ai_enabled: enabled } : c
    ));
  }, []);

  // Get channel by ID
  const getChannelById = useCallback((id: string): ChannelConnection | undefined => {
    return channels.find(c => c.id === id);
  }, [channels]);

  // Get channels by type
  const getChannelsByType = useCallback((type: ChannelType): ChannelConnection[] => {
    return channels.filter(c => c.channel === type);
  }, [channels]);

  // Check if can add more accounts for a channel type
  const canAddAccount = useCallback((type: ChannelType): boolean => {
    const existing = channels.filter(c => c.channel === type);
    return existing.length < 2;
  }, [channels]);

  // Get next available account number
  const getNextAccountNumber = useCallback((type: ChannelType) => {
    return channelsService.getNextAccountNumber(channels, type);
  }, [channels]);

  // Get connected channels count
  const connectedCount = useMemo(() => {
    return channels.filter(c => c.status === 'connected').length;
  }, [channels]);

  // Get total accounts count
  const totalAccounts = useMemo(() => {
    return channels.length;
  }, [channels]);

  return {
    channels,
    channelGroups,
    loading,
    error,
    refresh: fetchChannels,
    createChannel,
    updateChannel,
    deleteChannel,
    toggleAI,
    getChannelById,
    getChannelsByType,
    canAddAccount,
    getNextAccountNumber,
    connectedCount,
    totalAccounts,
  };
}

// ======================
// CHANNEL AI CONFIG HOOK
// ======================

export function useChannelAIConfig(channelId: string | null) {
  const [config, setConfig] = useState<EffectiveChannelAIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    if (!channelId) {
      setConfig(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await channelsService.getChannelAIConfig(channelId);
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar configuración');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = useCallback(async (updates: Partial<EffectiveChannelAIConfig>) => {
    if (!channelId) return;

    try {
      setError(null);
      await channelsService.updateChannelAIConfig(channelId, updates);
      // Refresh to get merged config
      await fetchConfig();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      setError(message);
      throw err;
    }
  }, [channelId, fetchConfig]);

  return {
    config,
    loading,
    error,
    refresh: fetchConfig,
    updateConfig,
  };
}

// ======================
// SINGLE CHANNEL HOOK
// ======================

export function useChannel(channelId: string | null) {
  const [channel, setChannel] = useState<ChannelConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchChannel = useCallback(async () => {
    if (!channelId) {
      setChannel(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await channelsService.getChannel(channelId);
      setChannel(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar canal');
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    fetchChannel();
  }, [fetchChannel]);

  const update = useCallback(async (updates: Partial<UpdateChannelRequest>) => {
    if (!channelId) return;

    try {
      setError(null);
      const updated = await channelsService.updateChannel(channelId, updates);
      setChannel(prev => prev ? { ...prev, ...updated } : null);
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error al actualizar';
      setError(message);
      throw err;
    }
  }, [channelId]);

  return {
    channel,
    loading,
    error,
    refresh: fetchChannel,
    update,
  };
}
