import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Send, Mail, Loader2, BellPlus } from 'lucide-react';
import { Profile } from '@/App';
import { cn } from '@/lib/utils';

type ApiStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
  fullResponse?: any;
};

interface QntrlEmailAlertProps {
  onAddProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profileName: string) => void;
}

const SERVER_URL = "http://localhost:3000";
let socket: Socket;

const QntrlEmailAlert: React.FC<QntrlEmailAlertProps> = ({ onAddProfile, onEditProfile, onDeleteProfile }) => {
  const { toast } = useToast();
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'loading', message: 'Connecting to server...' });
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Form state
  const [alertName, setAlertName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [toEmails, setToEmails] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Response state
  const [result, setResult] = useState<any>(null);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const response = await fetch(`${SERVER_URL}/api/profiles`);
      if (!response.ok) throw new Error('Could not connect to the server.');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const qntrlProfiles = profiles.filter(p => p.qntrl?.orgId);
  const selectedProfile = qntrlProfiles.find(p => p.profileName === activeProfileName) || null;

  useEffect(() => {
    if (qntrlProfiles.length > 0 && !activeProfileName) {
      setActiveProfileName(qntrlProfiles[0].profileName);
    }
  }, [qntrlProfiles, activeProfileName]);

  useEffect(() => {
    socket = io(SERVER_URL);

    socket.on('connect', () => toast({ title: "Connected to server!" }));
    socket.on('apiStatusResult', (result) => setApiStatus({
      status: result.success ? 'success' : 'error',
      message: result.message,
      fullResponse: result.fullResponse || null
    }));
    
    socket.on('qntrlEmailAlertResult', (data) => {
        setIsProcessing(false);
        setResult(data);
        toast({
            title: data.success ? "Alert Created Successfully" : "Alert Creation Failed",
            description: data.message || data.error,
            variant: data.success ? "default" : "destructive",
        });
    });

    return () => {
      socket.disconnect();
      socket.off('apiStatusResult');
      socket.off('qntrlEmailAlertResult');
    };
  }, [toast]);
  
  useEffect(() => {
    if (activeProfileName && socket?.connected) {
      setApiStatus({ status: 'loading', message: 'Checking API connection...' });
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'qntrl' });
    }
  }, [activeProfileName, socket?.connected]);
  
  const handleProfileChange = (profileName: string) => {
    setActiveProfileName(profileName);
    toast({ title: "Profile Changed", description: `Switched to ${profileName}` });
  };
  
  const handleManualVerify = () => {
    if (!activeProfileName) return;
    setApiStatus({ status: 'loading', message: 'Checking API connection...', fullResponse: null });
    if (socket && socket.connected) {
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'qntrl' });
    }
    toast({ title: "Re-checking Connection..." });
  };

  const handleCreateAlert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProfileName || !alertName || !templateId) {
      toast({ title: "Missing Information", description: "Alert Name and Template ID are required.", variant: "destructive" });
      return;
    }
    
    setIsProcessing(true);
    setResult(null);
    toast({ title: "Creating Email Alert..." });
    
    socket.emit('createQntrlEmailAlert', {
        selectedProfileName: activeProfileName,
        name: alertName,
        emailtemplate_id: templateId,
        to_users: { emails: toEmails.split('\n').filter(e => e.trim() !== '') },
        cc_users: { emails: ccEmails.split('\n').filter(e => e.trim() !== '') },
        bcc_users: { emails: bccEmails.split('\n').filter(e => e.trim() !== '') }
    });
  };

  return (
    <>
      <DashboardLayout
        onAddProfile={onAddProfile}
        profiles={qntrlProfiles}
        selectedProfile={selectedProfile}
        jobs={{}}
        onProfileChange={handleProfileChange}
        apiStatus={apiStatus}
        onShowStatus={() => setIsStatusModalOpen(true)}
        onManualVerify={handleManualVerify}
        socket={socket}
        onEditProfile={onEditProfile}
        onDeleteProfile={onDeleteProfile}
      >
        <div className="space-y-8">
          <Card className="shadow-medium hover:shadow-large transition-all duration-300">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BellPlus className="h-5 w-5 text-primary" />
                <span>Create Email Alert</span>
              </CardTitle>
              <CardDescription>Create a new email alert in Zoho Qntrl.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateAlert} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="alertName">Alert Name <span className="text-destructive">*</span></Label>
                      <Input id="alertName" placeholder="e.g., 'Notify Customer on Card Creation'" value={alertName} onChange={e => setAlertName(e.target.value)} disabled={isProcessing} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="templateId">Email Template ID <span className="text-destructive">*</span></Label>
                      <Input id="templateId" placeholder="49617000000055103" value={templateId} onChange={e => setTemplateId(e.target.value)} disabled={isProcessing} required />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="toEmails">TO Recipients (one per line)</Label>
                      <Textarea id="toEmails" placeholder="user1@example.com&#x0A;user2@example.com" value={toEmails} onChange={e => setToEmails(e.target.value)} disabled={isProcessing} className="min-h-[100px] font-mono text-sm" />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="ccEmails">CC Recipients (one per line)</Label>
                      <Textarea id="ccEmails" placeholder="manager@example.com" value={ccEmails} onChange={e => setCcEmails(e.target.value)} disabled={isProcessing} className="min-h-[100px] font-mono text-sm" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bccEmails">BCC Recipients (one per line)</Label>
                      <Textarea id="bccEmails" placeholder="admin@example.com" value={bccEmails} onChange={e => setBccEmails(e.target.value)} disabled={isProcessing} className="min-h-[100px] font-mono text-sm" />
                    </div>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating Alert...</> : <><Send className="mr-2 h-4 w-4" /> Create Alert</>}
                </Button>

                {result && (
                    <div className="pt-4">
                        <Label>Creation Result</Label>
                        <pre className={cn(
                            "bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-96 overflow-y-auto",
                            !result.success && "border-destructive text-destructive"
                        )}>
                            {JSON.stringify(result, null, 2)}
                        </pre>
                    </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
      
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>API Connection Status</DialogTitle>
            <DialogDescription>This is the live status of the connection to the Zoho Qntrl API for the selected profile.</DialogDescription>
          </DialogHeader>
          <div className={`p-4 rounded-md ${apiStatus.status === 'success' ? 'bg-green-100 dark:bg-green-900/50' : apiStatus.status === 'error' ? 'bg-red-100 dark:bg-red-900/50' : 'bg-muted'}`}>
            <p className="font-bold text-lg">{apiStatus.status.charAt(0).toUpperCase() + apiStatus.status.slice(1)}</p>
            <p className="text-sm text-muted-foreground mt-1">{apiStatus.message}</p>
          </div>
          {apiStatus.fullResponse && (
            <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-foreground">Full Response from Server:</h4>
                <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-60 overflow-y-auto">
                    {JSON.stringify(apiStatus.fullResponse, null, 2)}
                </pre>
            </div>
          )}
          <Button onClick={() => setIsStatusModalOpen(false)} className="mt-4">Close</Button>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QntrlEmailAlert;