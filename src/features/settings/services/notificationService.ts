// =====================================================
// TIS TIS PLATFORM - Notification Preferences Service
// =====================================================

import { supabase } from '@/shared/lib/supabase';

// ======================
// TYPES
// ======================
export interface NotificationPreferences {
  id?: string;
  user_id?: string;

  // In-app
  enable_in_app: boolean;

  // Type preferences (matches DB column names)
  notify_lead_hot: boolean;
  notify_appointment_created: boolean;
  notify_appointment_cancelled: boolean;
  notify_conversation_escalated: boolean;

  // Email
  enable_email: boolean;
  email_daily_digest: boolean;

  // WhatsApp (future - Phase 2)
  enable_whatsapp?: boolean;
  whatsapp_number?: string;

  // Push (future)
  enable_push: boolean;
}

// Default preferences when none exist
const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'id' | 'user_id'> = {
  enable_in_app: true,
  notify_lead_hot: true,
  notify_appointment_created: true,
  notify_appointment_cancelled: true,
  notify_conversation_escalated: true,
  enable_email: false,
  email_daily_digest: false,
  enable_whatsapp: false,
  whatsapp_number: '',
  enable_push: false,
};

// ======================
// FETCH PREFERENCES
// ======================
export async function fetchNotificationPreferences(): Promise<{
  success: boolean;
  preferences?: NotificationPreferences;
  error?: string;
}> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('🟡 No authenticated user for notification preferences');
      return { success: false, error: 'No hay usuario autenticado' };
    }

    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('🔴 Fetch notification preferences error:', error.message);
      return { success: false, error: error.message };
    }

    // No preferences found - return defaults (this is normal for new users)
    if (!data) {
      console.log('🟡 No notification preferences found, returning defaults');
      return {
        success: true,
        preferences: { ...DEFAULT_PREFERENCES, user_id: user.id }
      };
    }

    console.log('🟢 Notification preferences fetched');
    return { success: true, preferences: data as NotificationPreferences };
  } catch (err) {
    console.error('🔴 Fetch notification preferences exception:', err);
    return { success: false, error: 'Error inesperado al obtener preferencias' };
  }
}

// ======================
// UPDATE PREFERENCES
// ======================
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<{
  success: boolean;
  preferences?: NotificationPreferences;
  error?: string;
}> {
  try {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('🟡 No authenticated user for notification preferences');
      return { success: false, error: 'No hay usuario autenticado' };
    }

    // Build update data (exclude id and user_id from update)
    const { id, user_id, ...updateData } = preferences;

    // Add updated_at
    const dataToSave = {
      ...updateData,
      updated_at: new Date().toISOString(),
    };

    // Try to update first
    const { data: updatedData, error: updateError } = await supabase
      .from('notification_preferences')
      .update(dataToSave)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (updateError) {
      console.error('🔴 Update notification preferences error:', updateError.message);
      return { success: false, error: updateError.message };
    }

    // No row existed to update - insert instead
    if (!updatedData) {
      const { data: insertedData, error: insertError } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          ...DEFAULT_PREFERENCES,
          ...updateData,
        })
        .select()
        .single();

      if (insertError) {
        console.error('🔴 Insert notification preferences error:', insertError.message);
        return { success: false, error: insertError.message };
      }

      console.log('🟢 Notification preferences created');
      return { success: true, preferences: insertedData as NotificationPreferences };
    }

    console.log('🟢 Notification preferences updated');
    return { success: true, preferences: updatedData as NotificationPreferences };
  } catch (err) {
    console.error('🔴 Update notification preferences exception:', err);
    return { success: false, error: 'Error inesperado al guardar preferencias' };
  }
}

// ======================
// TOGGLE SINGLE PREFERENCE
// ======================
export async function toggleNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'No hay usuario autenticado' };
    }

    // Check if preferences exist
    const { data: existing } = await supabase
      .from('notification_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('notification_preferences')
        .update({
          [key]: value,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      if (error) {
        console.error('🔴 Toggle preference error:', error.message);
        return { success: false, error: error.message };
      }
    } else {
      // Insert new with default values
      const { error } = await supabase
        .from('notification_preferences')
        .insert({
          user_id: user.id,
          ...DEFAULT_PREFERENCES,
          [key]: value,
        });

      if (error) {
        console.error('🔴 Insert preference error:', error.message);
        return { success: false, error: error.message };
      }
    }

    console.log(`🟢 Notification preference ${key} set to ${value}`);
    return { success: true };
  } catch (err) {
    console.error('🔴 Toggle preference exception:', err);
    return { success: false, error: 'Error inesperado' };
  }
}
