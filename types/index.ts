// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Discovery Session
export interface DiscoverySession {
  id: string;
  user_id?: string;
  business_id?: string;
  chat_messages: Message[];
  questionnaire_answers: QuestionnaireAnswers;
  ai_analysis?: AIAnalysis;
  status: 'in_progress' | 'completed';
  created_at: Date;
  completed_at?: Date;
}

// Questionnaire Answers
export interface QuestionnaireAnswers {
  business_type?: string;
  locations?: string;
  employees_count?: string;
  monthly_transactions?: string;
  current_system?: string;
  missed_calls?: string;
  contact_info?: {
    name: string;
    email: string;
    phone: string;
  };
}

// AI Analysis (from Claude)
export interface AIAnalysis {
  business_type: string;
  primary_pain: string;
  financial_impact: number;
  time_impact: number;
  urgency_score: number;
  recommended_plan: 'starter' | 'essentials' | 'growth' | 'scale';
  recommended_addons: string[];
  recommended_especialidad: string | null;
  reasoning: string;
}

// Proposal
export interface Proposal {
  id: string;
  discovery_session_id: string;
  user_id?: string;
  recommended_plan: string;
  recommended_addons: string[];
  recommended_especialidad: string | null;
  total_monthly_price: number;
  activation_fee: number;
  roi_projection: ROIProjection;
  reasoning: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: Date;
}

// ROI Projection
export interface ROIProjection {
  monthly_savings: number;
  hours_recovered: number;
  payback_months: number;
}

// Subscription
export interface Subscription {
  id: string;
  user_id: string;
  business_id: string;
  proposal_id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  plan: string;
  addons: string[];
  branches: number;
  status: 'active' | 'cancelled' | 'past_due';
  current_period_start: Date;
  current_period_end: Date;
  created_at: Date;
}
