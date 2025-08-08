-- Add missing field for AI suggested messages
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS ai_suggested_message TEXT;

-- Add indexes for better performance on frequently queried fields
CREATE INDEX IF NOT EXISTS idx_leads_reply_detected ON public.leads(reply_detected);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_last_communication_date ON public.leads(last_communication_date);
CREATE INDEX IF NOT EXISTS idx_leads_director_email ON public.leads(director_email);

-- Add table for storing AI model configurations
CREATE TABLE public.ai_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL, -- 'gemini', 'openai', etc.
  model_id TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  api_endpoint TEXT,
  configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on ai_models
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

-- Create policies for ai_models
CREATE POLICY "Authenticated users can view AI models" 
ON public.ai_models 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage AI models" 
ON public.ai_models 
FOR ALL 
USING (true);

-- Add trigger for ai_models updated_at
CREATE TRIGGER update_ai_models_updated_at
BEFORE UPDATE ON public.ai_models
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add table for follow-up templates
CREATE TABLE public.follow_up_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_number INTEGER NOT NULL,
  name TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  email_body TEXT NOT NULL,
  sms_message TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on follow_up_templates
ALTER TABLE public.follow_up_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for follow_up_templates
CREATE POLICY "Authenticated users can view follow-up templates" 
ON public.follow_up_templates 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can manage follow-up templates" 
ON public.follow_up_templates 
FOR ALL 
USING (true);

-- Add trigger for follow_up_templates updated_at
CREATE TRIGGER update_follow_up_templates_updated_at
BEFORE UPDATE ON public.follow_up_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default follow-up templates
INSERT INTO public.follow_up_templates (sequence_number, name, email_subject, email_body, sms_message) VALUES
(1, 'First Follow-up', 'Following up on your quote request', 'Hi {director_first_name}, I wanted to follow up on the quote we sent for your {workout_program_name}. Do you have any questions?', 'Hi {director_first_name}, just following up on your quote. Any questions?'),
(2, 'Second Follow-up', 'Still interested in {workout_program_name}?', 'Hi {director_first_name}, I hope you''re doing well. I wanted to check if you''re still interested in our {workout_program_name} program.', 'Hi {director_first_name}, still interested in {workout_program_name}? Let us know!'),
(3, 'Third Follow-up', 'Last chance for early bird pricing', 'Hi {director_first_name}, this is our final follow-up regarding {workout_program_name}. Don''t miss out on our early bird pricing!', 'Final reminder about {workout_program_name} early bird pricing!'),
(4, 'Final Follow-up', 'We''re here when you''re ready', 'Hi {director_first_name}, we understand timing might not be right now for {workout_program_name}. We''ll be here when you''re ready!', 'We''re here when you''re ready for {workout_program_name}!');

-- Insert default AI model configurations
INSERT INTO public.ai_models (name, provider, model_id, is_primary, is_fallback, configuration) VALUES
('Gemini Pro', 'gemini', 'gemini-pro', true, false, '{"temperature": 0.7, "max_tokens": 1000}'),
('OpenAI GPT-4', 'openai', 'gpt-4o-mini', false, true, '{"temperature": 0.7, "max_tokens": 1000}');