import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-pulse text-lg">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-4xl font-bold mb-4">
            Forte Athletics CRM
          </CardTitle>
          <CardDescription className="text-lg">
            Comprehensive Sales Automation and Lead Management Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="space-y-4">
            <p className="text-muted-foreground">
              Automate lead capture, personalized quoting, multi-stage follow-ups, and QuickBooks invoicing.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">🎯 Lead Automation</h3>
                <p>Capture leads from Wix, Meta, and Google Ads automatically</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">🤖 AI-Powered Quotes</h3>
                <p>Generate personalized quotes and follow-up sequences</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">📧 Smart Communication</h3>
                <p>Automated email and SMS follow-ups with reply detection</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold mb-2">💰 QuickBooks Integration</h3>
                <p>Seamless invoicing and payment tracking</p>
              </div>
            </div>
          </div>
          <div className="pt-4">
            <Button onClick={() => navigate('/auth')} size="lg" className="text-lg px-8">
              Access Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
