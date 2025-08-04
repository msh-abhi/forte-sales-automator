import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Search, LogOut, Plus, Filter } from 'lucide-react';

interface Lead {
  id: string;
  director_first_name: string;
  director_last_name: string;
  director_email: string;
  director_phone_number: string;
  ensemble_program_name: string;
  estimated_performers: number;
  status: string;
  last_communication_date: string;
  follow_up_count: number;
  school_name: string;
  season: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchLeads();
  }, [user, navigate]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch leads: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const handleLeadClick = (leadId: string) => {
    navigate(`/lead/${leadId}`);
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      'New Lead': 'bg-blue-100 text-blue-800',
      'Quote Sent': 'bg-yellow-100 text-yellow-800',
      'Reply Received - Awaiting Action': 'bg-orange-100 text-orange-800',
      'Reply Handled': 'bg-green-100 text-green-800',
      'Follow-up Sent 1': 'bg-purple-100 text-purple-800',
      'Follow-up Sent 2': 'bg-purple-100 text-purple-800',
      'Follow-up Sent 3': 'bg-purple-100 text-purple-800',
      'Follow-up Sent 4': 'bg-purple-100 text-purple-800',
      'Invoice Sent': 'bg-indigo-100 text-indigo-800',
      'Converted - Paid': 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.director_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.director_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.director_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.school_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.ensemble_program_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const uniqueStatuses = Array.from(new Set(leads.map(lead => lead.status)));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-lg">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Forte Athletics CRM</h1>
              <p className="text-muted-foreground">Sales Automation Dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.email}
              </span>
              <Button variant="outline" onClick={handleSignOut} size="sm">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Leads</CardDescription>
              <CardTitle className="text-2xl">{leads.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>New Leads</CardDescription>
              <CardTitle className="text-2xl">
                {leads.filter(l => l.status === 'New Lead').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Follow-ups</CardDescription>
              <CardTitle className="text-2xl">
                {leads.filter(l => l.status.includes('Follow-up')).length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Converted</CardDescription>
              <CardTitle className="text-2xl">
                {leads.filter(l => l.status === 'Converted - Paid').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lead Management</CardTitle>
            <CardDescription>Search and filter your leads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search leads by name, email, school..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Leads ({filteredLeads.length})</CardTitle>
                <CardDescription>Click on a lead to view details and conversation history</CardDescription>
              </div>
              <Button onClick={() => navigate('/lead/new')}>
                <Plus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>School/Program</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Communication</TableHead>
                    <TableHead>Follow-ups</TableHead>
                    <TableHead>Performers</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleLeadClick(lead.id)}
                    >
                      <TableCell className="font-medium">
                        {lead.director_first_name} {lead.director_last_name}
                      </TableCell>
                      <TableCell>{lead.director_email}</TableCell>
                      <TableCell>{lead.director_phone_number || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{lead.school_name || 'N/A'}</div>
                          <div className="text-sm text-muted-foreground">
                            {lead.ensemble_program_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(lead.status)} variant="secondary">
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {lead.last_communication_date 
                          ? new Date(lead.last_communication_date).toLocaleDateString()
                          : 'N/A'
                        }
                      </TableCell>
                      <TableCell className="text-center">{lead.follow_up_count}</TableCell>
                      <TableCell>{lead.estimated_performers || 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="text-muted-foreground">
                          {searchTerm || statusFilter !== 'all' 
                            ? 'No leads found matching your filters.' 
                            : 'No leads found. Add your first lead to get started.'
                          }
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;