-- Create zapier_integrations table
CREATE TABLE public.zapier_integrations (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    webhook_url text NOT NULL,
    trigger_type text NOT NULL CHECK (trigger_type IN ('new_lead', 'lead_updated', 'email_sent', 'custom')),
    status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
    last_triggered timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create webhook_logs table
CREATE TABLE public.webhook_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type text NOT NULL,
    lead_id uuid,
    payload jsonb,
    results jsonb,
    executed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create n8n_workflows table
CREATE TABLE public.n8n_workflows (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workflow_id text NOT NULL UNIQUE,
    name text NOT NULL,
    description text,
    webhook_url text,
    status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
    triggers text[],
    actions text[],
    last_run timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.zapier_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.n8n_workflows ENABLE ROW LEVEL SECURITY;

-- Create policies for zapier_integrations
CREATE POLICY "Authenticated users can view all zapier integrations" 
ON public.zapier_integrations 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert zapier integrations" 
ON public.zapier_integrations 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update zapier integrations" 
ON public.zapier_integrations 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete zapier integrations" 
ON public.zapier_integrations 
FOR DELETE 
USING (true);

-- Create policies for webhook_logs
CREATE POLICY "Authenticated users can view webhook logs" 
ON public.webhook_logs 
FOR SELECT 
USING (true);

CREATE POLICY "System can insert webhook logs" 
ON public.webhook_logs 
FOR INSERT 
WITH CHECK (true);

-- Create policies for n8n_workflows
CREATE POLICY "Authenticated users can view n8n workflows" 
ON public.n8n_workflows 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage n8n workflows" 
ON public.n8n_workflows 
FOR ALL 
USING (true);

-- Create trigger for auto-updating timestamps
CREATE TRIGGER update_zapier_integrations_updated_at
BEFORE UPDATE ON public.zapier_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_n8n_workflows_updated_at
BEFORE UPDATE ON public.n8n_workflows
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();