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

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Running follow-up automation check...');

    // Find leads that need follow-up
    // Criteria: Quote sent, no reply detected, last communication > 4 days ago, follow_up_count < 4
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);

    const { data: leadsNeedingFollowUp, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('reply_detected', false)
      .in('status', ['Quote Sent', 'Follow-up Sent 1', 'Follow-up Sent 2', 'Follow-up Sent 3'])
      .lt('last_communication_date', fourDaysAgo.toISOString())
      .lt('follow_up_count', 4);

    if (leadsError) throw leadsError;

    console.log(`Found ${leadsNeedingFollowUp?.length || 0} leads needing follow-up`);

    const results = [];

    for (const lead of leadsNeedingFollowUp || []) {
      try {
        console.log(`Processing follow-up for lead: ${lead.id} (${lead.director_email})`);

        const nextFollowUpNumber = lead.follow_up_count + 1;
        
        // Get follow-up template
        const { data: template, error: templateError } = await supabase
          .from('follow_up_templates')
          .select('*')
          .eq('sequence_number', nextFollowUpNumber)
          .eq('is_active', true)
          .single();

        if (templateError || !template) {
          console.error(`No template found for follow-up ${nextFollowUpNumber}`);
          continue;
        }

        // Personalize template content
        const personalizedEmailSubject = personalizeContent(template.email_subject, lead);
        const personalizedEmailBody = personalizeContent(template.email_body, lead);
        const personalizedSmsMessage = personalizeContent(template.sms_message, lead);

        // Send email
        const emailResponse = await supabase.functions.invoke('send-email', {
          body: {
            to: lead.director_email,
            subject: personalizedEmailSubject,
            content: personalizedEmailBody,
            leadId: lead.id,
            type: `follow_up_${nextFollowUpNumber}`
          }
        });

        // Send SMS
        const smsResponse = await supabase.functions.invoke('send-sms', {
          body: {
            to: lead.director_phone_number,
            message: personalizedSmsMessage,
            leadId: lead.id,
            type: `follow_up_${nextFollowUpNumber}_sms`
          }
        });

        // Update lead status and follow-up count
        const newStatus = `Follow-up Sent ${nextFollowUpNumber}`;
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: newStatus,
            follow_up_count: nextFollowUpNumber,
            last_communication_date: new Date().toISOString(),
            last_email_sent_type: `follow_up_${nextFollowUpNumber}`,
            last_sms_sent_type: `follow_up_${nextFollowUpNumber}_sms`
          })
          .eq('id', lead.id);

        if (updateError) throw updateError;

        results.push({
          leadId: lead.id,
          email: lead.director_email,
          followUpNumber: nextFollowUpNumber,
          emailSent: !emailResponse.error,
          smsSent: !smsResponse.error,
          newStatus
        });

        console.log(`Follow-up ${nextFollowUpNumber} sent to ${lead.director_email}`);

      } catch (error) {
        console.error(`Error processing follow-up for lead ${lead.id}:`, error);
        results.push({
          leadId: lead.id,
          email: lead.director_email,
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      processed: results.length,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in follow-up-automation function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

function personalizeContent(template: string, lead: any): string {
  return template
    .replace(/{director_first_name}/g, lead.director_first_name || 'there')
    .replace(/{director_last_name}/g, lead.director_last_name || '')
    .replace(/{workout_program_name}/g, lead.workout_program_name || lead.ensemble_program_name || 'our program')
    .replace(/{school_name}/g, lead.school_name || 'your organization')
    .replace(/{estimated_performers}/g, lead.estimated_performers || 'your group');
}

serve(serve_handler);