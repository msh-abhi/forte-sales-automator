import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogOut, Search, Plus, Eye, Mail, Zap, Settings, BarChart3, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Lead {
  id: string;
  director_first_name: string;
  director_last_name: string;
  director_email: string;
  director_phone_number: string;
  status: string;
  last_communication_date: string;
  follow_up_count: number;
  estimated_performers: number;
  ensemble_program_name: string;
  created_at: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, statusFilter]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.director_first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.director_last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.director_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.ensemble_program_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'New Lead':
        return 'secondary';
      case 'Quote Sent':
        return 'default';
      case 'Reply Received - Awaiting Action':
        return 'destructive';
      case 'Follow-up Sent 1':
      case 'Follow-up Sent 2':
      case 'Follow-up Sent 3':
      case 'Follow-up Sent 4':
        return 'outline';
      case 'Invoice Sent':
        return 'secondary';
      case 'Converted - Paid':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Forte Athletics CRM</h1>
            <p className="text-muted-foreground">Welcome back, {user?.email}</p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leads.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'New Lead').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status.includes('Follow-up')).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Converted</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {leads.filter(lead => lead.status === 'Converted - Paid').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Lead Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads by name, email, or program..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="New Lead">New Lead</SelectItem>
                  <SelectItem value="Quote Sent">Quote Sent</SelectItem>
                  <SelectItem value="Reply Received - Awaiting Action">Reply Awaiting Action</SelectItem>
                  <SelectItem value="Follow-up Sent 1">Follow-up 1</SelectItem>
                  <SelectItem value="Follow-up Sent 2">Follow-up 2</SelectItem>
                  <SelectItem value="Follow-up Sent 3">Follow-up 3</SelectItem>
                  <SelectItem value="Follow-up Sent 4">Follow-up 4</SelectItem>
                  <SelectItem value="Invoice Sent">Invoice Sent</SelectItem>
                  <SelectItem value="Converted - Paid">Converted - Paid</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => navigate('/new-lead')}>
                <Plus className="h-4 w-4 mr-2" />
                New Lead
              </Button>
              <Button onClick={() => navigate('/email-composer')} variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Compose Email
              </Button>
              <Button onClick={() => navigate('/automation')} variant="outline">
                <Zap className="h-4 w-4 mr-2" />
                Automation
              </Button>
              <Button onClick={() => navigate('/integrations')} variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Integrations
              </Button>
              <Button onClick={() => navigate('/reports')} variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Reports
              </Button>
              <Button onClick={() => navigate('/settings/email-templates')} variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Templates
              </Button>
            </div>

            {/* Leads Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Performers</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Follow-ups</TableHead>
                    <TableHead>Last Contact</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.director_first_name} {lead.director_last_name}
                      </TableCell>
                      <TableCell>{lead.director_email}</TableCell>
                      <TableCell>{lead.director_phone_number}</TableCell>
                      <TableCell>{lead.ensemble_program_name}</TableCell>
                      <TableCell>{lead.estimated_performers}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(lead.status)}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{lead.follow_up_count}</TableCell>
                      <TableCell>
                        {lead.last_communication_date ? formatDate(lead.last_communication_date) : 'Never'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate(`/lead/${lead.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredLeads.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No leads found matching your criteria.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;