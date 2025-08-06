import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  content: string;
  type: 'follow_up' | 'quote' | 'custom';
  leadId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, content, type, leadId }: EmailRequest = await req.json();

    if (!to || !subject || !content) {
      throw new Error("Missing required fields: to, subject, content");
    }

    console.log(`Sending ${type} email to ${to}`);

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "CRM System <noreply@resend.dev>";
    
    const emailResponse = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
            <h2 style="color: #333; margin-bottom: 20px;">${subject}</h2>
            <div style="background-color: white; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
              ${content.replace(/\n/g, '<br>')}
            </div>
            <div style="text-align: center; color: #666; font-size: 14px;">
              <p>Best regards,<br>Your CRM Team</p>
            </div>
          </div>
        </div>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    // If leadId is provided, we could log this communication to the database
    if (leadId) {
      console.log(`Email communication logged for lead: ${leadId}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messageId: emailResponse.data?.id 
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);