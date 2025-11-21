import { supabase } from './auth';

export interface DiscoverySession {
  id: string;
  client_id: string | null;
  session_token: string;
  business_type: string | null;
  conversation_history: any[];
  extracted_data: any | null;
  ai_analysis: any | null;
  status: 'active' | 'completed' | 'abandoned';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionParams {
  clientId?: string;
  sessionToken: string;
  businessType?: string;
}

export interface UpdateSessionParams {
  conversationHistory?: any[];
  extractedData?: any;
  aiAnalysis?: any;
  status?: 'active' | 'completed' | 'abandoned';
  businessType?: string;
}

// Create a new discovery session
export async function createDiscoverySession(params: CreateSessionParams): Promise<DiscoverySession | null> {
  const { data, error } = await supabase
    .from('discovery_sessions')
    .insert({
      client_id: params.clientId || null,
      session_token: params.sessionToken,
      business_type: params.businessType || null,
      conversation_history: [],
      status: 'active',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating discovery session:', error);
    return null;
  }

  return data;
}

// Get session by token
export async function getSessionByToken(sessionToken: string): Promise<DiscoverySession | null> {
  const { data, error } = await supabase
    .from('discovery_sessions')
    .select('*')
    .eq('session_token', sessionToken)
    .single();

  if (error) {
    console.error('Error fetching session:', error);
    return null;
  }

  return data;
}

// Update discovery session
export async function updateDiscoverySession(
  sessionId: string,
  params: UpdateSessionParams
): Promise<DiscoverySession | null> {
  const updateData: any = {
    updated_at: new Date().toISOString(),
  };

  if (params.conversationHistory !== undefined) {
    updateData.conversation_history = params.conversationHistory;
  }
  if (params.extractedData !== undefined) {
    updateData.extracted_data = params.extractedData;
  }
  if (params.aiAnalysis !== undefined) {
    updateData.ai_analysis = params.aiAnalysis;
  }
  if (params.status !== undefined) {
    updateData.status = params.status;
    if (params.status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }
  }
  if (params.businessType !== undefined) {
    updateData.business_type = params.businessType;
  }

  const { data, error } = await supabase
    .from('discovery_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) {
    console.error('Error updating discovery session:', error);
    return null;
  }

  return data;
}

// Link session to client after they authenticate
export async function linkSessionToClient(
  sessionId: string,
  clientId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('discovery_sessions')
    .update({ client_id: clientId })
    .eq('id', sessionId);

  if (error) {
    console.error('Error linking session to client:', error);
    return false;
  }

  return true;
}

// Get client's discovery sessions
export async function getClientSessions(clientId: string): Promise<DiscoverySession[]> {
  const { data, error } = await supabase
    .from('discovery_sessions')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching client sessions:', error);
    return [];
  }

  return data || [];
}

// Parse AI analysis from response
export function parseAIAnalysis(content: string): any | null {
  const analysisMatch = content.match(/ANALYSIS_COMPLETE::({[\s\S]*})/);
  if (analysisMatch) {
    try {
      return JSON.parse(analysisMatch[1]);
    } catch (e) {
      console.error('Error parsing AI analysis:', e);
      return null;
    }
  }
  return null;
}

// Generate a unique session token
export function generateSessionToken(): string {
  return `ds_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}
