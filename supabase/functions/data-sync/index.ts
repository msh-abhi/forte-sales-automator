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

interface DataSyncRequest {
  source: 'quickbooks' | 'mailchimp' | 'calendly' | 'stripe';
  action: 'sync_customers' | 'sync_contacts' | 'sync_events' | 'sync_payments';
  data?: any;
}

const serve_handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { source, action, data }: DataSyncRequest = await req.json();

    console.log(`Processing data sync: ${source} - ${action}`);

    let result;

    switch (source) {
      case 'quickbooks':
        result = await handleQuickBooksSync(action, data);
        break;
      case 'mailchimp':
        result = await handleMailchimpSync(action, data);
        break;
      case 'calendly':
        result = await handleCalendlySync(action, data);
        break;
      case 'stripe':
        result = await handleStripeSync(action, data);
        break;
      default:
        throw new Error(`Unsupported source: ${source}`);
    }

    return new Response(JSON.stringify({
      success: true,
      source: source,
      action: action,
      result: result
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in data-sync function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

async function handleQuickBooksSync(action: string, data: any) {
  console.log('Syncing with QuickBooks...');
  
  switch (action) {
    case 'sync_customers':
      return await syncQuickBooksCustomers();
    default:
      throw new Error(`Unsupported QuickBooks action: ${action}`);
  }
}

async function syncQuickBooksCustomers() {
  // Mock QuickBooks customer sync
  const mockCustomers = [
    {
      qb_customer_id: 'QB001',
      name: 'Lincoln High School',
      email: 'music@lincolnhs.edu',
      phone: '555-0101',
      address: '123 Education St, Music City, TN 37203'
    },
    {
      qb_customer_id: 'QB002',
      name: 'Jefferson Middle School',
      email: 'band@jeffersonms.edu',
      phone: '555-0102',
      address: '456 Learning Ave, Harmony, TX 75001'
    }
  ];

  // Update leads with QuickBooks customer IDs
  for (const customer of mockCustomers) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id')
      .eq('school_name', customer.name)
      .single();

    if (existingLead) {
      await supabase
        .from('leads')
        .update({ quickbooks_customer_id: customer.qb_customer_id })
        .eq('id', existingLead.id);
    }
  }

  return {
    customers_synced: mockCustomers.length,
    customers: mockCustomers
  };
}

async function handleMailchimpSync(action: string, data: any) {
  console.log('Syncing with Mailchimp...');
  
  const mailchimpApiKey = Deno.env.get('MAILCHIMP_API_KEY');
  const listId = Deno.env.get('MAILCHIMP_LIST_ID');

  if (!mailchimpApiKey || !listId) {
    throw new Error('Mailchimp API key or List ID not configured');
  }

  switch (action) {
    case 'sync_contacts':
      return await syncMailchimpContacts(mailchimpApiKey, listId);
    default:
      throw new Error(`Unsupported Mailchimp action: ${action}`);
  }
}

async function syncMailchimpContacts(apiKey: string, listId: string) {
  // Get all leads from database
  const { data: leads, error } = await supabase
    .from('leads')
    .select('*')
    .eq('status', 'Converted');

  if (error) throw error;

  // Mock Mailchimp API call
  const syncedContacts = leads?.map(lead => ({
    email: lead.director_email,
    firstName: lead.director_first_name,
    lastName: lead.director_last_name,
    school: lead.school_name,
    status: 'subscribed'
  })) || [];

  return {
    contacts_synced: syncedContacts.length,
    list_id: listId,
    contacts: syncedContacts
  };
}

async function handleCalendlySync(action: string, data: any) {
  console.log('Syncing with Calendly...');
  
  const calendlyToken = Deno.env.get('CALENDLY_TOKEN');

  if (!calendlyToken) {
    throw new Error('Calendly token not configured');
  }

  switch (action) {
    case 'sync_events':
      return await syncCalendlyEvents(calendlyToken);
    default:
      throw new Error(`Unsupported Calendly action: ${action}`);
  }
}

async function syncCalendlyEvents(token: string) {
  // Mock Calendly events
  const mockEvents = [
    {
      event_id: 'CAL001',
      event_type: 'consultation',
      start_time: '2024-01-20T14:00:00Z',
      end_time: '2024-01-20T15:00:00Z',
      attendee_email: 'music@lincolnhs.edu',
      status: 'scheduled'
    },
    {
      event_id: 'CAL002',
      event_type: 'demo',
      start_time: '2024-01-22T10:00:00Z',
      end_time: '2024-01-22T11:00:00Z',
      attendee_email: 'band@jeffersonms.edu',
      status: 'scheduled'
    }
  ];

  // Log events as communications
  for (const event of mockEvents) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('director_email', event.attendee_email)
      .single();

    if (lead) {
      await supabase
        .from('communication_history')
        .insert({
          lead_id: lead.id,
          communication_type: 'meeting',
          direction: 'scheduled',
          subject: `Calendly ${event.event_type} scheduled`,
          content: `Meeting scheduled for ${new Date(event.start_time).toLocaleString()}`,
          sent_at: new Date().toISOString(),
          metadata: {
            calendly_event_id: event.event_id,
            event_type: event.event_type,
            start_time: event.start_time,
            end_time: event.end_time
          }
        });
    }
  }

  return {
    events_synced: mockEvents.length,
    events: mockEvents
  };
}

async function handleStripeSync(action: string, data: any) {
  console.log('Syncing with Stripe...');
  
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeKey) {
    throw new Error('Stripe secret key not configured');
  }

  switch (action) {
    case 'sync_payments':
      return await syncStripePayments(stripeKey);
    default:
      throw new Error(`Unsupported Stripe action: ${action}`);
  }
}

async function syncStripePayments(apiKey: string) {
  // Mock Stripe payments
  const mockPayments = [
    {
      payment_id: 'pi_1234567890',
      amount: 2500,
      currency: 'usd',
      status: 'succeeded',
      customer_email: 'music@lincolnhs.edu',
      created: '2024-01-15T10:30:00Z',
      description: 'Music program consultation fee'
    },
    {
      payment_id: 'pi_0987654321',
      amount: 5000,
      currency: 'usd',
      status: 'succeeded',
      customer_email: 'band@jeffersonms.edu',
      created: '2024-01-18T14:45:00Z',
      description: 'Full music program package'
    }
  ];

  // Update leads with payment information
  for (const payment of mockPayments) {
    const { data: lead } = await supabase
      .from('leads')
      .select('id')
      .eq('director_email', payment.customer_email)
      .single();

    if (lead) {
      await supabase
        .from('leads')
        .update({
          payment_date: payment.created,
          status: 'Converted'
        })
        .eq('id', lead.id);

      // Log payment as communication
      await supabase
        .from('communication_history')
        .insert({
          lead_id: lead.id,
          communication_type: 'payment',
          direction: 'inbound',
          subject: 'Payment received',
          content: `Payment of $${payment.amount / 100} received via Stripe`,
          sent_at: payment.created,
          metadata: {
            stripe_payment_id: payment.payment_id,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status
          }
        });
    }
  }

  return {
    payments_synced: mockPayments.length,
    total_amount: mockPayments.reduce((sum, p) => sum + p.amount, 0),
    payments: mockPayments
  };
}

serve(serve_handler);