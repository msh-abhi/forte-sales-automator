import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Mail, Send, Wand2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailComposerProps {
  leadData?: {
    id: string;
    director_first_name: string;
    director_last_name: string;
    director_email: string;
    school_name?: string;
    ensemble_program_name?: string;
    estimated_performers?: number;
    season?: string;
    status: string;
  };
  onClose?: () => void;
}

const EmailComposer = ({ leadData, onClose }: EmailComposerProps) => {
  const { toast } = useToast();
  const [emailData, setEmailData] = useState({
    to: leadData?.director_email || '',
    subject: '',
    content: '',
    type: 'custom' as 'initial_outreach' | 'follow_up' | 'quote_follow_up' | 'thank_you' | 'custom'
  });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const emailTemplates = [
    { value: 'initial_outreach', label: 'Initial Outreach', description: 'First contact with a new lead' },
    { value: 'follow_up', label: 'Follow Up', description: 'General follow-up communication' },
    { value: 'quote_follow_up', label: 'Quote Follow Up', description: 'Following up on a sent quote' },
    { value: 'thank_you', label: 'Thank You', description: 'Thank you and appreciation email' },
    { value: 'custom', label: 'Custom', description: 'Write your own email content' }
  ];

  const generateEmail = async () => {
    if (!leadData) {
      toast({
        title: "Error",
        description: "Lead data is required for AI email generation",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    try {
      const response = await supabase.functions.invoke('ai-email-generator', {
        body: {
          leadData: leadData,
          emailType: emailData.type,
          tone: 'professional'
        }
      });

      if (response.error) throw response.error;

      const { subject, body } = response.data;
      setEmailData(prev => ({
        ...prev,
        subject: subject || '',
        content: body || ''
      }));

      toast({
        title: "Success",
        description: "Email generated successfully",
      });
    } catch (error) {
      console.error('Error generating email:', error);
      toast({
        title: "Error",
        description: "Failed to generate email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const sendEmail = async () => {
    if (!emailData.to || !emailData.subject || !emailData.content) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    try {
      const response = await supabase.functions.invoke('send-email', {
        body: {
          to: emailData.to,
          subject: emailData.subject,
          content: emailData.content,
          type: emailData.type,
          leadId: leadData?.id
        }
      });

      if (response.error) throw response.error;

      // Log the communication in the database
      if (leadData?.id) {
        await supabase
          .from('communication_history')
          .insert({
            lead_id: leadData.id,
            communication_type: 'email',
            direction: 'outbound',
            subject: emailData.subject,
            content: emailData.content,
            sent_at: new Date().toISOString(),
            metadata: {
              email_type: emailData.type,
              recipient: emailData.to
            }
          });

        // Update lead's last communication date
        await supabase
          .from('leads')
          .update({
            last_communication_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', leadData.id);
      }

      toast({
        title: "Success",
        description: "Email sent successfully",
      });

      // Reset form
      setEmailData({
        to: leadData?.director_email || '',
        subject: '',
        content: '',
        type: 'custom'
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Error",
        description: "Failed to send email. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleTemplateChange = (value: string) => {
    setEmailData(prev => ({
      ...prev,
      type: value as any
    }));
  };

  const handleInputChange = (field: string, value: string) => {
    setEmailData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Composer</h2>
          {leadData && (
            <p className="text-muted-foreground">
              Composing email for {leadData.director_first_name} {leadData.director_last_name}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
          >
            {previewMode ? 'Edit' : 'Preview'}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose">Compose</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="ai-assist">AI Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-4">
          {!previewMode ? (
            <div className="grid gap-4">
              <div>
                <Label htmlFor="to">To</Label>
                <Input
                  id="to"
                  type="email"
                  value={emailData.to}
                  onChange={(e) => handleInputChange('to', e.target.value)}
                  placeholder="recipient@email.com"
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={emailData.subject}
                  onChange={(e) => handleInputChange('subject', e.target.value)}
                  placeholder="Enter email subject"
                />
              </div>

              <div>
                <Label htmlFor="content">Message</Label>
                <Textarea
                  id="content"
                  value={emailData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  placeholder="Enter your email content..."
                  rows={12}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button
                  onClick={sendEmail}
                  disabled={sending || !emailData.to || !emailData.subject || !emailData.content}
                >
                  {sending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Email
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">Email Preview</CardTitle>
                    <CardDescription>To: {emailData.to}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Subject</Label>
                  <p className="text-lg font-semibold">{emailData.subject || 'No subject'}</p>
                </div>
                <Separator />
                <div>
                  <Label className="text-sm font-medium">Message</Label>
                  <div className="mt-2 p-4 bg-muted rounded-lg">
                    <pre className="whitespace-pre-wrap text-sm">{emailData.content || 'No content'}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label>Email Template</Label>
              <Select value={emailData.type} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {emailTemplates.map((template) => (
                    <SelectItem key={template.value} value={template.value}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3">
              {emailTemplates.map((template) => (
                <Card
                  key={template.value}
                  className={`cursor-pointer transition-colors ${
                    emailData.type === template.value
                      ? 'ring-2 ring-primary'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleTemplateChange(template.value)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{template.label}</h4>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                      {emailData.type === template.value && (
                        <CheckCircle className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ai-assist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                AI Email Assistant
              </CardTitle>
              <CardDescription>
                Generate personalized emails using AI based on lead information and email type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {leadData ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Lead Information</Label>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm">
                          <strong>Name:</strong> {leadData.director_first_name} {leadData.director_last_name}
                        </p>
                        <p className="text-sm">
                          <strong>School:</strong> {leadData.school_name || 'N/A'}
                        </p>
                        <p className="text-sm">
                          <strong>Program:</strong> {leadData.ensemble_program_name || 'N/A'}
                        </p>
                        <p className="text-sm">
                          <strong>Status:</strong> <Badge variant="outline">{leadData.status}</Badge>
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Email Type</Label>
                      <Select value={emailData.type} onValueChange={handleTemplateChange}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {emailTemplates.slice(0, -1).map((template) => (
                            <SelectItem key={template.value} value={template.value}>
                              {template.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={generateEmail}
                    disabled={generating || emailData.type === 'custom'}
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Email...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate AI Email
                      </>
                    )}
                  </Button>

                  {emailData.type === 'custom' && (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        Select a specific email type to use AI generation
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Lead Data</h3>
                  <p className="text-muted-foreground">
                    AI email generation requires lead information. Please select a lead first.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailComposer;