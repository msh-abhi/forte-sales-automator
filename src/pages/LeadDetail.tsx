import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Mail, Calendar, DollarSign, Users, MessageSquare, Send, CreditCard, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Lead {
  id: string;
  director_first_name: string;
  director_last_name: string;
  director_email: string;
  director_phone_number: string;
  school_name: string;
  ensemble_program_name: string;
  workout_program_name: string;
  estimated_performers: number;
  season: string;
  early_bird_deadline: string;
  status: string;
  standard_rate_sr: number;
  discount_rate_dr: number;
  savings: number;
  form_submission_date: string;
  last_communication_date: string;
  follow_up_count: number;
  reply_detected: boolean;
  quote_sent_date: string;
  payment_date: string;
  invoice_status: string;
  created_at: string;
  updated_at: string;
}

interface CommunicationHistory {
  id: string;
  communication_type: string;
  direction: string;
  subject: string;
  content: string;
  sent_at: string;
  metadata: any;
}

const LeadDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead | null>(null);
  const [communications, setCommunications] = useState<CommunicationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    if (id) {
      fetchLeadDetails();
      fetchCommunications();
    }
  }, [id]);

  const fetchLeadDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setLead(data);
      setNewStatus(data.status);
    } catch (error) {
      console.error('Error fetching lead:', error);
      toast({
        title: "Error",
        description: "Failed to load lead details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCommunications = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_history')
        .select('*')
        .eq('lead_id', id)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      setCommunications(data || []);
    } catch (error) {
      console.error('Error fetching communications:', error);
    }
  };

  const updateLeadStatus = async () => {
    if (!lead || !newStatus) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setLead({ ...lead, status: newStatus });
      toast({
        title: "Success",
        description: "Lead status updated successfully",
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update lead status",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const { error } = await supabase
        .from('communication_history')
        .insert({
          lead_id: id,
          communication_type: 'note',
          direction: 'internal',
          subject: 'Internal Note',
          content: newNote,
          sent_at: new Date().toISOString()
        });

      if (error) throw error;

      setNewNote('');
      fetchCommunications();
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    }
  };

  const handleManualConvert = async () => {
    if (!lead) return;
    
    if (!confirm('Are you sure you want to manually convert this lead to a customer? This will create an invoice in QuickBooks.')) {
      return;
    }

    setUpdating(true);
    try {
      // Update lead status to trigger QuickBooks conversion
      const { error } = await supabase
        .from('leads')
        .update({ 
          status: 'Manually Converted',
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Call QuickBooks conversion edge function
      const { data, error: conversionError } = await supabase.functions.invoke('quickbooks-conversion', {
        body: { 
          leadId: id,
          leadData: lead
        }
      });

      if (conversionError) throw conversionError;

      setLead({ ...lead, status: 'Invoice Sent' });
      toast({
        title: "Success",
        description: "Lead converted successfully! Invoice has been sent.",
      });
      
      // Refresh data
      fetchLeadDetails();
      fetchCommunications();
    } catch (error) {
      console.error('Error converting lead:', error);
      toast({
        title: "Error",
        description: "Failed to convert lead. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleResendCommunication = async () => {
    if (!lead || communications.length === 0) return;

    setUpdating(true);
    try {
      // Get the last communication that was sent outbound
      const lastOutboundComm = communications.find(comm => 
        comm.direction === 'outbound' && 
        (comm.communication_type === 'email' || comm.communication_type === 'sms')
      );

      if (!lastOutboundComm) {
        toast({
          title: "No Communication Found",
          description: "No previous email or SMS to resend.",
          variant: "destructive",
        });
        return;
      }

      // Resend based on communication type
      if (lastOutboundComm.communication_type === 'email') {
        const { error } = await supabase.functions.invoke('send-email', {
          body: {
            to: lead.director_email,
            subject: `Re: ${lastOutboundComm.subject}`,
            content: lastOutboundComm.content,
            leadId: id,
            type: 'manual_resend'
          }
        });

        if (error) throw error;
      } else if (lastOutboundComm.communication_type === 'sms') {
        const { error } = await supabase.functions.invoke('send-sms', {
          body: {
            to: lead.director_phone_number,
            message: lastOutboundComm.content,
            leadId: id,
            type: 'manual_resend'
          }
        });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: `${lastOutboundComm.communication_type.toUpperCase()} resent successfully!`,
      });
      
      // Refresh communications
      fetchCommunications();
    } catch (error) {
      console.error('Error resending communication:', error);
      toast({
        title: "Error",
        description: "Failed to resend communication. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New Lead': return 'default';
      case 'Active Follow-up': return 'secondary';
      case 'Converted': return 'default';
      case 'Inactive': return 'outline';
      default: return 'default';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Lead not found</h2>
          <Button onClick={() => navigate('/')}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">
              {lead.director_first_name} {lead.director_last_name}
            </h1>
            <p className="text-muted-foreground">{lead.school_name}</p>
          </div>
          <Badge variant={getStatusBadgeVariant(lead.status)} className="text-sm">
            {lead.status}
          </Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="communications">Communications</TabsTrigger>
                <TabsTrigger value="notes">Notes</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-6">
                {/* Contact Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Contact Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Email</Label>
                        <p className="text-sm text-muted-foreground">{lead.director_email}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Phone</Label>
                        <p className="text-sm text-muted-foreground">{lead.director_phone_number || 'Not provided'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Program Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Program Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Ensemble Program</Label>
                        <p className="text-sm text-muted-foreground">{lead.ensemble_program_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Workout Program</Label>
                        <p className="text-sm text-muted-foreground">{lead.workout_program_name || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Estimated Performers</Label>
                        <p className="text-sm text-muted-foreground">{lead.estimated_performers || 'N/A'}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Season</Label>
                        <p className="text-sm text-muted-foreground">{lead.season || 'N/A'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Financial Information */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Financial Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Standard Rate</Label>
                        <p className="text-sm text-muted-foreground">{formatCurrency(lead.standard_rate_sr)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Discount Rate</Label>
                        <p className="text-sm text-muted-foreground">{formatCurrency(lead.discount_rate_dr)}</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Savings</Label>
                        <p className="text-sm text-muted-foreground">{formatCurrency(lead.savings)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="communications">
                <Card>
                  <CardHeader>
                    <CardTitle>Communication History</CardTitle>
                    <CardDescription>All communications with this lead</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {communications.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No communications yet</p>
                    ) : (
                      <div className="space-y-4">
                        {communications.map((comm) => (
                          <div key={comm.id} className="border rounded-lg p-4 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{comm.communication_type}</Badge>
                                <Badge variant={comm.direction === 'outbound' ? 'default' : 'secondary'}>
                                  {comm.direction}
                                </Badge>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                {formatDate(comm.sent_at)}
                              </span>
                            </div>
                            {comm.subject && (
                              <h4 className="font-medium">{comm.subject}</h4>
                            )}
                            <p className="text-sm text-muted-foreground">{comm.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes">
                <Card>
                  <CardHeader>
                    <CardTitle>Add Note</CardTitle>
                    <CardDescription>Add internal notes about this lead</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Textarea
                      placeholder="Enter your note here..."
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      rows={4}
                    />
                    <Button onClick={addNote} disabled={!newNote.trim()}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Note
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle>Timeline</CardTitle>
                    <CardDescription>Important dates and milestones</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="font-medium">Form Submitted</span>
                        <span className="text-muted-foreground">{formatDate(lead.form_submission_date)}</span>
                      </div>
                      {lead.quote_sent_date && (
                        <div className="flex justify-between">
                          <span className="font-medium">Quote Sent</span>
                          <span className="text-muted-foreground">{formatDate(lead.quote_sent_date)}</span>
                        </div>
                      )}
                      {lead.last_communication_date && (
                        <div className="flex justify-between">
                          <span className="font-medium">Last Communication</span>
                          <span className="text-muted-foreground">{formatDate(lead.last_communication_date)}</span>
                        </div>
                      )}
                      {lead.payment_date && (
                        <div className="flex justify-between">
                          <span className="font-medium">Payment Received</span>
                          <span className="text-muted-foreground">{formatDate(lead.payment_date)}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full" 
                  variant="default"
                  onClick={handleManualConvert}
                  disabled={updating || lead.status === 'Invoice Sent' || lead.status === 'Converted - Paid'}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  {updating ? 'Converting...' : 'Manually Convert'}
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleResendCommunication}
                  disabled={updating || communications.length === 0}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {updating ? 'Resending...' : 'Resend Last Communication'}
                </Button>
                <Button className="w-full" variant="outline">
                  <Phone className="h-4 w-4 mr-2" />
                  Call Lead
                </Button>
                <Button className="w-full" variant="outline">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button className="w-full" variant="outline">
                  <Send className="h-4 w-4 mr-2" />
                  Send Quote
                </Button>
              </CardContent>
            </Card>

            {/* Status Update */}
            <Card>
              <CardHeader>
                <CardTitle>Update Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="New Lead">New Lead</SelectItem>
                    <SelectItem value="Active Follow-up">Active Follow-up</SelectItem>
                    <SelectItem value="Converted">Converted</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={updateLeadStatus} 
                  disabled={updating || newStatus === lead.status}
                  className="w-full"
                >
                  {updating ? 'Updating...' : 'Update Status'}
                </Button>
              </CardContent>
            </Card>

            {/* Lead Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Lead Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm">Follow-ups</span>
                  <span className="text-sm font-medium">{lead.follow_up_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Reply Detected</span>
                  <span className="text-sm font-medium">{lead.reply_detected ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Days Since Submission</span>
                  <span className="text-sm font-medium">
                    {Math.floor((new Date().getTime() - new Date(lead.form_submission_date).getTime()) / (1000 * 60 * 60 * 24))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeadDetail;