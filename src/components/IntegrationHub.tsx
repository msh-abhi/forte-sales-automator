import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Webhook, 
  Settings, 
  Plus, 
  Trash2, 
  Play, 
  Pause,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ZapierIntegration {
  id: string;
  name: string;
  description: string;
  webhookUrl: string;
  triggerType: 'new_lead' | 'lead_updated' | 'email_sent' | 'custom';
  status: 'active' | 'inactive' | 'error';
  lastTriggered?: string;
}

interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  triggers: string[];
  actions: string[];
  lastRun?: string;
}

const IntegrationHub = () => {
  const { toast } = useToast();
  const [zapierIntegrations, setZapierIntegrations] = useState<ZapierIntegration[]>([
    {
      id: '1',
      name: 'New Lead Notification',
      description: 'Send Slack notification when new lead is created',
      webhookUrl: 'https://hooks.zapier.com/hooks/catch/123456/abcdef/',
      triggerType: 'new_lead',
      status: 'active',
      lastTriggered: '2024-01-15T10:30:00Z'
    },
    {
      id: '2',
      name: 'Quote Follow-up Automation',
      description: 'Create tasks in Asana for quote follow-ups',
      webhookUrl: 'https://hooks.zapier.com/hooks/catch/789012/ghijkl/',
      triggerType: 'email_sent',
      status: 'active',
      lastTriggered: '2024-01-14T15:45:00Z'
    }
  ]);

  const [n8nWorkflows] = useState<N8nWorkflow[]>([
    {
      id: '1',
      name: 'Lead Enrichment Pipeline',
      description: 'Automatically enrich lead data with company information',
      status: 'active',
      triggers: ['New lead created'],
      actions: ['Fetch company data', 'Update lead record', 'Send welcome email'],
      lastRun: '2024-01-15T09:15:00Z'
    },
    {
      id: '2',
      name: 'Multi-Channel Follow-up',
      description: 'Coordinate follow-ups across email, SMS, and LinkedIn',
      status: 'active',
      triggers: ['Lead status changed to follow-up'],
      actions: ['Send email', 'Schedule SMS', 'Create LinkedIn task'],
      lastRun: '2024-01-14T14:20:00Z'
    }
  ]);

  const [newIntegration, setNewIntegration] = useState({
    name: '',
    description: '',
    webhookUrl: '',
    triggerType: 'new_lead' as const
  });

  const [testWebhookUrl, setTestWebhookUrl] = useState('');
  const [testing, setTesting] = useState(false);

  const triggerTypes = [
    { value: 'new_lead', label: 'New Lead Created' },
    { value: 'lead_updated', label: 'Lead Updated' },
    { value: 'email_sent', label: 'Email Sent' },
    { value: 'custom', label: 'Custom Event' }
  ];

  const handleAddIntegration = () => {
    if (!newIntegration.name || !newIntegration.webhookUrl) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const integration: ZapierIntegration = {
      id: Math.random().toString(36).substr(2, 9),
      ...newIntegration,
      status: 'inactive'
    };

    setZapierIntegrations(prev => [...prev, integration]);
    setNewIntegration({
      name: '',
      description: '',
      webhookUrl: '',
      triggerType: 'new_lead'
    });

    toast({
      title: "Success",
      description: "Integration added successfully",
    });
  };

  const handleDeleteIntegration = (id: string) => {
    setZapierIntegrations(prev => prev.filter(integration => integration.id !== id));
    toast({
      title: "Success",
      description: "Integration removed successfully",
    });
  };

  const handleToggleIntegration = (id: string) => {
    setZapierIntegrations(prev => prev.map(integration => 
      integration.id === id 
        ? { ...integration, status: integration.status === 'active' ? 'inactive' : 'active' }
        : integration
    ));
  };

  const handleTestWebhook = async () => {
    if (!testWebhookUrl) {
      toast({
        title: "Error",
        description: "Please enter a webhook URL",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const response = await fetch(testWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          test: true,
          timestamp: new Date().toISOString(),
          triggered_from: "CRM Integration Hub",
          lead_data: {
            id: "test-lead-123",
            director_first_name: "John",
            director_last_name: "Doe",
            director_email: "john.doe@example.com",
            school_name: "Test High School",
            status: "New Lead"
          }
        }),
      });

      toast({
        title: "Test Sent",
        description: "Test webhook sent successfully. Check your Zapier dashboard to verify receipt.",
      });
    } catch (error) {
      console.error("Error testing webhook:", error);
      toast({
        title: "Error",
        description: "Failed to send test webhook",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default">Active</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Integration Hub</h1>
            <p className="text-muted-foreground">Connect your CRM with external tools and workflows</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>

        <Tabs defaultValue="zapier" className="space-y-6">
          <TabsList>
            <TabsTrigger value="zapier">Zapier</TabsTrigger>
            <TabsTrigger value="n8n">n8n Workflows</TabsTrigger>
            <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="zapier" className="space-y-6">
            {/* Add New Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Add Zapier Integration
                </CardTitle>
                <CardDescription>
                  Connect your CRM to thousands of apps with Zapier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Integration Name</Label>
                    <Input
                      id="name"
                      value={newIntegration.name}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Slack Notifications"
                    />
                  </div>
                  <div>
                    <Label htmlFor="triggerType">Trigger Type</Label>
                    <select
                      id="triggerType"
                      value={newIntegration.triggerType}
                      onChange={(e) => setNewIntegration(prev => ({ ...prev, triggerType: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-md"
                    >
                      {triggerTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={newIntegration.description}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this integration does"
                  />
                </div>
                <div>
                  <Label htmlFor="webhookUrl">Zapier Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    value={newIntegration.webhookUrl}
                    onChange={(e) => setNewIntegration(prev => ({ ...prev, webhookUrl: e.target.value }))}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                  />
                </div>
                <Button onClick={handleAddIntegration}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Integration
                </Button>
              </CardContent>
            </Card>

            {/* Existing Integrations */}
            <Card>
              <CardHeader>
                <CardTitle>Active Integrations</CardTitle>
                <CardDescription>
                  Manage your existing Zapier integrations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {zapierIntegrations.map((integration) => (
                    <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(integration.status)}
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{integration.name}</h4>
                            {getStatusBadge(integration.status)}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">{integration.description}</p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>Trigger: {triggerTypes.find(t => t.value === integration.triggerType)?.label}</span>
                            <span>Last triggered: {formatDate(integration.lastTriggered)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleIntegration(integration.id)}
                        >
                          {integration.status === 'active' ? (
                            <>
                              <Pause className="h-4 w-4 mr-1" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Activate
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteIntegration(integration.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="n8n" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  n8n Workflows
                </CardTitle>
                <CardDescription>
                  Advanced automation workflows with n8n
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {n8nWorkflows.map((workflow) => (
                    <div key={workflow.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{workflow.name}</h4>
                          {getStatusBadge(workflow.status)}
                        </div>
                        <Button size="sm" variant="outline">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          Open in n8n
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{workflow.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Triggers:</span>
                          <ul className="ml-4 list-disc text-muted-foreground">
                            {workflow.triggers.map((trigger, index) => (
                              <li key={index}>{trigger}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="font-medium">Actions:</span>
                          <ul className="ml-4 list-disc text-muted-foreground">
                            {workflow.actions.map((action, index) => (
                              <li key={index}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 text-xs text-muted-foreground">
                        Last run: {formatDate(workflow.lastRun)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Webhook Testing
                </CardTitle>
                <CardDescription>
                  Test webhook endpoints before setting up integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="testWebhook">Webhook URL</Label>
                  <Input
                    id="testWebhook"
                    value={testWebhookUrl}
                    onChange={(e) => setTestWebhookUrl(e.target.value)}
                    placeholder="https://hooks.zapier.com/hooks/catch/..."
                  />
                </div>
                <Button onClick={handleTestWebhook} disabled={testing}>
                  {testing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Sending Test...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Test Data
                    </>
                  )}
                </Button>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Test Payload</h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
{`{
  "test": true,
  "timestamp": "2024-01-15T10:30:00Z",
  "triggered_from": "CRM Integration Hub",
  "lead_data": {
    "id": "test-lead-123",
    "director_first_name": "John",
    "director_last_name": "Doe", 
    "director_email": "john.doe@example.com",
    "school_name": "Test High School",
    "status": "New Lead"
  }
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integration Settings</CardTitle>
                <CardDescription>
                  Configure global integration preferences
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">API Endpoints</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Webhooks Base URL:</span>
                      <code className="bg-muted px-2 py-1 rounded">
                        {window.location.origin}/api/webhooks
                      </code>
                    </div>
                    <div className="flex justify-between">
                      <span>API Version:</span>
                      <code className="bg-muted px-2 py-1 rounded">v1</code>
                    </div>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Security</h4>
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Require webhook signature verification</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" defaultChecked />
                      <span className="text-sm">Log all webhook attempts</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input type="checkbox" />
                      <span className="text-sm">Rate limit webhook calls</span>
                    </label>
                  </div>
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-medium mb-2">Retry Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Max Retries</Label>
                      <Input type="number" defaultValue="3" min="0" max="10" />
                    </div>
                    <div>
                      <Label>Retry Delay (seconds)</Label>
                      <Input type="number" defaultValue="30" min="1" max="300" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default IntegrationHub;
