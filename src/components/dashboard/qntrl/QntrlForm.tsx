import React, { useState, useEffect, useMemo, useCallback } from 'react'; // --- FIX: Added useCallback ---
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Send, Users, Clock, Network, Pause, Play, Square, CheckCircle2, XCircle, Loader2, FileText } from 'lucide-react';
import { QntrlFormData, QntrlJobState, Profile } from '@/App';
import { formatTime } from '@/lib/utils';
import { Socket } from 'socket.io-client';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// --- Types for Form/Layout Details ---
interface QntrlLayout {
    layout_id: string;
    layout_name: string;
}
interface FormFieldDetail {
  alias_name: string;
  column_name: string;
}
interface SectionField {
  customfield_details: FormFieldDetail[];
}
interface FormSection {
  sectionfieldmap_details: SectionField[];
}
interface FormDetails {
  section_details: FormSection[];
}
// --- End Types ---

interface QntrlFormProps {
  onSubmit: (data: { layout_id: string; email_key: string; }) => void;
  isProcessing: boolean;
  isPaused: boolean;
  onPauseResume: () => void;
  onEndJob: () => void;
  formData: QntrlFormData;
  onFormDataChange: (data: QntrlFormData) => void;
  jobState: QntrlJobState | null;
  socket: Socket | null;
  profile: Profile | null;
}

export const QntrlForm: React.FC<QntrlFormProps> = ({
  onSubmit,
  isProcessing,
  isPaused,
  onPauseResume,
  onEndJob,
  formData,
  onFormDataChange,
  jobState,
  socket,
  profile
}) => {
  const { toast } = useToast();
  
  // --- State for Layout/Form selection ---
  const [layouts, setLayouts] = useState<QntrlLayout[] | null>(null);
  const [isLoadingForms, setIsLoadingForms] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<string>('');
  const [formDetails, setFormDetails] = useState<FormDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [apiError, setApiError] = useState<any>(null);
  // --- End State ---

  const emailCount = formData.emails.split('\n').filter(email => email.trim() !== '').length;

  const handleInputChange = (field: keyof QntrlFormData, value: string | number) => {
    onFormDataChange({ ...formData, [field]: value });
  };

  const successCount = jobState?.results.filter(r => r.success).length || 0;
  const errorCount = jobState?.results.filter(r => r.success === false).length || 0;

  // --- Logic to find Email Field ---
  const emailField = useMemo(() => {
    if (!formDetails || !Array.isArray(formDetails.section_details)) {
      return null;
    }
    for (const section of formDetails.section_details) {
      if (section && Array.isArray(section.sectionfieldmap_details)) { 
        for (const field of section.sectionfieldmap_details) { 
          if (field && Array.isArray(field.customfield_details) && field.customfield_details[0]) {
            if (field.customfield_details[0].alias_name === 'email') {
              return {
                alias_name: field.customfield_details[0].alias_name,
                column_name: field.customfield_details[0].column_name,
              };
            }
          }
        }
      }
    }
    return null;
  }, [formDetails]);
  // --- End Logic ---
  
  // --- Socket Handlers for Form/Layouts ---
  const handleFetchForms = useCallback(() => { 
    if (!socket || !profile) return;
    setIsLoadingForms(true);
    setLayouts(null);
    setApiError(null);
    setSelectedLayout('');
    setFormDetails(null);
    socket.emit('getQntrlForms', { selectedProfileName: profile.profileName });
  }, [socket, profile]);

  useEffect(() => {
    if (!socket) return;
    
    const handleFormsResult = (result: any) => {
        setIsLoadingForms(false);
        if (result.success) {
            setLayouts(result.data);
            setApiError(null);
        } else {
            setLayouts(null);
            setApiError({ error: result.error, fullResponse: result.fullResponse });
            toast({ title: "Error", description: result.error, variant: "destructive" });
        }
    };
    
    const handleFormDetailsResult = (result: any) => {
        setIsLoadingDetails(false);
        if (result.success) {
            setFormDetails(result.data);
            setApiError(null);
        } else {
            setFormDetails(null);
            setApiError({ error: result.error, fullResponse: result.fullResponse });
            toast({ title: "Error fetching form details", description: result.error, variant: "destructive" });
        }
    };

    socket.on('qntrlFormsResult', handleFormsResult);
    socket.on('qntrlFormDetailsResult', handleFormDetailsResult);
    
    return () => {
      socket.off('qntrlFormsResult', handleFormsResult);
      socket.off('qntrlFormDetailsResult', handleFormDetailsResult);
    };
  }, [socket, toast]);
  
  useEffect(() => {
    if (profile && socket?.connected) {
        handleFetchForms();
    }
  }, [profile, socket, handleFetchForms]);
  
  const handleLayoutChange = (layoutId: string) => {
    setSelectedLayout(layoutId);
    setFormDetails(null); 
    setApiError(null);

    if (layoutId && socket && profile) {
      setIsLoadingDetails(true);
      socket.emit('getQntrlFormDetails', {
        selectedProfileName: profile.profileName,
        layout_id: layoutId
      });
    }
  };
  // --- End Socket Handlers ---

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLayout || !emailField) {
        toast({ title: "Configuration Error", description: "A form must be selected and an 'email' field must be found.", variant: "destructive"});
        return;
    }
    onSubmit({
        layout_id: selectedLayout,
        email_key: emailField.column_name
    });
  };


  return (
    <Card className="shadow-medium hover:shadow-large transition-all duration-300">
      <CardHeader>
        <div className="flex items-center space-x-2">
          <Network className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg">Bulk Create Qntrl Cards</CardTitle>
        </div>
        <CardDescription>
          Create multiple cards in a Qntrl form from a list of emails.
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Emails & Job Stats */}
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emails" className="flex items-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Card Emails</span>
                  </Label>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {emailCount} cards
                  </Badge>
                </div>
                <Textarea
                  id="emails"
                  placeholder="user1@example.com&#x0A;user2@example.com&#x0A;user3@example.com"
                  value={formData.emails}
                  onChange={(e) => handleInputChange('emails', e.target.value)}
                  className="min-h-[200px] font-mono text-sm bg-muted/30 border-border focus:bg-card transition-colors"
                  required
                  disabled={isProcessing}
                />
                <p className="text-xs text-muted-foreground">
                  Enter one email address per line.
                </p>
              </div>
              
              {jobState && (jobState.isProcessing || jobState.results.length > 0) && (
                <div className="pt-4 border-t border-dashed">
                    <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <Label className="text-xs text-muted-foreground">Time Elapsed</Label>
                            <p className="text-lg font-bold font-mono">{formatTime(jobState.processingTime)}</p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Success</Label>
                            <p className="text-lg font-bold font-mono text-success flex items-center justify-center space-x-1">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>{successCount}</span>
                            </p>
                        </div>
                        <div>
                            <Label className="text-xs text-muted-foreground">Failed</Label>
                            <p className="text-lg font-bold font-mono text-destructive flex items-center justify-center space-x-1">
                                <XCircle className="h-4 w-4" />
                                <span>{errorCount}</span>
                            </p>
                        </div>
                    </div>
                </div>
              )}
            </div>

            {/* Column 2: Form Config & Inputs */}
            <div className="space-y-4">
                <div className="flex items-end gap-4">
                    <div className="flex-1 space-y-2">
                        <Label htmlFor="layout-select">Available Forms (Layouts)</Label>
                        {isLoadingForms ? (
                            <div className="flex items-center space-x-2 text-muted-foreground h-10 px-3">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>Loading forms...</span>
                            </div>
                        ) : (
                            <Select value={selectedLayout} onValueChange={handleLayoutChange} disabled={isProcessing}>
                                <SelectTrigger id="layout-select" className="w-full">
                                    <SelectValue placeholder="Select a form..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {layouts?.map((layout) => (
                                        <SelectItem key={layout.layout_id} value={layout.layout_id}>
                                            {layout.layout_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        )}
                    </div>
                    <Button 
                        type="button"
                        variant="outline"
                        onClick={handleFetchForms} 
                        disabled={isLoadingForms || isProcessing || !profile}
                        className="h-10"
                    >
                        <FileText className="h-4 w-4" />
                    </Button>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="email-column-name">Email Field Column Name</Label>
                    {isLoadingDetails ? (
                        <div className="flex items-center space-x-2 text-muted-foreground h-10 px-3">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Verifying...</span>
                        </div>
                    ) : (
                        <Input
                            id="email-column-name"
                            readOnly
                            value={selectedLayout ? (emailField ? emailField.column_name : "No field with alias 'email' found.") : "Select a form first"}
                            className={cn(
                                "font-mono",
                                !emailField && "text-muted-foreground italic"
                            )}
                        />
                    )}
                </div>

              <div className="space-y-2">
                <Label htmlFor="title">Card Title (for all cards)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Enter a title"
                  disabled={isProcessing}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="delay" className="flex items-center space-x-2">
                  <Clock className="h-4 w-4" />
                  <span>Delay Between Cards</span>
                </Label>
                <div className="flex items-center space-x-3">
                  <Input
                    id="delay"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.delay}
                    onChange={(e) => handleInputChange('delay', parseInt(e.target.value) || 0)}
                    className="w-24 h-12 bg-muted/30 border-border focus:bg-card transition-colors"
                    required
                    disabled={isProcessing}
                  />
                  <span className="text-sm text-muted-foreground">seconds</span>
                </div>
              </div>

              {apiError && (
                <div className="pt-4">
                    <h4 className="text-sm font-semibold mb-2 text-destructive">API Error:</h4>
                    <pre className="bg-muted p-4 rounded-lg text-xs font-mono text-destructive border-destructive/50 border max-h-40 overflow-y-auto">
                        {JSON.stringify(apiError, null, 2)}
                    </pre>
                </div>
              )}

            </div>
          </div>

          <div className="pt-4 border-t border-border">
              {!isProcessing ? (
                <Button
                    type="submit"
                    variant="premium"
                    size="lg"
                    disabled={!formData.emails.trim() || !formData.title.trim() || !selectedLayout || !emailField}
                    className="w-full"
                >
                    <Send className="h-4 w-4 mr-2" />
                    Create {emailCount} Cards
                </Button>
              ) : (
                <div className="flex items-center justify-center space-x-4">
                    <Button
                        type="button"
                        variant="secondary"
                        size="lg"
                        onClick={onPauseResume}
                        className="flex-1"
                    >
                        {isPaused ? (
                            <><Play className="h-4 w-4 mr-2" />Resume Job</>
                        ) : (
                            <><Pause className="h-4 w-4 mr-2" />Pause Job</>
                        )}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="lg"
                        onClick={onEndJob}
                        className="flex-1"
                    >
                        <Square className="h-4 w-4 mr-2" />
                        End Job
                    </Button>
                </div>
              )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
};