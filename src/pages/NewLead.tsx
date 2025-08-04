import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Save, User, School, Music, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const NewLead = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    director_first_name: '',
    director_last_name: '',
    director_email: '',
    director_phone_number: '',
    school_name: '',
    ensemble_program_name: '',
    workout_program_name: '',
    estimated_performers: '',
    season: '',
    early_bird_deadline: '',
    standard_rate_sr: '',
    discount_rate_dr: '',
    status: 'New Lead',
    notes: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.director_first_name || !formData.director_last_name || !formData.director_email) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields (Name and Email)",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      // Calculate savings if both rates are provided
      const standardRate = parseFloat(formData.standard_rate_sr) || 0;
      const discountRate = parseFloat(formData.discount_rate_dr) || 0;
      const savings = standardRate - discountRate;

      const leadData = {
        director_first_name: formData.director_first_name,
        director_last_name: formData.director_last_name,
        director_email: formData.director_email,
        director_phone_number: formData.director_phone_number || null,
        school_name: formData.school_name || null,
        ensemble_program_name: formData.ensemble_program_name || null,
        workout_program_name: formData.workout_program_name || null,
        estimated_performers: formData.estimated_performers ? parseInt(formData.estimated_performers) : null,
        season: formData.season || null,
        early_bird_deadline: formData.early_bird_deadline || null,
        standard_rate_sr: standardRate || null,
        discount_rate_dr: discountRate || null,
        savings: savings || null,
        status: formData.status,
        form_submission_date: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('leads')
        .insert(leadData)
        .select()
        .single();

      if (error) throw error;

      // Add initial note if provided
      if (formData.notes.trim()) {
        await supabase
          .from('communication_history')
          .insert({
            lead_id: data.id,
            communication_type: 'note',
            direction: 'internal',
            subject: 'Initial Note',
            content: formData.notes,
            sent_at: new Date().toISOString()
          });
      }

      toast({
        title: "Success",
        description: "Lead created successfully",
      });

      navigate(`/lead/${data.id}`);
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: "Error",
        description: "Failed to create lead. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Create New Lead</h1>
            <p className="text-muted-foreground">Add a new lead to your CRM system</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Contact Information
              </CardTitle>
              <CardDescription>Basic contact details for the lead</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={formData.director_first_name}
                    onChange={(e) => handleInputChange('director_first_name', e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={formData.director_last_name}
                    onChange={(e) => handleInputChange('director_last_name', e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.director_email}
                    onChange={(e) => handleInputChange('director_email', e.target.value)}
                    placeholder="Enter email address"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.director_phone_number}
                    onChange={(e) => handleInputChange('director_phone_number', e.target.value)}
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* School Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                School Information
              </CardTitle>
              <CardDescription>Details about the educational institution</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="schoolName">School Name</Label>
                <Input
                  id="schoolName"
                  value={formData.school_name}
                  onChange={(e) => handleInputChange('school_name', e.target.value)}
                  placeholder="Enter school name"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="season">Season</Label>
                  <Select value={formData.season} onValueChange={(value) => handleInputChange('season', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select season" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Fall">Fall</SelectItem>
                      <SelectItem value="Winter">Winter</SelectItem>
                      <SelectItem value="Spring">Spring</SelectItem>
                      <SelectItem value="Summer">Summer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="deadline">Early Bird Deadline</Label>
                  <Input
                    id="deadline"
                    value={formData.early_bird_deadline}
                    onChange={(e) => handleInputChange('early_bird_deadline', e.target.value)}
                    placeholder="e.g., December 1st"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Program Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Music className="h-5 w-5" />
                Program Details
              </CardTitle>
              <CardDescription>Information about the music programs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ensembleProgram">Ensemble Program Name</Label>
                  <Input
                    id="ensembleProgram"
                    value={formData.ensemble_program_name}
                    onChange={(e) => handleInputChange('ensemble_program_name', e.target.value)}
                    placeholder="Enter ensemble program name"
                  />
                </div>
                <div>
                  <Label htmlFor="workoutProgram">Workout Program Name</Label>
                  <Input
                    id="workoutProgram"
                    value={formData.workout_program_name}
                    onChange={(e) => handleInputChange('workout_program_name', e.target.value)}
                    placeholder="Enter workout program name"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="performers">Estimated Number of Performers</Label>
                <Input
                  id="performers"
                  type="number"
                  min="1"
                  value={formData.estimated_performers}
                  onChange={(e) => handleInputChange('estimated_performers', e.target.value)}
                  placeholder="Enter estimated number of performers"
                />
              </div>
            </CardContent>
          </Card>

          {/* Pricing Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing Information
              </CardTitle>
              <CardDescription>Pricing details and rates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="standardRate">Standard Rate ($)</Label>
                  <Input
                    id="standardRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.standard_rate_sr}
                    onChange={(e) => handleInputChange('standard_rate_sr', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="discountRate">Discount Rate ($)</Label>
                  <Input
                    id="discountRate"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_rate_dr}
                    onChange={(e) => handleInputChange('discount_rate_dr', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              {formData.standard_rate_sr && formData.discount_rate_dr && (
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium">Calculated Savings</Label>
                  <p className="text-lg font-bold text-primary">
                    ${(parseFloat(formData.standard_rate_sr) - parseFloat(formData.discount_rate_dr)).toFixed(2)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lead Status & Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
              <CardDescription>Set initial status and add any notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="status">Initial Status</Label>
                <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
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
              </div>
              <div>
                <Label htmlFor="notes">Initial Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Add any initial notes about this lead..."
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Creating Lead...' : 'Create Lead'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewLead;