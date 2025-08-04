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

interface WebhookData {
  leadId: string;
  leadData: any;
  eventType: 'new_lead' | 'lead_updated' | 'email_sent' | 'status_changed';
  timestamp: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookData: WebhookData = await req.json();
    
    console.log(`Processing webhook for event: ${webhookData.eventType}`);

    // Get all active Zapier integrations for this event type
    const { data: integrations, error } = await supabase
      .from('zapier_integrations')
      .select('*')
      .eq('trigger_type', webhookData.eventType)
      .eq('status', 'active');

    if (error) {
      console.error('Error fetching integrations:', error);
      throw error;
    }

    const results = [];

    // Send webhook to each active integration
    for (const integration of integrations || []) {
      try {
        console.log(`Sending webhook to: ${integration.webhook_url}`);
        
        const webhookPayload = {
          event_type: webhookData.eventType,
          timestamp: webhookData.timestamp,
          lead_id: webhookData.leadId,
          lead_data: webhookData.leadData,
          integration_name: integration.name,
          crm_source: 'Music Education CRM'
        };

        const response = await fetch(integration.webhook_url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload),
        });

        const result = {
          integration_id: integration.id,
          integration_name: integration.name,
          success: response.ok,
          status_code: response.status,
          response_text: await response.text()
        };

        results.push(result);

        // Update last triggered timestamp
        await supabase
          .from('zapier_integrations')
          .update({ 
            last_triggered: new Date().toISOString(),
            status: response.ok ? 'active' : 'error'
          })
          .eq('id', integration.id);

        console.log(`Webhook sent to ${integration.name}: ${response.ok ? 'Success' : 'Failed'}`);
      } catch (error) {
        console.error(`Error sending webhook to ${integration.name}:`, error);
        results.push({
          integration_id: integration.id,
          integration_name: integration.name,
          success: false,
          error: error.message
        });

        // Mark integration as error
        await supabase
          .from('zapier_integrations')
          .update({ status: 'error' })
          .eq('id', integration.id);
      }
    }

    // Log webhook execution
    await supabase
      .from('webhook_logs')
      .insert({
        event_type: webhookData.eventType,
        lead_id: webhookData.leadId,
        payload: webhookData,
        results: results,
        executed_at: new Date().toISOString()
      });

    return new Response(JSON.stringify({
      success: true,
      event_type: webhookData.eventType,
      integrations_triggered: results.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in webhook-dispatcher function:', error);
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