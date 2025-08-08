-- Create leads table with all required columns
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  director_first_name TEXT NOT NULL,
  director_last_name TEXT NOT NULL,
  director_email TEXT NOT NULL UNIQUE,
  director_phone_number TEXT,
  ensemble_program_name TEXT,
  estimated_performers INTEGER,
  season TEXT,
  form_submission_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  early_bird_deadline TEXT,
  standard_rate_sr NUMERIC,
  discount_rate_dr NUMERIC,
  savings NUMERIC,
  status TEXT NOT NULL DEFAULT 'New Lead',
  quote_sent_date TIMESTAMP WITH TIME ZONE,
  last_email_sent_type TEXT,
  last_sms_sent_type TEXT,
  reply_detected BOOLEAN NOT NULL DEFAULT FALSE,
  last_reply_content TEXT,
  invoice_status TEXT,
  payment_date TIMESTAMP WITH TIME ZONE,
  raw_submission_data JSONB,
  last_communication_date TIMESTAMP WITH TIME ZONE,
  follow_up_count INTEGER NOT NULL DEFAULT 0,
  quickbooks_customer_id TEXT,
  workout_program_name TEXT,
  school_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create communication history table for tracking all email/SMS interactions
CREATE TABLE public.communication_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- 'email' or 'sms'
  direction TEXT NOT NULL, -- 'outbound' or 'inbound'
  subject TEXT,
  content TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  external_id TEXT, -- For tracking Gmail message IDs or Twilio SIDs
  metadata JSONB -- For storing additional data like recipient, sender, etc.
);

-- Create user profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for leads table
CREATE POLICY "Authenticated users can view all leads" 
ON public.leads 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert leads" 
ON public.leads 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update leads" 
ON public.leads 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete leads" 
ON public.leads 
FOR DELETE 
TO authenticated
USING (true);

-- Create RLS policies for communication_history table
CREATE POLICY "Authenticated users can view all communication history" 
ON public.communication_history 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert communication history" 
ON public.communication_history 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update communication history" 
ON public.communication_history 
FOR UPDATE 
TO authenticated
USING (true);

-- Create RLS policies for profiles table
CREATE POLICY "Users can view all profiles" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create function to automatically update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for better performance
CREATE INDEX idx_leads_email ON public.leads(director_email);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_last_communication_date ON public.leads(last_communication_date);
CREATE INDEX idx_communication_history_lead_id ON public.communication_history(lead_id);
CREATE INDEX idx_communication_history_sent_at ON public.communication_history(sent_at);