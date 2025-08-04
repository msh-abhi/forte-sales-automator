import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface N8nWorkflowRequest {
  workflowId: string;
  triggerData: any;
  executionMode?: 'production' | 'test';
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { workflowId, triggerData, executionMode = 'production' }: N8nWorkflowRequest = await req.json();

    console.log(`Triggering n8n workflow: ${workflowId}`);

    const n8nApiKey = Deno.env.get('N8N_API_KEY');
    const n8nBaseUrl = Deno.env.get('N8N_BASE_URL') || 'http://localhost:5678';

    if (!n8nApiKey) {
      throw new Error('N8N_API_KEY environment variable is not set');
    }

    // Trigger n8n workflow via webhook
    const n8nWebhookUrl = `${n8nBaseUrl}/webhook/${workflowId}`;
    
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${n8nApiKey}`,
      },
      body: JSON.stringify({
        ...triggerData,
        execution_mode: executionMode,
        triggered_from: 'CRM System',
        timestamp: new Date().toISOString()
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`n8n workflow trigger failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    console.log(`n8n workflow ${workflowId} triggered successfully`);

    return new Response(JSON.stringify({
      success: true,
      workflow_id: workflowId,
      execution_id: result.executionId || 'unknown',
      message: 'Workflow triggered successfully',
      result: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in n8n-trigger function:', error);
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