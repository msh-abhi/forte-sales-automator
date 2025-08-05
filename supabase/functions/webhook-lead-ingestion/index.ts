import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadSubmissionData {
  director_first_name: string;
  director_last_name: string;
  director_email: string;
  director_phone_number?: string;
  school_name?: string;
  ensemble_program_name?: string;
  workout_program_name?: string;
  estimated_performers?: number;
  season?: string;
  early_bird_deadline?: string;
  source?: string;
  [key: string]: any;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const submissionData: LeadSubmissionData = await req.json();
    
    console.log('Processing lead submission:', submissionData);

    // Validate required fields
    if (!submissionData.director_email || !submissionData.director_first_name || !submissionData.director_last_name) {
      throw new Error('Missing required fields: director_email, director_first_name, director_last_name');
    }

    // Perform upsert operation - update if exists by email, create if new
    const { data: existingLead, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .eq('director_email', submissionData.director_email)
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching existing lead:', fetchError);
      throw fetchError;
    }

    let leadData;
    const currentTime = new Date().toISOString();

    if (existingLead) {
      // Update existing lead
      const { data, error } = await supabase
        .from('leads')
        .update({
          ...submissionData,
          raw_submission_data: submissionData,
          updated_at: currentTime,
        })
        .eq('id', existingLead.id)
        .select()
        .single();

      if (error) throw error;
      leadData = data;
      console.log('Updated existing lead:', leadData.id);
    } else {
      // Create new lead
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...submissionData,
          raw_submission_data: submissionData,
          status: 'New Lead',
          form_submission_date: currentTime,
          follow_up_count: 0,
          reply_detected: false,
        })
        .select()
        .single();

      if (error) throw error;
      leadData = data;
      console.log('Created new lead:', leadData.id);
    }

    // Trigger AI quote generation process
    const aiResponse = await supabase.functions.invoke('ai-quote-generator', {
      body: { leadData }
    });

    if (aiResponse.error) {
      console.error('Error triggering AI quote generation:', aiResponse.error);
      // Don't fail the webhook, just log the error
    }

    return new Response(JSON.stringify({
      success: true,
      leadId: leadData.id,
      action: existingLead ? 'updated' : 'created',
      leadData: leadData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in webhook-lead-ingestion function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(serve_handler);