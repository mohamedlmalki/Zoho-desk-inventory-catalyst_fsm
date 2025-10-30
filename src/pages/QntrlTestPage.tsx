import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Profile } from '@/App';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Network, Mail, Loader2 } from 'lucide-react'; // --- MODIFICATION: Added Mail, Loader2
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type ApiStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
  fullResponse?: any;
};

interface QntrlTestPageProps {
  socket: Socket | null;
  onAddProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profileName: string) => void;
}

const SERVER_URL = "http://localhost:3000";

const QntrlTestPage: React.FC<QntrlTestPageProps> = ({ 
    socket, 
    onAddProfile, 
    onEditProfile, 
    onDeleteProfile 
}) => {
  const { toast } = useToast();
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'loading', message: 'Connecting to server...' });
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // --- MODIFICATION: Added state for new API call ---
  const [emailTemplates, setEmailTemplates] = useState<any>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  // --- END MODIFICATION ---

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
    if (!socket) return;
    const handleApiStatus = (result: any) => setApiStatus({
      status: result.success ? 'success' : 'error',
      message: result.message,
      fullResponse: result.fullResponse || null
    });
    
    // --- MODIFICATION: Added listener for new API call ---
    const handleEmailTemplatesResult = (result: any) => {
        setIsLoadingTemplates(false);
        if (result.success) {
            setEmailTemplates(result.data);
            toast({ title: "Success", description: "Fetched email templates." });
        } else {
            setEmailTemplates({ error: result.error, fullResponse: result.fullResponse });
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };
    // --- END MODIFICATION ---

    socket.on('apiStatusResult', handleApiStatus);
    socket.on('qntrlEmailTemplatesResult', handleEmailTemplatesResult); // --- MODIFICATION ---
    
    return () => {
      socket.off('apiStatusResult', handleApiStatus);
      socket.off('qntrlEmailTemplatesResult', handleEmailTemplatesResult); // --- MODIFICATION ---
    };
  }, [socket, toast]);

  useEffect(() => {
    if (activeProfileName && socket?.connected) {
      setApiStatus({ status: 'loading', message: 'Checking API connection...' });
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'qntrl' });
    }
  }, [activeProfileName, socket]);

  const handleProfileChange = (profileName: string) => {
    setActiveProfileName(profileName);
    setEmailTemplates(null); // Clear old results
    toast({ title: "Profile Changed", description: `Switched to ${profileName}` });
  };
  
  const handleManualVerify = () => {
    if (!socket || !activeProfileName) return;
    setApiStatus({ status: 'loading', message: 'Checking API connection...', fullResponse: null });
    socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'qntrl' });
    toast({ title: "Re-checking Connection..." });
  };

  // --- MODIFICATION: Added handler for new button ---
  const handleFetchEmailTemplates = () => {
    if (!socket || !activeProfileName) {
        toast({ title: "Error", description: "Not connected or no profile selected.", variant: "destructive"});
        return;
    }
    setIsLoadingTemplates(true);
    setEmailTemplates(null);
    toast({ title: "Fetching Email Templates..." });
    socket.emit('getQntrlEmailTemplates', { selectedProfileName: activeProfileName });
  };
  // --- END MODIFICATION ---

  return (
    <>
      <DashboardLayout
        onAddProfile={onAddProfile}
        profiles={qntrlProfiles}
        selectedProfile={selectedProfile}
        jobs={{}} // No jobs on this page
        onProfileChange={handleProfileChange}
        apiStatus={apiStatus}
        onShowStatus={() => setIsStatusModalOpen(true)}
        onManualVerify={handleManualVerify}
        socket={socket}
        onEditProfile={onEditProfile}
        onDeleteProfile={onDeleteProfile}
      >
        <div className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Network className="h-5 w-5 text-primary" />
                        <span>Zoho Qntrl Connection Test</span>
                    </CardTitle>
                    <CardDescription>
                        This page is for testing your Zoho Qntrl API connection.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>
                        Use the Profile Selector to check the base connection. If it is "Success", your token is valid.
                    </p>
                </CardContent>
            </Card>

            {/* --- MODIFICATION HERE: Added new Card --- */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                        <Mail className="h-5 w-5 text-primary" />
                        <span>Test: Get Email Templates</span>
                    </CardTitle>
                    <CardDescription>
                        Click this button to test the `Qntrl.emailtemplate.READ` scope and fetch all email templates.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button 
                        onClick={handleFetchEmailTemplates} 
                        disabled={isLoadingTemplates || !selectedProfile || apiStatus.status !== 'success'}
                    >
                        {isLoadingTemplates ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Mail className="mr-2 h-4 w-4" />
                        )}
                        Fetch Email Templates
                    </Button>
                    
                    {emailTemplates && (
                        <div>
                            <h4 className="text-sm font-semibold mb-2 text-foreground">Response from `/emailin`:</h4>
                            <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-foreground border max-h-96 overflow-y-auto">
                                {JSON.stringify(emailTemplates, null, 2)}
                            </pre>
                        </div>
                    )}
                </CardContent>
            </Card>
            {/* --- END MODIFICATION --- */}

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

export default QntrlTestPage;