
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

    if (analysisResult.purchaseIntent && analysisResult.intentType === 'ready_to_purchase') {
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

    } else if (analysisResult.purchaseIntent && analysisResult.intentType === 'negotiating') {
      console.log('Negotiation detected for lead:', lead.id);
      
      // Send negotiation response
      const emailResponse = await supabase.functions.invoke('send-email', {
        body: {
          to: lead.director_email,
          subject: `Re: ${replySubject || 'Your inquiry'}`,
          content: analysisResult.suggestedResponse,
          leadId: lead.id,
          type: 'negotiation_response'
        }
      });

      const smsResponse = await supabase.functions.invoke('send-sms', {
        body: {
          to: lead.director_phone_number,
          message: 'We\'ve replied to your email regarding pricing. Please check your inbox!',
          leadId: lead.id,
          type: 'negotiation_notification'
        }
      });

      // Update lead status
      await supabase
        .from('leads')
        .update({
          status: 'Negotiating - Awaiting Response',
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
      intentType: analysisResult.intentType,
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

  // More nuanced and detailed prompt for better intent classification
  const prompt = `Analyze this customer reply and respond with JSON only:

Customer: ${leadData.director_first_name} ${leadData.director_last_name}
Reply: "${replyContent}"

Classify the intent more precisely:

READY TO PURCHASE (purchaseIntent: true, intentType: "ready_to_purchase"):
- Explicitly confirms they want to proceed/buy/move forward
- Says "yes, let's do it" or "we're ready to order"
- Asks for payment instructions or how to pay
- Requests invoice to be sent
- Confirms purchase details without asking for changes

NEGOTIATING (purchaseIntent: true, intentType: "negotiating"):
- Asks for discounts, better pricing, or price reductions
- Wants to modify terms, quantities, or packages
- Says "can you do better on price?" or similar
- Interested but needs budget approval
- Comparing with other vendors

GENERAL INQUIRY (purchaseIntent: false, intentType: "inquiry"):
- Just asking questions about the service/product
- Requesting more information
- Clarifying details without purchase commitment
- General interest without clear buying signals

NOT INTERESTED (purchaseIntent: false, intentType: "not_interested"):
- Explicitly declines or says no
- Not a good fit or timing
- Already found another solution

Return JSON:
{
  "purchaseIntent": boolean,
  "intentType": "ready_to_purchase" | "negotiating" | "inquiry" | "not_interested",
  "primaryConcern": "brief description",
  "suggestedResponse": "professional response appropriate for intent type",
  "confidence": 0.8
}`;

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
      intentType: "inquiry",
      primaryConcern: "Unable to analyze - using fallback",
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
            maxOutputTokens: 2000, // Increased from 1000
            topP: 0.8,
            topK: 40
          }
        }),
      });

      if (!response.ok) {
        console.error(`Gemini API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('Gemini error details:', errorText);
        throw new Error(`Gemini API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Gemini API Response:', JSON.stringify(data, null, 2));

      // Check if response structure is valid
      if (!data || !data.candidates || !Array.isArray(data.candidates) || data.candidates.length === 0) {
        console.error('Gemini: Missing/empty candidates array', JSON.stringify(data, null, 2));
        throw new Error('Invalid Gemini response structure - no candidates');
      }

      const candidate = data.candidates[0];
      
      // Check for MAX_TOKENS finish reason
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.error('Gemini: Response truncated due to MAX_TOKENS', JSON.stringify(candidate, null, 2));
        throw new Error('Gemini response truncated - increase maxOutputTokens');
      }

      // Check for other problematic finish reasons
      if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        console.error(`Gemini: Unexpected finish reason: ${candidate.finishReason}`, JSON.stringify(candidate, null, 2));
        throw new Error(`Gemini response incomplete: ${candidate.finishReason}`);
      }

      if (!candidate || !candidate.content || !candidate.content.parts || !Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
        console.error('Gemini: Missing/empty candidate content', JSON.stringify(candidate, null, 2));
        throw new Error('Invalid Gemini candidate structure - no content parts');
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
        const parsedResult = JSON.parse(cleanContent);
        
        // Validate the structure
        if (!parsedResult.hasOwnProperty('purchaseIntent') || 
            !parsedResult.hasOwnProperty('suggestedResponse')) {
          console.error('Gemini: Invalid JSON structure', parsedResult);
          throw new Error('Invalid JSON structure from Gemini');
        }
        
        return parsedResult;
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
          max_tokens: 1500, // Increased from 1000
        }),
      });

      if (!response.ok) {
        console.error(`OpenAI API error: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('OpenAI error details:', errorText);
        throw new Error(`OpenAI API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('OpenAI API Response:', JSON.stringify(data, null, 2));

      // Check if response structure is valid
      if (!data || !data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
        console.error('OpenAI: Missing/empty choices array', JSON.stringify(data, null, 2));
        throw new Error('Invalid OpenAI response structure - no choices');
      }

      const choice = data.choices[0];
      
      // Check for length finish reason
      if (choice.finish_reason === 'length') {
        console.error('OpenAI: Response truncated due to length limit', JSON.stringify(choice, null, 2));
        throw new Error('OpenAI response truncated - increase max_tokens');
      }

      if (!choice || !choice.message || !choice.message.content) {
        console.error('OpenAI: Missing/empty choice content', JSON.stringify(choice, null, 2));
        throw new Error('Invalid OpenAI choice structure - no message content');
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
        const parsedResult = JSON.parse(cleanContent);
        
        // Validate the structure
        if (!parsedResult.hasOwnProperty('purchaseIntent') || 
            !parsedResult.hasOwnProperty('suggestedResponse')) {
          console.error('OpenAI: Invalid JSON structure', parsedResult);
          throw new Error('Invalid JSON structure from OpenAI');
        }
        
        return parsedResult;
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
