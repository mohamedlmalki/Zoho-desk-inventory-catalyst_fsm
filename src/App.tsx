import React, { useState, useEffect, useRef } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { io, Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import Index from "@/pages/Index";
import NotFound from "@/pages/NotFound";
import SingleTicket from "@/pages/SingleTicket";
import { ProfileModal } from '@/components/dashboard/ProfileModal';
import BulkInvoices from '@/pages/BulkInvoices';
import SingleInvoice from '@/pages/SingleInvoice';
import EmailStatics from '@/pages/EmailStatics';
import { InvoiceResult } from '@/components/dashboard/inventory/InvoiceResultsDisplay';
import { useJobTimer } from '@/hooks/useJobTimer';
import BulkSignup from './pages/BulkSignup';
import SingleSignup from './pages/SingleSignup';
import CatalystUsers from './pages/CatalystUsers';
import BulkEmail from './pages/BulkEmail'; 
import { EmailResult } from './components/dashboard/catalyst/EmailResultsDisplay'; 
import BulkQntrlCards from './pages/BulkQntrlCards'; // --- MODIFICATION: Renamed import ---

const queryClient = new QueryClient();
const SERVER_URL = "http://localhost:3000";

// --- Interfaces ---
export interface TicketFormData {
  emails: string;
  subject: string;
  description: string;
  delay: number;
  sendDirectReply: boolean;
  verifyEmail: boolean;
  displayName: string;
}

export interface InvoiceFormData {
  emails: string;
  subject: string;
  body: string;
  delay: number;
  displayName: string;
  sendCustomEmail: boolean;
  sendDefaultEmail: boolean;
}

export interface EmailFormData {
    emails: string;
    subject: string;
    content: string;
    delay: number;
	displayName: string; 
}
export interface EmailJobState {
    formData: EmailFormData;
    results: EmailResult[];
    isProcessing: boolean;
    isPaused: boolean;
    isComplete: boolean;
    processingStartTime: Date | null;
    processingTime: number;
    totalToProcess: number;
    countdown: number;
    currentDelay: number;
    filterText: string;
}
export interface EmailJobs {
    [profileName: string]: EmailJobState;
}

export interface TicketResult {
  email: string;
  success: boolean;
  ticketNumber?: string;
  details?: string;
  error?: string;
  fullResponse?: any;
}

export interface CatalystSignupFormData {
  emails: string;
  firstName: string;
  lastName: string;
  delay: number;
}
export interface CatalystResult {
  email: string;
  success: boolean;
  details?: string;
  error?: string;
  fullResponse?: any;
}
export interface CatalystJobState {
    formData: CatalystSignupFormData;
    results: CatalystResult[];
    isProcessing: boolean;
    isPaused: boolean;
    isComplete: boolean;
    processingStartTime: Date | null;
    processingTime: number;
    totalToProcess: number;
    countdown: number;
    currentDelay: number;
    filterText: string;
}
export interface CatalystJobs {
    [profileName: string]: CatalystJobState;
}

// --- MODIFICATION: Added Qntrl Job Types ---
export interface QntrlFormData {
  emails: string;
  title: string;
  delay: number;
}
export interface QntrlResult {
  email: string;
  success: boolean;
  details?: string;
  error?: string;
  fullResponse?: any;
}
export interface QntrlJobState {
    formData: QntrlFormData;
    results: QntrlResult[];
    isProcessing: boolean;
    isPaused: boolean;
    isComplete: boolean;
    processingStartTime: Date | null;
    processingTime: number;
    totalToProcess: number;
    countdown: number;
    currentDelay: number;
    filterText: string;
}
export interface QntrlJobs {
    [profileName: string]: QntrlJobState;
}
// --- END MODIFICATION ---


export interface JobState {
  formData: TicketFormData;
  results: TicketResult[];
  isProcessing: boolean;
  isPaused: boolean;
  isComplete: boolean;
  processingStartTime: Date | null;
  processingTime: number; 
  totalTicketsToProcess: number;
  countdown: number;
  currentDelay: number;
  filterText: string;
}

export interface InvoiceJobState {
  formData: InvoiceFormData;
  results: InvoiceResult[];
  isProcessing: boolean;
  isPaused: boolean;
  isComplete: boolean;
  processingStartTime: Date | null;
  processingTime: number; 
  totalToProcess: number;
  countdown: number;
  currentDelay: number;
  filterText: string;
}

export interface Jobs {
  [profileName: string]: JobState;
}

export interface InvoiceJobs {
    [profileName: string]: InvoiceJobState;
}

export interface Profile {
  profileName: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  desk?: {
    orgId: string;
    defaultDepartmentId: string;
    fromEmailAddress?: string;
    mailReplyAddressId?: string;
  };
  inventory?: {
    orgId: string;
  };
  catalyst?: {
    projectId: string;
    fromEmail?: string; 
  };
  qntrl?: {
    orgId: string; 
  };
}


const createInitialJobState = (): JobState => ({
  formData: {
    emails: '',
    subject: '',
    description: '',
    delay: 1,
    sendDirectReply: false,
    verifyEmail: false,
    displayName: '',
  },
  results: [],
  isProcessing: false,
  isPaused: false,
  isComplete: false,
  processingStartTime: null,
  processingTime: 0,
  totalTicketsToProcess: 0,
  countdown: 0,
  currentDelay: 1,
  filterText: '',
});

const createInitialInvoiceJobState = (): InvoiceJobState => ({
    formData: {
        emails: '',
        subject: '',
        body: '',
        delay: 1,
        displayName: '',
        sendCustomEmail: false,
        sendDefaultEmail: false,
    },
    results: [],
    isProcessing: false,
    isPaused: false,
    isComplete: false,
    processingStartTime: null,
    processingTime: 0,
    totalToProcess: 0,
    countdown: 0,
    currentDelay: 1,
    filterText: '',
});

const createInitialCatalystJobState = (): CatalystJobState => ({
    formData: {
        emails: '',
        firstName: '',
        lastName: '',
        delay: 1,
    },
    results: [],
    isProcessing: false,
    isPaused: false,
    isComplete: false,
    processingStartTime: null,
    processingTime: 0,
    totalToProcess: 0,
    countdown: 0,
    currentDelay: 1,
    filterText: '',
});

const createInitialEmailJobState = (): EmailJobState => ({
    formData: {
        emails: '',
        subject: '',
        content: '',
        delay: 1,
		displayName: '', 
    },
    results: [],
    isProcessing: false,
    isPaused: false,
    isComplete: false,
    processingStartTime: null,
    processingTime: 0,
    totalToProcess: 0,
    countdown: 0,
    currentDelay: 1,
    filterText: '',
});

// --- MODIFICATION: Added Qntrl Initial State ---
const createInitialQntrlJobState = (): QntrlJobState => ({
    formData: {
        emails: '',
        title: '',
        delay: 1,
    },
    results: [],
    isProcessing: false,
    isPaused: false,
    isComplete: false,
    processingStartTime: null,
    processingTime: 0,
    totalToProcess: 0,
    countdown: 0,
    currentDelay: 1,
    filterText: '',
});
// --- END MODIFICATION ---

const MainApp = () => {
    const { toast } = useToast();
    const [jobs, setJobs] = useState<Jobs>({});
    const [invoiceJobs, setInvoiceJobs] = useState<InvoiceJobs>({});
    const [catalystJobs, setCatalystJobs] = useState<CatalystJobs>({}); 
    const [emailJobs, setEmailJobs] = useState<EmailJobs>({}); 
    const [qntrlJobs, setQntrlJobs] = useState<QntrlJobs>({}); // --- MODIFICATION ---
    const socketRef = useRef<Socket | null>(null);
    const queryClient = useQueryClient();

    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

    useJobTimer(jobs, setJobs, 'ticket');
    useJobTimer(invoiceJobs, setInvoiceJobs, 'invoice');
    useJobTimer(catalystJobs, setCatalystJobs, 'catalyst'); 
    useJobTimer(emailJobs, setEmailJobs, 'email'); 
    useJobTimer(qntrlJobs, setQntrlJobs, 'qntrl'); // --- MODIFICATION ---

    useEffect(() => {
        const socket = io(SERVER_URL);
        socketRef.current = socket;

        socket.on('connect', () => {
            toast({ title: "Connected to server!" });
        });
        
        socket.on('ticketResult', (result: TicketResult & { profileName: string }) => {
          setJobs(prevJobs => {
            const profileJob = prevJobs[result.profileName];
            if (!profileJob) return prevJobs;
            const isLastTicket = profileJob.results.length + 1 >= profileJob.totalTicketsToProcess;
            return {
              ...prevJobs,
              [result.profileName]: {
                ...profileJob,
                results: [...profileJob.results, result],
                countdown: isLastTicket ? 0 : profileJob.currentDelay,
              }
            };
          });
        });

        socket.on('ticketUpdate', (updateData) => {
          setJobs(prevJobs => {
            if (!prevJobs[updateData.profileName]) return prevJobs;
            return {
              ...prevJobs,
              [updateData.profileName]: {
                ...prevJobs[updateData.profileName],
                results: prevJobs[updateData.profileName].results.map(r => 
                  r.ticketNumber === updateData.ticketNumber ? { ...r, success: updateData.success, details: updateData.details, fullResponse: updateData.fullResponse } : r
                )
              }
            }
          });
        });

        socket.on('invoiceResult', (result: InvoiceResult & { profileName: string }) => {
            setInvoiceJobs(prevJobs => {
                const profileJob = prevJobs[result.profileName];
                if (!profileJob) return prevJobs;

                const newResults = [...profileJob.results];
                const existingIndex = newResults.findIndex(r => r.rowNumber === result.rowNumber);
                if (existingIndex > -1) {
                    newResults[existingIndex] = { ...newResults[existingIndex], ...result };
                } else {
                    newResults.push(result);
                }
                newResults.sort((a, b) => a.rowNumber - b.rowNumber);
                
                const isLast = newResults.length >= profileJob.totalToProcess;

                return {
                    ...prevJobs,
                    [result.profileName]: {
                        ...profileJob,
                        results: newResults,
                        countdown: isLast ? 0 : profileJob.currentDelay,
                    }
                };
            });
        });

        socket.on('catalystResult', (result: CatalystResult & { profileName: string }) => {
          setCatalystJobs(prevJobs => {
            const profileJob = prevJobs[result.profileName];
            if (!profileJob) return prevJobs;
            const isLast = profileJob.results.length + 1 >= profileJob.totalToProcess;
            return {
              ...prevJobs,
              [result.profileName]: {
                ...profileJob,
                results: [...profileJob.results, result],
                countdown: isLast ? 0 : profileJob.currentDelay,
              }
            };
          });
        });

        socket.on('emailResult', (result: EmailResult & { profileName: string }) => {
          setEmailJobs(prevJobs => {
            const profileJob = prevJobs[result.profileName];
            if (!profileJob) return prevJobs;
            const isLast = profileJob.results.length + 1 >= profileJob.totalToProcess;
            return {
              ...prevJobs,
              [result.profileName]: {
                ...profileJob,
                results: [...profileJob.results, result],
                countdown: isLast ? 0 : profileJob.currentDelay,
              }
            };
          });
        });
        
        // --- MODIFICATION: Added Qntrl Result Listener ---
        socket.on('qntrlResult', (result: QntrlResult & { profileName: string }) => {
          setQntrlJobs(prevJobs => {
            const profileJob = prevJobs[result.profileName];
            if (!profileJob) return prevJobs;
            const isLast = profileJob.results.length + 1 >= profileJob.totalToProcess;
            return {
              ...prevJobs,
              [result.profileName]: {
                ...profileJob,
                results: [...profileJob.results, result],
                countdown: isLast ? 0 : profileJob.currentDelay,
              }
            };
          });
        });
        // --- END MODIFICATION ---


        const handleJobCompletion = (data: {profileName: string, jobType: 'ticket' | 'invoice' | 'catalyst' | 'email' | 'qntrl'}, title: string, description: string, variant?: "destructive") => {
            const { profileName, jobType } = data;
            const updater = (prev: any) => {
                if (!prev[profileName]) return prev;
                return { ...prev, [profileName]: { ...prev[profileName], isProcessing: false, isPaused: false, isComplete: true, countdown: 0 }};
            };

            if (jobType === 'ticket') {
                setJobs(updater);
            } else if (jobType === 'invoice') {
                setInvoiceJobs(updater);
            } else if (jobType === 'catalyst') { 
                setCatalystJobs(updater);
            } else if (jobType === 'email') { 
                setEmailJobs(updater);
            } else if (jobType === 'qntrl') { // --- MODIFICATION ---
                setQntrlJobs(updater);
            }
            toast({ title, description, variant });
        };

        socket.on('bulkComplete', (data) => handleJobCompletion(data, `Processing Complete for ${data.profileName}!`, "All items for this profile have been processed."));
        socket.on('bulkEnded', (data) => handleJobCompletion(data, `Job Ended for ${data.profileName}`, "The process was stopped by the user.", "destructive"));
        socket.on('bulkError', (data) => handleJobCompletion(data, `Server Error for ${data.profileName}`, data.message, "destructive"));

        return () => {
          socket.disconnect();
        };
    }, [toast]);
    
    const handleOpenAddProfile = () => {
        setEditingProfile(null);
        setIsProfileModalOpen(true);
    };

    const handleOpenEditProfile = (profile: Profile) => {
        setEditingProfile(profile);
        setIsProfileModalOpen(true);
    };
    
    const handleSaveProfile = async (profileData: Profile, originalProfileName?: string) => {
        const isEditing = !!originalProfileName;
        const url = isEditing ? `${SERVER_URL}/api/profiles/${encodeURIComponent(originalProfileName)}` : `${SERVER_URL}/api/profiles`;
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profileData),
            });
            const result = await response.json();
            if (result.success) {
                toast({ title: `Profile ${isEditing ? 'updated' : 'added'} successfully!` });
                queryClient.invalidateQueries({ queryKey: ['profiles'] });
                setIsProfileModalOpen(false);
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save profile.', variant: 'destructive' });
        }
    };

    const handleDeleteProfile = async (profileNameToDelete: string) => {
        try {
            const response = await fetch(`${SERVER_URL}/api/profiles/${encodeURIComponent(profileNameToDelete)}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (result.success) {
                toast({ title: `Profile "${profileNameToDelete}" deleted successfully!` });
                await queryClient.invalidateQueries({ queryKey: ['profiles'] });
            } else {
                toast({ title: 'Error', description: result.error, variant: 'destructive' });
            }
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete profile.', variant: 'destructive' });
        }
    };


    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={
                            <Index
                                jobs={jobs}
                                setJobs={setJobs}
                                socket={socketRef.current}
                                createInitialJobState={createInitialJobState}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/single-ticket"
                        element={
                            <SingleTicket 
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/bulk-invoices"
                        element={
                           <BulkInvoices
                                jobs={invoiceJobs}
                                setJobs={setInvoiceJobs}
                                socket={socketRef.current}
                                createInitialJobState={createInitialInvoiceJobState}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                           />
                        }
                    />
                    <Route
                        path="/single-invoice"
                        element={
                            <SingleInvoice
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                     <Route
                        path="/email-statics"
                        element={
                            <EmailStatics
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/bulk-signup"
                        element={
                            <BulkSignup
                                jobs={catalystJobs}
                                setJobs={setCatalystJobs}
                                socket={socketRef.current}
                                createInitialJobState={createInitialCatalystJobState}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/single-signup"
                        element={
                            <SingleSignup
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/catalyst-users"
                        element={
                            <CatalystUsers
                                socket={socketRef.current}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    <Route
                        path="/bulk-email"
                        element={
                            <BulkEmail
                                jobs={emailJobs}
                                setJobs={setEmailJobs}
                                socket={socketRef.current}
                                createInitialJobState={createInitialEmailJobState}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    
                    {/* --- MODIFICATION HERE --- */}
                    <Route
                        path="/qntrl-forms" 
                        element={
                            <BulkQntrlCards
                                jobs={qntrlJobs}
                                setJobs={setQntrlJobs}
                                socket={socketRef.current}
                                createInitialJobState={createInitialQntrlJobState}
                                onAddProfile={handleOpenAddProfile}
                                onEditProfile={handleOpenEditProfile}
                                onDeleteProfile={handleDeleteProfile}
                            />
                        }
                    />
                    {/* --- END MODIFICATION --- */}
                    
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </BrowserRouter>
            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSave={handleSaveProfile}
                profile={editingProfile}
                socket={socketRef.current}
            />
        </>
    );
};

const App = () => (
    <QueryClientProvider client={queryClient}>
        <TooltipProvider>
            <Toaster />
            <Sonner />
            <MainApp />
        </TooltipProvider>
    </QueryClientProvider>
);

export default App;