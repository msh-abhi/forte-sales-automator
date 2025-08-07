
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

interface ConversionRequest {
  leadId: string;
  leadData: any;
}

  const serve_handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leadId, leadData }: ConversionRequest = await req.json();
    
    console.log('Starting QuickBooks conversion for lead:', leadId);

    // Get QuickBooks tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('quickbooks_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError || !tokenData) {
      console.log('QuickBooks not connected, skipping conversion');
      return new Response(JSON.stringify({
        success: false,
        error: 'QuickBooks not connected. Please complete OAuth setup first.'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if token is expired and refresh if needed
    const currentToken = await ensureValidToken(tokenData);

    let customerId = leadData.quickbooks_customer_id;

    // Create or get customer in QuickBooks if needed
    if (!customerId) {
      try {
        customerId = await createQuickBooksCustomer(leadData, currentToken, tokenData.realm_id);
        console.log('Created new QuickBooks customer:', customerId);
        
        // Update lead with QuickBooks customer ID
        const { error: updateError } = await supabase
          .from('leads')
          .update({ quickbooks_customer_id: customerId })
          .eq('id', leadId);
          
        if (updateError) {
          console.error('Failed to update lead with customer ID:', updateError);
        } else {
          console.log('Stored QuickBooks Customer ID in Supabase for lead:', leadId);
        }
      } catch (customerError: any) {
        console.error('Customer creation failed. Attempting to search and update...', customerError);
        
        // If customer creation fails due to duplicate, try to find existing customer
        if (customerError.message.includes('Duplicate Name')) {
          try {
            customerId = await findExistingCustomer(leadData, currentToken, tokenData.realm_id);
            console.log('Found existing QuickBooks customer:', customerId);
            
            // Update lead with found customer ID
            await supabase
              .from('leads')
              .update({ quickbooks_customer_id: customerId })
              .eq('id', leadId);
          } catch (searchError: any) {
            console.error('Customer search also failed:', searchError);
            throw new Error(`QuickBooks customer search failed: ${searchError.message}`);
          }
        } else {
          throw customerError;
        }
      }
    } else {
      console.log('Using existing QuickBooks customer ID:', customerId);
    }

    // Create invoice in QuickBooks
    const invoiceResult = await createQuickBooksInvoice(leadData, customerId, currentToken, tokenData.realm_id);

    // Update lead status
    await supabase
      .from('leads')
      .update({
        status: 'Invoice Sent',
        invoice_status: 'sent',
        payment_date: null
      })
      .eq('id', leadId);

    // Send invoice notification email
    const emailContent = generateInvoiceEmail(leadData, invoiceResult);
    await supabase.functions.invoke('send-email', {
      body: {
        to: leadData.director_email,
        subject: 'Invoice for Your Music Program Equipment',
        content: emailContent,
        leadId: leadId,
        type: 'invoice_notification'
      }
    });

    // Send SMS notification if phone number exists
    if (leadData.director_phone_number) {
      await supabase.functions.invoke('send-sms', {
        body: {
          to: leadData.director_phone_number,
          message: `Great news! Your invoice has been sent. Check your email for details. Total: $${invoiceResult.totalAmount}`,
          leadId: leadId,
          type: 'invoice_sms'
        }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      leadId,
      customerId,
      invoiceId: invoiceResult.invoiceId,
      totalAmount: invoiceResult.totalAmount
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in quickbooks-conversion function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function ensureValidToken(tokenData: any): Promise<string> {
  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);

  // If token expires within 5 minutes, refresh it
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log('Token expiring soon, refreshing...');
    return await refreshAccessToken(tokenData);
  }

  return tokenData.access_token;
}

async function refreshAccessToken(tokenData: any): Promise<string> {
  const refreshUrl = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
  const quickbooksClientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
  const quickbooksClientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
  
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenData.refresh_token
  });

  const response = await fetch(refreshUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${btoa(`${quickbooksClientId}:${quickbooksClientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json'
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to refresh QuickBooks token');
  }

  const newTokenData = await response.json();

  // Update stored token
  await supabase
    .from('quickbooks_tokens')
    .update({
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token || tokenData.refresh_token,
      expires_at: new Date(Date.now() + (newTokenData.expires_in * 1000)).toISOString(),
    })
    .eq('realm_id', tokenData.realm_id);

  return newTokenData.access_token;
}

async function createQuickBooksCustomer(leadData: any, accessToken: string, realmId: string): Promise<string> {
  const customerData = {
    Name: `${leadData.director_first_name} ${leadData.director_last_name}`,
    CompanyName: leadData.school_name || leadData.ensemble_program_name,
    PrimaryEmailAddr: {
      Address: leadData.director_email
    }
  };

  // Only add phone if it exists
  if (leadData.director_phone_number) {
    customerData.PrimaryPhone = {
      FreeFormNumber: leadData.director_phone_number
    };
  }

  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/customer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks customer creation error:', errorText);
    throw new Error(`Failed to create QuickBooks customer: ${response.statusText}. Details: ${errorText}`);
  }

  const result = await response.json();
  
  // Handle both creation response and error response structures
  if (result.QueryResponse && result.QueryResponse.Customer && result.QueryResponse.Customer[0]) {
    return result.QueryResponse.Customer[0].Id;
  } else if (result.Customer && result.Customer.Id) {
    return result.Customer.Id;
  } else {
    console.error('QuickBooks create customer response was missing Customer.Id:', JSON.stringify(result, null, 2));
    throw new Error('QuickBooks API returned an invalid response for customer creation.');
  }
}

async function findExistingCustomer(leadData: any, accessToken: string, realmId: string): Promise<string> {
  const customerName = `${leadData.director_first_name} ${leadData.director_last_name}`;
  const query = `SELECT * FROM Customer WHERE Name = '${customerName}'`;
  
  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks customer search error:', errorText);
    throw new Error(`QuickBooks customer search failed: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.QueryResponse && result.QueryResponse.Customer && result.QueryResponse.Customer.length > 0) {
    return result.QueryResponse.Customer[0].Id;
  } else {
    throw new Error('No existing customer found with matching name');
  }
}

async function createQuickBooksInvoice(leadData: any, customerId: string, accessToken: string, realmId: string): Promise<any> {
  const amount = leadData.discount_rate_dr || leadData.standard_rate_sr || 500;
  
  // First, get or create a service item
  const serviceItemId = await getOrCreateServiceItem(accessToken, realmId);
  
  // Get the default tax code (NON for non-taxable in most regions)
  const taxCodeRef = await getDefaultTaxCode(accessToken, realmId);
  
  const invoiceData = {
    CustomerRef: {
      value: customerId
    },
    Line: [{
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: serviceItemId
        },
        Qty: 1,
        UnitPrice: amount,
        TaxCodeRef: taxCodeRef
      },
      Description: `Music Education Equipment - ${leadData.workout_program_name || leadData.ensemble_program_name || 'Program'}`
    }],
    TotalAmt: amount
  };

  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(invoiceData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks invoice creation error:', errorText);
    throw new Error(`Failed to create QuickBooks invoice: ${response.statusText}. Details: ${errorText}`);
  }

  const result = await response.json();
  
  // Handle both creation response structures
  let invoice;
  if (result.QueryResponse && result.QueryResponse.Invoice && result.QueryResponse.Invoice[0]) {
    invoice = result.QueryResponse.Invoice[0];
  } else if (result.Invoice) {
    invoice = result.Invoice;
  } else {
    console.error('QuickBooks invoice creation response:', JSON.stringify(result, null, 2));
    throw new Error('QuickBooks API returned an invalid response for invoice creation.');
  }
  
  return {
    invoiceId: invoice.Id,
    totalAmount: invoice.TotalAmt
  };
}

async function getOrCreateServiceItem(accessToken: string, realmId: string): Promise<string> {
  // First, try to find an existing service item
  const query = "SELECT * FROM Item WHERE Type = 'Service' AND Active = true";
  
  const searchResponse = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (searchResponse.ok) {
    const searchResult = await searchResponse.json();
    if (searchResult.QueryResponse && searchResult.QueryResponse.Item && searchResult.QueryResponse.Item.length > 0) {
      return searchResult.QueryResponse.Item[0].Id;
    }
  }

  // If no service item found, create one
  const itemData = {
    Name: "Music Education Services",
    Type: "Service",
    IncomeAccountRef: {
      value: "1" // Default income account - this might need to be adjusted
    }
  };

  const createResponse = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/item`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(itemData)
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error('QuickBooks service item creation error:', errorText);
    // Fall back to default service item ID that usually exists in sandbox
    return "1";
  }

  const createResult = await createResponse.json();
  if (createResult.QueryResponse && createResult.QueryResponse.Item && createResult.QueryResponse.Item[0]) {
    return createResult.QueryResponse.Item[0].Id;
  } else if (createResult.Item) {
    return createResult.Item.Id;
  }
  
  // Ultimate fallback
  return "1";
}

async function getDefaultTaxCode(accessToken: string, realmId: string): Promise<any> {
  // Try to find a non-taxable tax code first
  const query = "SELECT * FROM TaxCode WHERE Name = 'NON' OR Name = 'Non-Taxable' OR Name = 'Out of scope'";
  
  const searchResponse = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(query)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (searchResponse.ok) {
    const searchResult = await searchResponse.json();
    if (searchResult.QueryResponse && searchResult.QueryResponse.TaxCode && searchResult.QueryResponse.TaxCode.length > 0) {
      return { value: searchResult.QueryResponse.TaxCode[0].Id };
    }
  }

  // If no specific tax code found, try to get any available tax code
  const fallbackQuery = "SELECT * FROM TaxCode WHERE Active = true";
  
  const fallbackResponse = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}/query?query=${encodeURIComponent(fallbackQuery)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json'
    }
  });

  if (fallbackResponse.ok) {
    const fallbackResult = await fallbackResponse.json();
    if (fallbackResult.QueryResponse && fallbackResult.QueryResponse.TaxCode && fallbackResult.QueryResponse.TaxCode.length > 0) {
      return { value: fallbackResult.QueryResponse.TaxCode[0].Id };
    }
  }

  // Final fallback - use a commonly available tax code ID
  console.log('Using fallback tax code');
  return { value: "NON" };
}

function generateInvoiceEmail(leadData: any, invoiceResult: any): string {
  return `
Dear ${leadData.director_first_name},

Great news! We're excited to move forward with your music education equipment order.

Your invoice has been generated and is ready for payment:
- Invoice Amount: $${invoiceResult.totalAmount}
- Program: ${leadData.workout_program_name || leadData.ensemble_program_name || 'Music Education Program'}
- Estimated Performers: ${leadData.estimated_performers || 'Not specified'}

You should receive the invoice shortly via QuickBooks. Please process payment at your earliest convenience to ensure timely delivery.

If you have any questions about the invoice or payment process, please don't hesitate to reach out.

Thank you for choosing us for your music education needs!

Best regards,
The Forte Athletics Team
`;
}

serve(serve_handler);
