import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const quickbooksClientId = Deno.env.get('QUICKBOOKS_CLIENT_ID');
const quickbooksClientSecret = Deno.env.get('QUICKBOOKS_CLIENT_SECRET');
const quickbooksAccessToken = Deno.env.get('QUICKBOOKS_ACCESS_TOKEN');
const quickbooksRealmId = Deno.env.get('QUICKBOOKS_REALM_ID');
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
    
    console.log('Converting lead to customer:', leadId);

    if (!quickbooksAccessToken || !quickbooksRealmId) {
      console.log('QuickBooks credentials not configured, skipping conversion');
      return new Response(JSON.stringify({
        success: false,
        error: 'QuickBooks credentials not configured'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let customerId = leadData.quickbooks_customer_id;

    // Create or get customer in QuickBooks
    if (!customerId) {
      customerId = await createQuickBooksCustomer(leadData);
      
      // Update lead with QuickBooks customer ID
      await supabase
        .from('leads')
        .update({ quickbooks_customer_id: customerId })
        .eq('id', leadId);
    }

    // Create invoice in QuickBooks
    const invoiceResult = await createQuickBooksInvoice(leadData, customerId);

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

    // Send SMS notification
    await supabase.functions.invoke('send-sms', {
      body: {
        to: leadData.director_phone_number,
        message: `Great news! Your invoice has been sent. Check your email for details. Total: $${invoiceResult.totalAmount}`,
        leadId: leadId,
        type: 'invoice_sms'
      }
    });

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

async function createQuickBooksCustomer(leadData: any): Promise<string> {
  const customerData = {
    Name: `${leadData.director_first_name} ${leadData.director_last_name}`,
    CompanyName: leadData.school_name || leadData.ensemble_program_name,
    PrimaryEmailAddr: {
      Address: leadData.director_email
    },
    PrimaryPhone: {
      FreeFormNumber: leadData.director_phone_number
    }
  };

  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${quickbooksRealmId}/customer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${quickbooksAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(customerData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks customer creation error:', errorText);
    throw new Error(`Failed to create QuickBooks customer: ${response.statusText}`);
  }

  const result = await response.json();
  return result.QueryResponse.Customer[0].Id;
}

async function createQuickBooksInvoice(leadData: any, customerId: string): Promise<any> {
  const amount = leadData.discount_rate_dr || leadData.standard_rate_sr || 500;
  
  const invoiceData = {
    CustomerRef: {
      value: customerId
    },
    Line: [{
      Amount: amount,
      DetailType: "SalesItemLineDetail",
      SalesItemLineDetail: {
        ItemRef: {
          value: "1", // Default service item
          name: "Services"
        },
        Qty: 1,
        UnitPrice: amount
      },
      Description: `Music Education Equipment - ${leadData.workout_program_name || leadData.ensemble_program_name || 'Program'}`
    }],
    TotalAmt: amount
  };

  const response = await fetch(`https://sandbox-quickbooks.api.intuit.com/v3/company/${quickbooksRealmId}/invoice`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${quickbooksAccessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(invoiceData)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('QuickBooks invoice creation error:', errorText);
    throw new Error(`Failed to create QuickBooks invoice: ${response.statusText}`);
  }

  const result = await response.json();
  const invoice = result.QueryResponse.Invoice[0];
  
  return {
    invoiceId: invoice.Id,
    totalAmount: invoice.TotalAmt
  };
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