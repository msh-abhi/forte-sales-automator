import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailGenerationRequest {
  leadData: {
    director_first_name: string;
    director_last_name: string;
    school_name?: string;
    ensemble_program_name?: string;
    estimated_performers?: number;
    season?: string;
    status: string;
  };
  emailType: 'initial_outreach' | 'follow_up' | 'quote_follow_up' | 'thank_you' | 'custom';
  customPrompt?: string;
  tone?: 'professional' | 'friendly' | 'urgent';
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadData, emailType, customPrompt, tone = 'professional' }: EmailGenerationRequest = await req.json();

    if (!leadData) {
      throw new Error('Lead data is required');
    }

    console.log(`Generating ${emailType} email for ${leadData.director_first_name} ${leadData.director_last_name}`);

    // Create context-aware prompt based on email type and lead data
    let systemPrompt = `You are an expert email writer for a music education services company. Generate professional, personalized emails for band directors and music educators.

Lead Information:
- Name: ${leadData.director_first_name} ${leadData.director_last_name}
- School: ${leadData.school_name || 'N/A'}
- Program: ${leadData.ensemble_program_name || 'N/A'}
- Performers: ${leadData.estimated_performers || 'N/A'}
- Season: ${leadData.season || 'N/A'}
- Current Status: ${leadData.status}

Tone: ${tone}
Email Type: ${emailType}

Generate an email that is:
- Personalized to the recipient and their program
- Professional but warm
- Clear and concise
- Action-oriented
- Appropriate for the email type and current lead status`;

    let userPrompt = '';

    switch (emailType) {
      case 'initial_outreach':
        userPrompt = `Write an initial outreach email introducing our music education services. Focus on:
- Brief introduction of our company
- How we can help their music program
- Request for a brief call or meeting
- Professional but engaging tone`;
        break;
      case 'follow_up':
        userPrompt = `Write a follow-up email for someone we've already contacted. Focus on:
- Reference previous communication
- Add value with new information or insights
- Gentle reminder about our services
- Clear next steps`;
        break;
      case 'quote_follow_up':
        userPrompt = `Write a follow-up email for someone who received a quote. Focus on:
- Reference the previously sent quote
- Address potential concerns or questions
- Highlight value and benefits
- Create urgency (if appropriate)
- Clear call to action`;
        break;
      case 'thank_you':
        userPrompt = `Write a thank you email for someone who has engaged with us. Focus on:
- Express genuine gratitude
- Summarize next steps
- Provide additional resources if helpful
- Maintain the relationship`;
        break;
      case 'custom':
        userPrompt = customPrompt || 'Write a professional email based on the lead information provided.';
        break;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    const generatedEmail = data.choices[0].message.content;

    // Extract subject and body from the generated email
    const lines = generatedEmail.split('\n').filter(line => line.trim());
    let subject = '';
    let body = '';

    // Look for subject line (often starts with "Subject:" or is the first line)
    const subjectIndex = lines.findIndex(line => 
      line.toLowerCase().includes('subject:') || 
      line.toLowerCase().includes('re:') ||
      line.toLowerCase().includes('partnership') ||
      line.toLowerCase().includes('follow-up') ||
      line.toLowerCase().includes('music')
    );

    if (subjectIndex !== -1) {
      subject = lines[subjectIndex].replace(/^subject:\s*/i, '').trim();
      body = lines.slice(subjectIndex + 1).join('\n').trim();
    } else if (lines.length > 0) {
      // Use first line as subject if no clear subject found
      subject = lines[0].trim();
      body = lines.slice(1).join('\n').trim();
    }

    // Fallback subject generation
    if (!subject) {
      switch (emailType) {
        case 'initial_outreach':
          subject = `Partnership Opportunity for ${leadData.school_name || 'Your Music Program'}`;
          break;
        case 'follow_up':
          subject = `Following up on our conversation`;
          break;
        case 'quote_follow_up':
          subject = `Your music program quote - next steps`;
          break;
        case 'thank_you':
          subject = `Thank you for your interest`;
          break;
        default:
          subject = `Music Program Services for ${leadData.school_name || 'Your School'}`;
      }
    }

    console.log('Email generated successfully');

    return new Response(JSON.stringify({
      subject: subject,
      body: body || generatedEmail,
      emailType: emailType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-email-generator function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(serve_handler);