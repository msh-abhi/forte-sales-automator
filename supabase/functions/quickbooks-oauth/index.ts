
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const quickbooksClientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
const quickbooksClientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
const quickbooksRedirectUrl = Deno.env.get('QUICKBOOKS_REDIRECT_URL');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OAuthRequest {
  action: 'initiate' | 'callback';
  code?: string;
  realmId?: string;
  state?: string;
}

const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, code, realmId, state }: OAuthRequest = await req.json();

    if (action === 'initiate') {
      // Generate OAuth URL for QuickBooks
      const authUrl = generateQuickBooksAuthUrl();
      
      return new Response(JSON.stringify({
        success: true,
        authUrl
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'callback') {
      // Handle OAuth callback and exchange code for tokens
      const tokenData = await exchangeCodeForTokens(code!, realmId!);
      
      // Store tokens securely (you might want to encrypt these)
      await supabase
        .from('quickbooks_tokens')
        .upsert({
          realm_id: realmId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString(),
          created_at: new Date().toISOString()
        });

      return new Response(JSON.stringify({
        success: true,
        message: 'QuickBooks integration completed successfully',
        realmId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: any) {
    console.error('Error in quickbooks-oauth function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

function generateQuickBooksAuthUrl(): string {
  const baseUrl = 'https://appcenter.intuit.com/connect/oauth2';
  const params = new URLSearchParams({
    client_id: quickbooksClientId!,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: quickbooksRedirectUrl!,
    response_type: 'code',
    access_type: 'offline',
    state: crypto.randomUUID() // Generate random state for security
  });

  return `${baseUrl}?${params.toString()}`;
}

async function exchangeCodeForTokens(code: string, realmId: string): Promise<any> {
  const tokenUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: quickbooksRedirectUrl!
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${quickbooksClientId}:${quickbooksClientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks token exchange error:', errorText);
    throw new Error(`Failed to exchange code for tokens: ${response.statusText}`);
  }

  return await response.json();
}

serve(serve_handler);
