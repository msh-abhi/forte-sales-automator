import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Edit, Trash2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailTemplate {
  id: string;
  name: string;
  sequence_number: number;
  email_subject: string;
  email_body: string;
  sms_message: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const EmailTemplates = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sequence_number: 1,
    email_subject: '',
    email_body: '',
    sms_message: '',
    is_active: true
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('follow_up_templates')
        .select('*')
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load email templates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sequence_number: 1,
      email_subject: '',
      email_body: '',
      sms_message: '',
      is_active: true
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      sequence_number: template.sequence_number,
      email_subject: template.email_subject,
      email_body: template.email_body,
      sms_message: template.sms_message,
      is_active: template.is_active
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('follow_up_templates')
          .update({
            name: formData.name,
            sequence_number: formData.sequence_number,
            email_subject: formData.email_subject,
            email_body: formData.email_body,
            sms_message: formData.sms_message,
            is_active: formData.is_active,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Template updated successfully",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('follow_up_templates')
          .insert({
            name: formData.name,
            sequence_number: formData.sequence_number,
            email_subject: formData.email_subject,
            email_body: formData.email_body,
            sms_message: formData.sms_message,
            is_active: formData.is_active
          });

        if (error) throw error;

        toast({
          title: "Success",
          description: "Template created successfully",
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('follow_up_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Template deleted successfully",
      });
      
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Email Templates</h1>
              <p className="text-muted-foreground">Manage follow-up email and SMS templates</p>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </DialogTitle>
                <DialogDescription>
                  Configure your follow-up email and SMS template
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Template Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Follow-up Day 4"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="sequence">Sequence Number</Label>
                    <Input
                      id="sequence"
                      type="number"
                      value={formData.sequence_number}
                      onChange={(e) => setFormData(prev => ({ ...prev, sequence_number: parseInt(e.target.value) }))}
                      min="1"
                      max="10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="subject">Email Subject</Label>
                  <Input
                    id="subject"
                    value={formData.email_subject}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_subject: e.target.value }))}
                    placeholder="Follow-up: Your Music Program Quote"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="body">Email Body (HTML supported)</Label>
                  <Textarea
                    id="body"
                    value={formData.email_body}
                    onChange={(e) => setFormData(prev => ({ ...prev, email_body: e.target.value }))}
                    placeholder="Enter your email content here..."
                    rows={8}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="sms">SMS Message</Label>
                  <Textarea
                    id="sms"
                    value={formData.sms_message}
                    onChange={(e) => setFormData(prev => ({ ...prev, sms_message: e.target.value }))}
                    placeholder="SMS reminder about your quote..."
                    rows={3}
                    maxLength={160}
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    {formData.sms_message.length}/160 characters
                  </p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    <Save className="h-4 w-4 mr-2" />
                    {editingTemplate ? 'Update' : 'Create'} Template
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Templates Table */}
        <Card>
          <CardHeader>
            <CardTitle>Follow-up Templates</CardTitle>
            <CardDescription>
              Manage your automated follow-up email and SMS templates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sequence</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">#{template.sequence_number}</TableCell>
                      <TableCell>{template.name}</TableCell>
                      <TableCell>{template.email_subject}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          template.is_active 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {new Date(template.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {templates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No templates found. Create your first template to get started.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EmailTemplates;