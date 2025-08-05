import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMSRequest {
  to: string;
  message: string;
  leadId?: string;
  type?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, message, leadId, type }: SMSRequest = await req.json();
    
    console.log('Sending SMS to:', to);

    if (!to || !message) {
      throw new Error('Missing required fields: to, message');
    }

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.log('Twilio credentials not configured, skipping SMS send');
      return new Response(JSON.stringify({
        success: false,
        error: 'Twilio credentials not configured'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean phone number (remove any non-digit characters except +)
    const cleanPhoneNumber = to.replace(/[^\d+]/g, '');
    
    if (!cleanPhoneNumber) {
      throw new Error('Invalid phone number format');
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const credentials = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    const formData = new URLSearchParams();
    formData.append('To', cleanPhoneNumber);
    formData.append('From', twilioPhoneNumber);
    formData.append('Body', message);

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twilio API error:', errorText);
      throw new Error(`Twilio API error: ${response.statusText}`);
    }

    const twilioResponse = await response.json();
    console.log('SMS sent successfully:', twilioResponse.sid);

    // Log communication if leadId provided
    if (leadId) {
      await supabase
        .from('communication_history')
        .insert({
          lead_id: leadId,
          communication_type: 'sms',
          direction: 'outbound',
          content: message,
          external_id: twilioResponse.sid,
          metadata: { type, twilioSid: twilioResponse.sid },
          sent_at: new Date().toISOString()
        });

      // Update lead's last communication date and SMS type
      await supabase
        .from('leads')
        .update({
          last_communication_date: new Date().toISOString(),
          last_sms_sent_type: type
        })
        .eq('id', leadId);
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: twilioResponse.sid,
      status: twilioResponse.status
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in send-sms function:', error);
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