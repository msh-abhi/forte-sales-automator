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
  BarChart3, 
  TrendingUp, 
  Users, 
  Calendar, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Target,
  RefreshCw,
  Loader2,
  Mail,
  Phone,
  MessageSquare
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  total_leads: number;
  new_leads: number;
  stale_leads: number;
  needs_follow_up: number;
  converted: number;
  recommendations: Array<{
    leadId: string;
    type: string;
    message: string;
  }>;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
}

const AutomationDashboard = () => {
  const { toast } = useToast();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [automationRules] = useState<AutomationRule[]>([
    {
      id: '1',
      name: 'New Lead Follow-up',
      description: 'Automatically schedule follow-up for new leads after 2 days',
      trigger: 'New lead created',
      action: 'Schedule follow-up in 2 days',
      enabled: true
    },
    {
      id: '2',
      name: 'Quote Reminder',
      description: 'Send reminder 5 days after quote is sent',
      trigger: 'Quote sent + 5 days',
      action: 'Send quote reminder email',
      enabled: true
    },
    {
      id: '3',
      name: 'Stale Lead Alert',
      description: 'Alert when lead has no activity for 7 days',
      trigger: 'No activity for 7 days',
      action: 'Create follow-up task',
      enabled: false
    }
  ]);

  const fetchAnalytics = async () => {
    try {
      const response = await supabase.functions.invoke('lead-automation', {
        body: {
          action: 'analyze_leads'
        }
      });

      if (response.error) throw response.error;
      setAnalytics(response.data.result);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to fetch analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const executeAutomation = async (action: string, leadId?: string) => {
    try {
      const response = await supabase.functions.invoke('lead-automation', {
        body: {
          action: action,
          leadId: leadId,
          params: {}
        }
      });

      if (response.error) throw response.error;

      toast({
        title: "Success",
        description: "Automation executed successfully",
      });

      // Refresh analytics after automation
      handleRefresh();
    } catch (error) {
      console.error('Error executing automation:', error);
      toast({
        title: "Error",
        description: "Failed to execute automation",
        variant: "destructive",
      });
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case 'urgent_follow_up':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'overdue_follow_up':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'quote_follow_up':
        return <Mail className="h-4 w-4 text-blue-500" />;
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />;
    }
  };

  const getRecommendationBadge = (type: string) => {
    switch (type) {
      case 'urgent_follow_up':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'overdue_follow_up':
        return <Badge variant="secondary">Overdue</Badge>;
      case 'quote_follow_up':
        return <Badge variant="default">Quote Follow-up</Badge>;
      default:
        return <Badge variant="outline">Action Needed</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Automation Dashboard</h1>
            <p className="text-muted-foreground">Monitor and manage your CRM automation</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            <TabsTrigger value="automation-rules">Automation Rules</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {analytics && (
              <>
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                          <p className="text-2xl font-bold">{analytics.total_leads}</p>
                        </div>
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">New Leads</p>
                          <p className="text-2xl font-bold text-blue-600">{analytics.new_leads}</p>
                        </div>
                        <Target className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Need Follow-up</p>
                          <p className="text-2xl font-bold text-orange-600">{analytics.needs_follow_up}</p>
                        </div>
                        <Clock className="h-8 w-8 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Converted</p>
                          <p className="text-2xl font-bold text-green-600">{analytics.converted}</p>
                        </div>
                        <CheckCircle className="h-8 w-8 text-green-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Stale Leads</p>
                          <p className="text-2xl font-bold text-red-600">{analytics.stale_leads}</p>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-red-600" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Execute common automation tasks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Button
                        onClick={() => executeAutomation('schedule_follow_up')}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                      >
                        <Calendar className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Schedule Follow-ups</div>
                          <div className="text-sm text-muted-foreground">For overdue leads</div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => executeAutomation('send_quote_reminder')}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                      >
                        <Mail className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Send Reminders</div>
                          <div className="text-sm text-muted-foreground">Quote follow-ups</div>
                        </div>
                      </Button>

                      <Button
                        onClick={() => executeAutomation('analyze_leads')}
                        variant="outline"
                        className="h-auto p-4 flex flex-col items-center gap-2"
                      >
                        <BarChart3 className="h-6 w-6" />
                        <div className="text-center">
                          <div className="font-medium">Analyze Leads</div>
                          <div className="text-sm text-muted-foreground">Generate insights</div>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="recommendations" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Recommendations</CardTitle>
                <CardDescription>
                  Automated recommendations based on lead analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analytics?.recommendations && analytics.recommendations.length > 0 ? (
                  <div className="space-y-4">
                    {analytics.recommendations.map((rec, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getRecommendationIcon(rec.type)}
                          <div>
                            <p className="font-medium">{rec.message}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {getRecommendationBadge(rec.type)}
                              <span className="text-sm text-muted-foreground">Lead ID: {rec.leadId}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline">
                            View Lead
                          </Button>
                          <Button size="sm">
                            Take Action
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">All Caught Up!</h3>
                    <p className="text-muted-foreground">
                      No urgent recommendations at this time. Your lead management is on track.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="automation-rules" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Automation Rules</CardTitle>
                <CardDescription>
                  Configure automated workflows for lead management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {automationRules.map((rule) => (
                    <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant={rule.enabled ? "default" : "secondary"}>
                            {rule.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Trigger: </span>
                            <span className="text-muted-foreground">{rule.trigger}</span>
                          </div>
                          <div>
                            <span className="font-medium">Action: </span>
                            <span className="text-muted-foreground">{rule.action}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline">
                          Edit
                        </Button>
                        <Button size="sm" variant={rule.enabled ? "secondary" : "default"}>
                          {rule.enabled ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
                <CardDescription>
                  Automation effectiveness and lead conversion trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Automation Efficiency</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Follow-up Success Rate</span>
                        <span className="font-medium">87%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Email Open Rate</span>
                        <span className="font-medium">64%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Response Rate</span>
                        <span className="font-medium">23%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h4 className="font-medium">Lead Conversion</h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Conversion Rate</span>
                        <span className="font-medium">12.5%</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Avg. Time to Convert</span>
                        <span className="font-medium">18 days</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Avg. Touch Points</span>
                        <span className="font-medium">4.2</span>
                      </div>
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

export default AutomationDashboard;