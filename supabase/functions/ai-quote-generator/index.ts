import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIModel {
  id: string;
  name: string;
  provider: 'gemini' | 'openai';
  model_id: string;
  is_primary: boolean;
  is_fallback: boolean;
  configuration: any;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData } = await req.json();
    
    console.log('Generating AI quote for lead:', leadData.id);

    // Get AI model configurations
    const { data: aiModels, error: modelsError } = await supabase
      .from('ai_models')
      .select('*')
      .order('is_primary', { ascending: false });

    if (modelsError) throw modelsError;

    const primaryModel = aiModels.find(m => m.is_primary);
    const fallbackModel = aiModels.find(m => m.is_fallback);

    if (!primaryModel) {
      throw new Error('No primary AI model configured');
    }

    // Generate quote using primary model, fallback if needed
    let quoteResult;
    try {
      quoteResult = await generateQuote(leadData, primaryModel);
    } catch (error) {
      console.error('Primary AI model failed, trying fallback:', error);
      if (fallbackModel) {
        quoteResult = await generateQuote(leadData, fallbackModel, true);
      } else {
        throw new Error('Primary AI failed and no fallback model available');
      }
    }

    // Update lead with quote information
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'Quote Sent',
        quote_sent_date: new Date().toISOString(),
        last_communication_date: new Date().toISOString(),
        standard_rate_sr: quoteResult.standardRate,
        discount_rate_dr: quoteResult.discountRate,
        savings: quoteResult.savings,
        ai_suggested_message: quoteResult.emailContent
      })
      .eq('id', leadData.id);

    if (updateError) throw updateError;

    // Send email and SMS
    const emailResponse = await supabase.functions.invoke('send-email', {
      body: {
        to: leadData.director_email,
        subject: quoteResult.emailSubject,
        content: quoteResult.emailContent,
        leadId: leadData.id,
        type: 'quote'
      }
    });

    const smsResponse = await supabase.functions.invoke('send-sms', {
      body: {
        to: leadData.director_phone_number,
        message: quoteResult.smsContent,
        leadId: leadData.id,
        type: 'quote_notification'
      }
    });

    // Log communication
    await supabase
      .from('communication_history')
      .insert([
        {
          lead_id: leadData.id,
          communication_type: 'email',
          direction: 'outbound',
          subject: quoteResult.emailSubject,
          content: quoteResult.emailContent,
          sent_at: new Date().toISOString()
        },
        {
          lead_id: leadData.id,
          communication_type: 'sms',
          direction: 'outbound',
          content: quoteResult.smsContent,
          sent_at: new Date().toISOString()
        }
      ]);

    return new Response(JSON.stringify({
      success: true,
      leadId: leadData.id,
      quote: quoteResult,
      emailSent: !emailResponse.error,
      smsSent: !smsResponse.error
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-quote-generator function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function generateQuote(leadData: any, model: AIModel, isFallback = false): Promise<any> {
  const prompt = `
You are an AI assistant for a music education equipment company. Generate a personalized quote for the following lead:

Lead Information:
- Director: ${leadData.director_first_name} ${leadData.director_last_name}
- Email: ${leadData.director_email}
- School/Organization: ${leadData.school_name || 'Not specified'}
- Program: ${leadData.ensemble_program_name || leadData.workout_program_name || 'Not specified'}
- Estimated Performers: ${leadData.estimated_performers || 'Not specified'}
- Season: ${leadData.season || 'Not specified'}
- Early Bird Deadline: ${leadData.early_bird_deadline || 'Not specified'}

Calculate pricing based on these rules:
- Base rate: $15 per performer for programs with 50+ performers
- Base rate: $18 per performer for programs with fewer than 50 performers
- Early bird discount: 15% off if deadline is mentioned
- Minimum order: $500

Generate a professional email that includes:
1. Personal greeting using their name
2. Quote details with pricing breakdown
3. Early bird savings if applicable
4. Call to action
5. Professional signature

Also generate a short SMS notification (160 characters max).

Return your response as a JSON object with:
{
  "emailSubject": "...",
  "emailContent": "...",
  "smsContent": "...",
  "standardRate": number,
  "discountRate": number,
  "savings": number
}
`;

  if (model.provider === 'gemini' && geminiApiKey) {
    return await callGeminiAPI(prompt, model);
  } else if (model.provider === 'openai' && openaiApiKey) {
    return await callOpenAIAPI(prompt, model);
  } else {
    throw new Error(`API key not configured for provider: ${model.provider}`);
  }
}

async function callGeminiAPI(prompt: string, model: AIModel): Promise<any> {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: model.configuration?.temperature || 0.7,
        maxOutputTokens: model.configuration?.max_tokens || 1000,
      }
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates[0]?.content?.parts[0]?.text;
  
  if (!content) {
    throw new Error('No content generated by Gemini');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON');
  }
}

async function callOpenAIAPI(prompt: string, model: AIModel): Promise<any> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: model.model_id,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant that generates personalized quotes for music education equipment. Always respond with valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: model.configuration?.temperature || 0.7,
      max_tokens: model.configuration?.max_tokens || 1000,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content generated by OpenAI');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Failed to parse OpenAI response as JSON');
  }
}

serve(serve_handler);