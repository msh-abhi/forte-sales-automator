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

interface ReplyAnalysisRequest {
  leadEmail: string;
  replyContent: string;
  replySubject?: string;
  replyTimestamp?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadEmail, replyContent, replySubject, replyTimestamp }: ReplyAnalysisRequest = await req.json();
    
    console.log('Analyzing reply from:', leadEmail);

    // Find the lead by email
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('director_email', leadEmail)
      .maybeSingle();

    if (leadError) throw leadError;
    
    if (!lead) {
      console.log('No lead found for email:', leadEmail);
      return new Response(JSON.stringify({
        success: false,
        error: 'Lead not found'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update lead to mark reply as detected
    await supabase
      .from('leads')
      .update({
        reply_detected: true,
        last_reply_content: replyContent,
        last_communication_date: replyTimestamp || new Date().toISOString()
      })
      .eq('id', lead.id);

    // Log the incoming communication
    await supabase
      .from('communication_history')
      .insert({
        lead_id: lead.id,
        communication_type: 'email',
        direction: 'inbound',
        subject: replySubject,
        content: replyContent,
        sent_at: replyTimestamp || new Date().toISOString()
      });

    // Analyze reply content with AI
    const analysisResult = await analyzeReplyContent(replyContent, lead);

    if (analysisResult.purchaseIntent) {
      console.log('Purchase intent detected for lead:', lead.id);
      
      // Trigger QuickBooks customer creation and invoice generation
      const conversionResponse = await supabase.functions.invoke('quickbooks-conversion', {
        body: { leadId: lead.id, leadData: lead }
      });

      // Update lead status
      await supabase
        .from('leads')
        .update({
          status: 'Converted - Invoice Sent',
          ai_suggested_message: analysisResult.suggestedResponse
        })
        .eq('id', lead.id);

    } else {
      console.log('No purchase intent detected, sending AI response');
      
      // Send AI-generated response
      const emailResponse = await supabase.functions.invoke('send-email', {
        body: {
          to: lead.director_email,
          subject: `Re: ${replySubject || 'Your inquiry'}`,
          content: analysisResult.suggestedResponse,
          leadId: lead.id,
          type: 'ai_response'
        }
      });

      const smsResponse = await supabase.functions.invoke('send-sms', {
        body: {
          to: lead.director_phone_number,
          message: 'We\'ve replied to your email. Please check your inbox!',
          leadId: lead.id,
          type: 'reply_notification'
        }
      });

      // Update lead status
      await supabase
        .from('leads')
        .update({
          status: 'Reply Received - Awaiting Action',
          ai_suggested_message: analysisResult.suggestedResponse
        })
        .eq('id', lead.id);
    }

    return new Response(JSON.stringify({
      success: true,
      leadId: lead.id,
      purchaseIntent: analysisResult.purchaseIntent,
      analysisResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in reply-detection function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function analyzeReplyContent(replyContent: string, leadData: any): Promise<any> {
  // Get AI models
  const { data: aiModels } = await supabase
    .from('ai_models')
    .select('*')
    .order('is_primary', { ascending: false });

  const primaryModel = aiModels?.find(m => m.is_primary);
  const fallbackModel = aiModels?.find(m => m.is_fallback);

  const prompt = `
Analyze this email reply from a potential customer and determine their intent:

Customer: ${leadData.director_first_name} ${leadData.director_last_name}
Program: ${leadData.ensemble_program_name || leadData.workout_program_name}
Previous Status: ${leadData.status}

Reply Content:
"${replyContent}"

Determine:
1. Do they show PURCHASE INTENT? (Yes/No)
2. What is their primary concern or question?
3. Generate an appropriate response

Purchase intent indicators:
- Ready to move forward, purchase, buy
- Asking about payment, invoicing, next steps
- Confirming details for purchase
- Expressing urgency or commitment

Return JSON:
{
  "purchaseIntent": boolean,
  "primaryConcern": "string",
  "suggestedResponse": "string (professional email response)",
  "confidence": number (0-1)
}
`;

  try {
    if (primaryModel) {
      return await callAIModel(prompt, primaryModel);
    } else if (fallbackModel) {
      return await callAIModel(prompt, fallbackModel);
    }
  } catch (error) {
    console.error('AI analysis failed:', error);
    // Return default response
    return {
      purchaseIntent: false,
      primaryConcern: "Unable to analyze",
      suggestedResponse: `Thank you for your reply, ${leadData.director_first_name}. We've received your message and will review it shortly. Someone from our team will get back to you within 24 hours.`,
      confidence: 0
    };
  }
}

async function callAIModel(prompt: string, model: any): Promise<any> {
  try {
    if (model.provider === 'gemini' && geminiApiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model.model_id}:generateContent?key=${geminiApiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1000,
          }
        }),
      });

      if (!response.ok) {
        console.error(`Gemini API error: ${response.status} ${response.statusText}`);
        throw new Error(`Gemini API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Gemini API Response:', JSON.stringify(data, null, 2));

      // Check if response structure is valid
      if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error('Gemini: Missing/empty candidates array', JSON.stringify(data, null, 2));
        throw new Error('Invalid Gemini response structure');
      }

      const candidate = data.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
        console.error('Gemini: Missing/empty candidate content', JSON.stringify(candidate, null, 2));
        throw new Error('Invalid Gemini candidate structure');
      }

      const content = candidate.content.parts[0]?.text;
      if (!content || content.trim() === '') {
        console.error('Gemini: Empty content text', JSON.stringify(candidate, null, 2));
        throw new Error('Empty Gemini response content');
      }

      // Clean and parse JSON
      let cleanContent = content.trim();
      // Remove markdown code blocks if present
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      try {
        return JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Gemini: JSON parse error', parseError, 'Content:', cleanContent);
        throw new Error('Failed to parse Gemini JSON response');
      }

    } else if (model.provider === 'openai' && openaiApiKey) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model.model_id,
          messages: [
            { role: 'system', content: 'Analyze customer email replies and determine purchase intent. Respond with valid JSON only.' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error: ${response.status} ${response.statusText}`);
        throw new Error(`OpenAI API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', JSON.stringify(data, null, 2));

      // Check if response structure is valid
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('OpenAI: Missing/empty choices array', JSON.stringify(data, null, 2));
        throw new Error('Invalid OpenAI response structure');
      }

      const choice = data.choices[0];
      if (!choice || !choice.message || !choice.message.content) {
        console.error('OpenAI: Missing/empty choice content', JSON.stringify(choice, null, 2));
        throw new Error('Invalid OpenAI choice structure');
      }

      const content = choice.message.content;
      if (!content || content.trim() === '') {
        console.error('OpenAI: Empty content text', JSON.stringify(choice, null, 2));
        throw new Error('Empty OpenAI response content');
      }

      // Clean and parse JSON
      let cleanContent = content.trim();
      // Remove markdown code blocks if present
      cleanContent = cleanContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      try {
        return JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('OpenAI: JSON parse error', parseError, 'Content:', cleanContent);
        throw new Error('Failed to parse OpenAI JSON response');
      }
    } else {
      throw new Error('No valid AI provider configured or API key missing');
    }
  } catch (error) {
    console.error('AI Model call failed:', error);
    throw error;
  }
}

serve(serve_handler);