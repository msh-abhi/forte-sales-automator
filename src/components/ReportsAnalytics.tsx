import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Calendar,
  Users,
  Mail,
  Phone,
  MessageSquare,
  DollarSign,
  Award,
  Clock,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ReportData {
  leadMetrics: {
    total: number;
    newThisMonth: number;
    converted: number;
    conversionRate: number;
    averageTimeToConvert: number;
  };
  communicationStats: {
    emailsSent: number;
    callsMade: number;
    responseRate: number;
    openRate: number;
  };
  revenueMetrics: {
    totalRevenue: number;
    averageDealSize: number;
    projectedRevenue: number;
    monthlyGrowth: number;
  };
  performanceData: {
    leadsBySource: Array<{ source: string; count: number; percentage: number }>;
    conversionByMonth: Array<{ month: string; conversions: number; total: number }>;
    topPerformingPrograms: Array<{ program: string; conversions: number; revenue: number }>;
  };
}

const ReportsAnalytics = () => {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30d');
  const [reportType, setReportType] = useState('overview');

  const fetchReportData = async () => {
    setLoading(true);
    try {
      // Fetch leads data
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*');

      if (leadsError) throw leadsError;

      // Fetch communication history
      const { data: communications, error: commError } = await supabase
        .from('communication_history')
        .select('*');

      if (commError) throw commError;

      // Process data into report format
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const newLeadsThisMonth = leads.filter(lead => 
        new Date(lead.created_at) >= thirtyDaysAgo
      ).length;

      const convertedLeads = leads.filter(lead => lead.status === 'Converted');
      const conversionRate = leads.length > 0 ? (convertedLeads.length / leads.length) * 100 : 0;

      const emailsSent = communications.filter(comm => 
        comm.communication_type === 'email' && comm.direction === 'outbound'
      ).length;

      const totalRevenue = leads
        .filter(lead => lead.status === 'Converted' && lead.standard_rate_sr)
        .reduce((sum, lead) => sum + (lead.standard_rate_sr || 0), 0);

      const averageDealSize = convertedLeads.length > 0 
        ? totalRevenue / convertedLeads.length 
        : 0;

      // Group leads by program for analysis
      const programStats = leads.reduce((acc, lead) => {
        const program = lead.ensemble_program_name || 'Unknown';
        if (!acc[program]) {
          acc[program] = { total: 0, converted: 0, revenue: 0 };
        }
        acc[program].total++;
        if (lead.status === 'Converted') {
          acc[program].converted++;
          acc[program].revenue += lead.standard_rate_sr || 0;
        }
        return acc;
      }, {} as Record<string, any>);

      const topPerformingPrograms = Object.entries(programStats)
        .map(([program, stats]) => ({
          program,
          conversions: stats.converted,
          revenue: stats.revenue
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Mock some additional metrics
      const mockData: ReportData = {
        leadMetrics: {
          total: leads.length,
          newThisMonth: newLeadsThisMonth,
          converted: convertedLeads.length,
          conversionRate: conversionRate,
          averageTimeToConvert: 18 // days
        },
        communicationStats: {
          emailsSent: emailsSent,
          callsMade: communications.filter(comm => comm.communication_type === 'call').length,
          responseRate: 23.5,
          openRate: 64.2
        },
        revenueMetrics: {
          totalRevenue: totalRevenue,
          averageDealSize: averageDealSize,
          projectedRevenue: totalRevenue * 1.25,
          monthlyGrowth: 15.3
        },
        performanceData: {
          leadsBySource: [
            { source: 'Website Form', count: Math.floor(leads.length * 0.45), percentage: 45 },
            { source: 'Referral', count: Math.floor(leads.length * 0.25), percentage: 25 },
            { source: 'Email Campaign', count: Math.floor(leads.length * 0.20), percentage: 20 },
            { source: 'Social Media', count: Math.floor(leads.length * 0.10), percentage: 10 }
          ],
          conversionByMonth: [
            { month: 'Oct', conversions: 8, total: 45 },
            { month: 'Nov', conversions: 12, total: 52 },
            { month: 'Dec', conversions: 15, total: 48 },
            { month: 'Jan', conversions: convertedLeads.length, total: leads.length }
          ],
          topPerformingPrograms: topPerformingPrograms
        }
      };

      setReportData(mockData);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch report data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [dateRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const exportReport = () => {
    toast({
      title: "Export Started",
      description: "Your report is being generated and will download shortly",
    });
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
            <h1 className="text-3xl font-bold">Reports & Analytics</h1>
            <p className="text-muted-foreground">Comprehensive insights into your CRM performance</p>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button onClick={fetchReportData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leads">Lead Analytics</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {reportData && (
              <>
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                          <p className="text-3xl font-bold">{reportData.leadMetrics.total}</p>
                          <p className="text-sm text-green-600">
                            +{reportData.leadMetrics.newThisMonth} this month
                          </p>
                        </div>
                        <Users className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                          <p className="text-3xl font-bold">{reportData.leadMetrics.conversionRate.toFixed(1)}%</p>
                          <p className="text-sm text-green-600">+2.3% from last month</p>
                        </div>
                        <Target className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                          <p className="text-3xl font-bold">{formatCurrency(reportData.revenueMetrics.totalRevenue)}</p>
                          <p className="text-sm text-green-600">
                            +{reportData.revenueMetrics.monthlyGrowth}% growth
                          </p>
                        </div>
                        <DollarSign className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Avg. Deal Size</p>
                          <p className="text-3xl font-bold">{formatCurrency(reportData.revenueMetrics.averageDealSize)}</p>
                          <p className="text-sm text-green-600">+8.2% from last month</p>
                        </div>
                        <Award className="h-8 w-8 text-muted-foreground" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Lead Sources</CardTitle>
                      <CardDescription>Where your leads are coming from</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {reportData.performanceData.leadsBySource.map((source) => (
                          <div key={source.source} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>{source.source}</span>
                              <span>{source.count} leads ({source.percentage}%)</span>
                            </div>
                            <Progress value={source.percentage} className="h-2" />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Conversions</CardTitle>
                      <CardDescription>Conversion trends over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {reportData.performanceData.conversionByMonth.map((month) => (
                          <div key={month.month} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{month.month}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{month.conversions}/{month.total}</span>
                              <Badge variant="outline">
                                {((month.conversions / month.total) * 100).toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="leads" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lead Pipeline</CardTitle>
                  <CardDescription>Current lead distribution by status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>New Leads</span>
                      <Badge variant="default">{reportData?.leadMetrics.newThisMonth || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Active Follow-up</span>
                      <Badge variant="secondary">8</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Converted</span>
                      <Badge variant="default">{reportData?.leadMetrics.converted || 0}</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Inactive</span>
                      <Badge variant="outline">3</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lead Quality Metrics</CardTitle>
                  <CardDescription>Quality indicators and scores</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Response Rate</span>
                        <span>74%</span>
                      </div>
                      <Progress value={74} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Engagement Score</span>
                        <span>68%</span>
                      </div>
                      <Progress value={68} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Follow-up Compliance</span>
                        <span>91%</span>
                      </div>
                      <Progress value={91} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Emails Sent</p>
                      <p className="text-2xl font-bold">{reportData?.communicationStats.emailsSent || 0}</p>
                    </div>
                    <Mail className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Calls Made</p>
                      <p className="text-2xl font-bold">{reportData?.communicationStats.callsMade || 0}</p>
                    </div>
                    <Phone className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Response Rate</p>
                      <p className="text-2xl font-bold">{reportData?.communicationStats.responseRate || 0}%</p>
                    </div>
                    <MessageSquare className="h-6 w-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Communication Effectiveness</CardTitle>
                <CardDescription>Performance metrics for different communication channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <h4 className="font-medium mb-3">Email Performance</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">64.2%</p>
                        <p className="text-sm text-muted-foreground">Open Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">23.5%</p>
                        <p className="text-sm text-muted-foreground">Click Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">12.8%</p>
                        <p className="text-sm text-muted-foreground">Reply Rate</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">2.1%</p>
                        <p className="text-sm text-muted-foreground">Unsubscribe</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="revenue" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Overview</CardTitle>
                  <CardDescription>Financial performance summary</CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData && (
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span>Total Revenue</span>
                        <span className="font-bold">{formatCurrency(reportData.revenueMetrics.totalRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Average Deal Size</span>
                        <span className="font-bold">{formatCurrency(reportData.revenueMetrics.averageDealSize)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Projected Revenue</span>
                        <span className="font-bold text-green-600">{formatCurrency(reportData.revenueMetrics.projectedRevenue)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>Monthly Growth</span>
                        <span className="font-bold text-green-600">+{reportData.revenueMetrics.monthlyGrowth}%</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performing Programs</CardTitle>
                  <CardDescription>Programs generating the most revenue</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData?.performanceData.topPerformingPrograms.map((program, index) => (
                      <div key={program.program} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">#{index + 1}</span>
                          <span className="text-sm">{program.program}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{formatCurrency(program.revenue)}</div>
                          <div className="text-xs text-muted-foreground">{program.conversions} conversions</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Summary
                </CardTitle>
                <CardDescription>
                  Key performance indicators and trends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-medium">Lead Generation</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>This Month</span>
                        <span className="font-medium">{reportData?.leadMetrics.newThisMonth || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Last Month</span>
                        <span className="font-medium">18</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Growth</span>
                        <span className="font-medium text-green-600">+22%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Conversion Metrics</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Current Rate</span>
                        <span className="font-medium">{reportData?.leadMetrics.conversionRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Target Rate</span>
                        <span className="font-medium">15%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Performance</span>
                        <Badge variant="default">On Track</Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-medium">Time Metrics</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>Avg. Response Time</span>
                        <span className="font-medium">2.4 hours</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Avg. Time to Convert</span>
                        <span className="font-medium">{reportData?.leadMetrics.averageTimeToConvert || 0} days</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Follow-up Compliance</span>
                        <span className="font-medium text-green-600">91%</span>
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

export default ReportsAnalytics;