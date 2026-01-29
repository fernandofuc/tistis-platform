// =====================================================
// TIS TIS PLATFORM - Process Embedding Invalidations CRON Job
// Processes pending embedding invalidations from queue
// =====================================================
// This endpoint should be called by a cron job every 5 minutes
// to regenerate embeddings for content that has been updated.
//
// Recommended frequency: Every 5 minutes
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { EmbeddingService } from '@/src/features/ai/services/embedding.service';

// Prevent Next.js from caching this route
export const dynamic = 'force-dynamic';

// Timeout of 120 seconds for processing
export const maxDuration = 120;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Timing-safe comparison for CRON_SECRET
 */
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without auth if CRON_SECRET not configured
  if (!cronSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[CRON: Process Invalidations] CRON_SECRET not configured in production');
      return false;
    }
    console.warn('[CRON: Process Invalidations] Running without authentication in development mode');
    return true;
  }

  // Verify authorization header
  if (!authHeader?.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.substring(7);

  // Use crypto.timingSafeEqual for timing-safe comparison
  try {
    // Pad both to fixed length to prevent length-based timing attacks
    const FIXED_LENGTH = 64;
    const paddedToken = token.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);
    const paddedSecret = cronSecret.padEnd(FIXED_LENGTH, '\0').slice(0, FIXED_LENGTH);

    const tokenBuffer = Buffer.from(paddedToken, 'utf-8');
    const secretBuffer = Buffer.from(paddedSecret, 'utf-8');
    return crypto.timingSafeEqual(tokenBuffer, secretBuffer);
  } catch {
    return false;
  }
}

interface InvalidationEntry {
  id: string;
  tenant_id: string;
  source_type: string;
  source_id: string;
  invalidation_reason: string;
  priority: number;
}

/**
 * GET /api/cron/process-invalidations
 *
 * Processes pending embedding invalidations.
 * Regenerates embeddings for updated content.
 *
 * Headers required:
 * - Authorization: Bearer {CRON_SECRET}
 *
 * Query params optional:
 * - limit: Max invalidations to process (default: 50, max: 100)
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Verify authorization
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { searchParams } = new URL(request.url);
    const requestedLimit = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(1, requestedLimit), 100);

    console.log(`[CRON: Process Invalidations] Starting with limit: ${limit}`);

    // Verify OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY) {
      console.error('[CRON: Process Invalidations] OPENAI_API_KEY not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'OpenAI API key not configured',
          processing_time_ms: Date.now() - startTime,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Get pending invalidations
    const { data: pendingData, error: fetchError } = await supabase.rpc('get_pending_embedding_invalidations', {
      p_limit: limit,
    });

    if (fetchError) {
      console.error('[CRON: Process Invalidations] Fetch error:', fetchError);
      throw fetchError;
    }

    const pending = (pendingData || []) as InvalidationEntry[];

    if (pending.length === 0) {
      console.log('[CRON: Process Invalidations] No pending invalidations');
      return NextResponse.json({
        success: true,
        processed: 0,
        errors: 0,
        processing_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`[CRON: Process Invalidations] Found ${pending.length} pending invalidations`);

    let processed = 0;
    let errors = 0;

    // Process each invalidation
    for (const entry of pending) {
      try {
        // Get content based on source_type
        let content: string | null = null;
        let title: string | null = null;

        switch (entry.source_type) {
          case 'knowledge_article': {
            const { data: article } = await supabase
              .from('ai_knowledge_articles')
              .select('title, content')
              .eq('id', entry.source_id)
              .single();
            if (article) {
              title = article.title;
              content = `${article.title} ${article.content}`;
            }
            break;
          }

          case 'faq': {
            const { data: faq } = await supabase
              .from('faqs')
              .select('question, answer')
              .eq('id', entry.source_id)
              .single();
            if (faq) {
              title = faq.question;
              content = `${faq.question} ${faq.answer}`;
            }
            break;
          }

          case 'service': {
            const { data: service } = await supabase
              .from('services')
              .select('name, description')
              .eq('id', entry.source_id)
              .single();
            if (service) {
              title = service.name;
              content = `${service.name} ${service.description || ''}`;
            }
            break;
          }

          default:
            console.warn(`[CRON: Process Invalidations] Unknown source_type: ${entry.source_type}`);
            break;
        }

        if (!content) {
          // Content no longer exists, mark as completed
          await supabase.rpc('complete_embedding_invalidation', {
            p_id: entry.id,
            p_success: true,
            p_error_message: 'Source content not found (may have been deleted)',
          });
          processed++;
          continue;
        }

        // Regenerate embedding based on source type
        // Each method generates and stores the embedding in the appropriate table
        switch (entry.source_type) {
          case 'knowledge_article':
            await EmbeddingService.updateKnowledgeArticleEmbedding(entry.source_id, content);
            break;

          case 'faq':
            // Use already fetched data (title = question, content includes both)
            await EmbeddingService.updateFaqEmbedding(
              entry.source_id,
              title || '',
              content.replace(title || '', '').trim()
            );
            break;

          case 'service':
            // Use already fetched data (title = name)
            await EmbeddingService.updateServiceEmbedding(
              entry.source_id,
              title || '',
              content.replace(title || '', '').trim()
            );
            break;
        }

        // Mark as completed
        await supabase.rpc('complete_embedding_invalidation', {
          p_id: entry.id,
          p_success: true,
        });

        console.log(`[CRON: Process Invalidations] Regenerated ${entry.source_type} ${entry.source_id}`);
        processed++;
      } catch (itemError) {
        console.error(`[CRON: Process Invalidations] Error processing ${entry.source_type} ${entry.source_id}:`, itemError);

        // Mark as failed
        await supabase.rpc('complete_embedding_invalidation', {
          p_id: entry.id,
          p_success: false,
          p_error_message: itemError instanceof Error ? itemError.message : 'Unknown error',
        });

        errors++;
      }
    }

    const processingTime = Date.now() - startTime;

    console.log(
      `[CRON: Process Invalidations] Completed in ${processingTime}ms. ` +
      `Processed: ${processed}, Errors: ${errors}`
    );

    return NextResponse.json({
      success: true,
      processed,
      errors,
      total_pending: pending.length,
      processing_time_ms: processingTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;

    console.error('[CRON: Process Invalidations] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/process-invalidations
 *
 * Alternative for cron services that use POST.
 * Identical functionality to GET.
 */
export async function POST(request: NextRequest) {
  return GET(request);
}
