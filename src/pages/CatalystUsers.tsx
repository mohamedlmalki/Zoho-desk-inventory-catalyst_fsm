import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, Loader2, Users } from 'lucide-react';
import { Profile } from '@/App';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ApiStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
  fullResponse?: any;
};

interface CatalystUser {
    user_id: string; // Changed to string
    first_name: string;
    last_name: string;
    email_id: string;
    created_time: string;
    is_confirmed: boolean;
    status: string;
}

interface CatalystUsersProps {
  socket: Socket | null;
  onAddProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profileName: string) => void;
}

const SERVER_URL = "http://localhost:3000";

const CatalystUsers: React.FC<CatalystUsersProps> = ({ socket, onAddProfile, onEditProfile, onDeleteProfile }) => {
  const { toast } = useToast();
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'loading', message: 'Connecting to server...' });
  const [users, setUsers] = useState<CatalystUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const { data: profiles = [] } = useQuery<Profile[]>({
    queryKey: ['profiles'],
    queryFn: async () => {
      const response = await fetch(`${SERVER_URL}/api/profiles`);
      if (!response.ok) throw new Error('Could not connect to the server.');
      return response.json();
    },
    refetchOnWindowFocus: false,
  });

  const catalystProfiles = profiles.filter(p => p.catalyst?.projectId);
  const selectedProfile = catalystProfiles.find(p => p.profileName === activeProfileName) || null;

  const fetchUsers = useCallback(() => {
    if (activeProfileName && socket?.connected) {
      setIsLoading(true);
      socket.emit('getUsers', { 
          selectedProfileName: activeProfileName, 
          page: 1,
          per_page: 200,
        });
    }
  }, [activeProfileName, socket]);
  
  const checkApiStatus = useCallback(() => {
    if (activeProfileName && socket?.connected) {
      setApiStatus({ status: 'loading', message: 'Checking API connection...' });
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'catalyst' });
    }
  }, [activeProfileName, socket]);

  useEffect(() => {
    if (!socket) return;

    socket.on('apiStatusResult', (result) => setApiStatus({
      status: result.success ? 'success' : 'error',
      message: result.message,
      fullResponse: result.fullResponse || null
    }));
    
    socket.on('usersResult', (data) => {
      setIsLoading(false);
      if (data.success) {
        setUsers(data.users);
      } else {
        toast({ title: "Error fetching users", description: data.error, variant: "destructive" });
      }
    });

    socket.on('userDeletedResult', (data) => {
        if (data.success) {
            toast({ title: "User Deleted", description: `User ${data.data.email_id} has been deleted.` });
            fetchUsers();
        } else {
            toast({ title: "Error Deleting User", description: data.error, variant: "destructive" });
        }
    });

    return () => {
      socket.off('apiStatusResult');
      socket.off('usersResult');
      socket.off('userDeletedResult');
    };
  }, [socket, toast, fetchUsers]);

  useEffect(() => {
    if (activeProfileName && socket?.connected) {
      setApiStatus({ status: 'loading', message: 'Checking API connection...' });
      socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'catalyst' });
      fetchUsers();
    }
  }, [activeProfileName, socket, fetchUsers]);
  
  useEffect(() => {
    if (catalystProfiles.length > 0 && !activeProfileName) {
      setActiveProfileName(catalystProfiles[0].profileName);
    }
  }, [catalystProfiles, activeProfileName]);

  const handleProfileChange = (profileName: string) => {
    setActiveProfileName(profileName);
  };

  const handleManualVerify = () => {
    if (activeProfileName && socket?.connected) {
        toast({ title: "Re-checking Connection..." });
        setApiStatus({ status: 'loading', message: 'Checking API connection...' });
        socket.emit('checkApiStatus', { selectedProfileName: activeProfileName, service: 'catalyst' });
    }
  };

  const handleDelete = (user: CatalystUser) => {
    console.log("Deleting user:", user);
    if (socket?.connected) {
        socket.emit('deleteUser', { selectedProfileName: activeProfileName, userId: user.user_id });
    }
  };

  return (
      <>
        <DashboardLayout
            onAddProfile={onAddProfile}
            profiles={catalystProfiles}
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
            <Card>
              <CardHeader>
                <CardTitle>Catalyst Users</CardTitle>
                <CardDescription>Manage users in your Catalyst project.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-end mb-4">
                    <Button onClick={fetchUsers} disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Refresh
                    </Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Confirmed</TableHead>
                      <TableHead>Created Time</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={6} className="text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                </TableCell>
                            </TableRow>
                        ))
                    ) : users.map(user => (
                      <TableRow key={user.user_id}>
                        <TableCell>{user.first_name} {user.last_name}</TableCell>
                        <TableCell>{user.email_id}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>{user.status}</Badge>
                        </TableCell>
                        <TableCell>{user.is_confirmed ? 'Yes' : 'No'}</TableCell>
                        <TableCell>{user.created_time}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user {user.email_id}. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(user)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>
      </>
  );
};

export default CatalystUsers;