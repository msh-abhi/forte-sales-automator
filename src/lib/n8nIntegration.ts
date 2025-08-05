// N8N Integration Helper Functions
// These functions handle communication with n8n workflows

const N8N_BASE_URL = 'https://n8n.tecnomaxx.com'; // Replace with actual n8n URL

export interface N8nWebhookResponse {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Send lead data to n8n for processing through the lead ingestion webhook
 */
export const triggerLeadIngestion = async (leadData: any): Promise<N8nWebhookResponse> => {
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/lead-ingestion-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadData,
        source: 'frontend_manual',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error triggering lead ingestion:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

/**
 * Trigger manual conversion workflow in n8n
 */
export const triggerManualConversion = async (leadId: string): Promise<N8nWebhookResponse> => {
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/manual-convert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId,
        action: 'manual_conversion',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error triggering manual conversion:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

/**
 * Trigger resend communication workflow in n8n
 */
export const triggerResendCommunication = async (leadId: string): Promise<N8nWebhookResponse> => {
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/resend-communication`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        leadId,
        action: 'resend_last_communication',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error triggering resend communication:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    };
  }
};

/**
 * Test n8n webhook connectivity
 */
export const testN8nConnection = async (): Promise<N8nWebhookResponse> => {
  try {
    const response = await fetch(`${N8N_BASE_URL}/webhook/health-check`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('Error testing n8n connection:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'N8N connection failed' 
    };
  }
};
