import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AutomationRequest {
  action: 'schedule_follow_up' | 'update_status' | 'send_quote_reminder' | 'analyze_leads';
  leadId?: string;
  params?: any;
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, leadId, params }: AutomationRequest = await req.json();

    console.log(`Processing automation action: ${action} for lead: ${leadId}`);

    let result;

    switch (action) {
      case 'schedule_follow_up':
        result = await scheduleFollowUp(leadId!, params);
        break;
      case 'update_status':
        result = await updateLeadStatus(leadId!, params);
        break;
      case 'send_quote_reminder':
        result = await sendQuoteReminder(leadId!);
        break;
      case 'analyze_leads':
        result = await analyzeLeads();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({
      success: true,
      result: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in lead-automation function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function scheduleFollowUp(leadId: string, params: any) {
  const { days = 3, type = 'follow_up' } = params || {};
  
  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError) throw leadError;

  // Calculate follow-up date
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + days);

  // Update lead with follow-up count
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      follow_up_count: (lead.follow_up_count || 0) + 1,
      last_communication_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (updateError) throw updateError;

  // Log the scheduled follow-up
  const { error: logError } = await supabase
    .from('communication_history')
    .insert({
      lead_id: leadId,
      communication_type: 'scheduled_follow_up',
      direction: 'internal',
      subject: `${type} follow-up scheduled`,
      content: `Follow-up scheduled for ${followUpDate.toLocaleDateString()} (${days} days from now)`,
      sent_at: new Date().toISOString(),
      metadata: {
        scheduled_date: followUpDate.toISOString(),
        follow_up_type: type
      }
    });

  if (logError) throw logError;

  return {
    leadId,
    followUpDate: followUpDate.toISOString(),
    message: `Follow-up scheduled for ${followUpDate.toLocaleDateString()}`
  };
}

async function updateLeadStatus(leadId: string, params: any) {
  const { status, reason } = params;

  if (!status) {
    throw new Error('Status is required');
  }

  // Update lead status
  const { error: updateError } = await supabase
    .from('leads')
    .update({
      status: status,
      updated_at: new Date().toISOString()
    })
    .eq('id', leadId);

  if (updateError) throw updateError;

  // Log the status change
  const { error: logError } = await supabase
    .from('communication_history')
    .insert({
      lead_id: leadId,
      communication_type: 'status_change',
      direction: 'internal',
      subject: `Status changed to ${status}`,
      content: reason ? `Status changed to ${status}. Reason: ${reason}` : `Status changed to ${status}`,
      sent_at: new Date().toISOString(),
      metadata: {
        old_status: params.old_status,
        new_status: status,
        reason: reason
      }
    });

  if (logError) throw logError;

  return {
    leadId,
    newStatus: status,
    message: `Lead status updated to ${status}`
  };
}

async function sendQuoteReminder(leadId: string) {
  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();

  if (leadError) throw leadError;

  // Check if quote was sent
  if (!lead.quote_sent_date) {
    throw new Error('No quote has been sent to this lead');
  }

  // Calculate days since quote was sent
  const quoteSentDate = new Date(lead.quote_sent_date);
  const daysSinceQuote = Math.floor((new Date().getTime() - quoteSentDate.getTime()) / (1000 * 60 * 60 * 24));

  // Log the reminder
  const { error: logError } = await supabase
    .from('communication_history')
    .insert({
      lead_id: leadId,
      communication_type: 'quote_reminder',
      direction: 'internal',
      subject: 'Quote reminder triggered',
      content: `Quote reminder sent. Original quote sent ${daysSinceQuote} days ago.`,
      sent_at: new Date().toISOString(),
      metadata: {
        days_since_quote: daysSinceQuote,
        original_quote_date: lead.quote_sent_date
      }
    });

  if (logError) throw logError;

  return {
    leadId,
    daysSinceQuote,
    message: `Quote reminder processed for lead (${daysSinceQuote} days since original quote)`
  };
}

async function analyzeLeads() {
  // Get leads that need attention
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  const now = new Date();
  const analysis = {
    total_leads: leads.length,
    new_leads: 0,
    stale_leads: 0,
    needs_follow_up: 0,
    converted: 0,
    recommendations: []
  };

  leads.forEach(lead => {
    const daysSinceSubmission = Math.floor((now.getTime() - new Date(lead.form_submission_date).getTime()) / (1000 * 60 * 60 * 24));
    const daysSinceLastCommunication = lead.last_communication_date 
      ? Math.floor((now.getTime() - new Date(lead.last_communication_date).getTime()) / (1000 * 60 * 60 * 24))
      : daysSinceSubmission;

    switch (lead.status) {
      case 'New Lead':
        analysis.new_leads++;
        if (daysSinceSubmission > 2) {
          analysis.recommendations.push({
            leadId: lead.id,
            type: 'urgent_follow_up',
            message: `${lead.director_first_name} ${lead.director_last_name} - New lead from ${daysSinceSubmission} days ago needs initial contact`
          });
        }
        break;
      case 'Active Follow-up':
        if (daysSinceLastCommunication > 7) {
          analysis.needs_follow_up++;
          analysis.recommendations.push({
            leadId: lead.id,
            type: 'overdue_follow_up',
            message: `${lead.director_first_name} ${lead.director_last_name} - ${daysSinceLastCommunication} days since last communication`
          });
        }
        break;
      case 'Converted':
        analysis.converted++;
        break;
      case 'Inactive':
        if (daysSinceLastCommunication > 30) {
          analysis.stale_leads++;
        }
        break;
    }

    // Check for quote follow-ups
    if (lead.quote_sent_date && !lead.payment_date) {
      const daysSinceQuote = Math.floor((now.getTime() - new Date(lead.quote_sent_date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceQuote > 5 && daysSinceQuote < 30) {
        analysis.recommendations.push({
          leadId: lead.id,
          type: 'quote_follow_up',
          message: `${lead.director_first_name} ${lead.director_last_name} - Quote sent ${daysSinceQuote} days ago, needs follow-up`
        });
      }
    }
  });

  return analysis;
}

serve(serve_handler);