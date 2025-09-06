import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Socket } from 'socket.io-client';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, Trash2, UserX } from 'lucide-react';
import { Profile } from '@/App';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

type ApiStatus = {
  status: 'loading' | 'success' | 'error';
  message: string;
  fullResponse?: any;
};

interface CatalystUser {
  user_id: string;
  first_name: string;
  last_name: string;
  email_id: string;
  status: string;
  role_details: {
    role_name: string;
  };
}


interface ManageUsersProps {
  onAddProfile: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profileName: string) => void;
  socket: Socket | null;
}

const SERVER_URL = "http://localhost:3000";

const ManageUsers: React.FC<ManageUsersProps> = ({ onAddProfile, onEditProfile, onDeleteProfile, socket }) => {
  const { toast } = useToast();
  const [activeProfileName, setActiveProfileName] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<ApiStatus>({ status: 'loading', message: 'Connecting...' });
  const [users, setUsers] = useState<CatalystUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      setUsers([]);
      socket.emit('catalyst:getAllUsers', { selectedProfileName: activeProfileName });
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
    
    socket.on('catalyst:usersResult', (data) => {
      setIsLoading(false);
      if (data.success) {
        setUsers(data.users);
      } else {
        toast({ title: "Error Fetching Users", description: data.error, variant: "destructive" });
      }
    });

    socket.on('catalyst:usersDeletedResult', (data) => {
        setIsDeleting(false);
        setSelectedUsers([]);
        if (data.success) {
            toast({ title: "Users Deleted", description: `${data.deletedCount} user(s) have been deleted.` });
            fetchUsers();
        } else {
            toast({ title: "Error Deleting Users", description: data.error, variant: "destructive" });
        }
    });

    return () => {
      socket.off('apiStatusResult');
      socket.off('catalyst:usersResult');
      socket.off('catalyst:usersDeletedResult');
    };
  }, [socket, toast, fetchUsers]);
  
  useEffect(() => {
    if (catalystProfiles.length > 0 && !activeProfileName) {
      setActiveProfileName(catalystProfiles[0].profileName);
    }
  }, [catalystProfiles, activeProfileName]);

  useEffect(() => {
    if (activeProfileName) {
      checkApiStatus();
      fetchUsers();
    }
  }, [activeProfileName, checkApiStatus, fetchUsers]);


  const handleProfileChange = (profileName: string) => {
    setActiveProfileName(profileName);
  };

  const handleManualVerify = () => {
    checkApiStatus();
  };

  const handleSelectUser = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    const validUsers = users.filter(user => user && user.user_id);
    if (selectedUsers.length === validUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(validUsers.map(u => u.user_id));
    }
  };

  const handleDelete = () => {
    if (selectedUsers.length > 0 && socket?.connected) {
        setShowDeleteConfirm(false);
        setIsDeleting(true);
        socket.emit('catalyst:deleteUsers', { selectedProfileName: activeProfileName, userIds: selectedUsers });
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
                <CardTitle>Manage Catalyst Users</CardTitle>
                <CardDescription>View, search, and delete users in your project.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between mb-4">
                  <div>
                    {/* Search bar can be added here */}
                  </div>
                   <div className="flex gap-2">
                    <Button onClick={() => setShowDeleteConfirm(true)} disabled={selectedUsers.length === 0 || isDeleting} variant="destructive">
                      {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                      Delete ({selectedUsers.length})
                    </Button>
                    <Button onClick={fetchUsers} disabled={isLoading}>
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Refresh
                    </Button>
                  </div>
                </div>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedUsers.length > 0 && selectedUsers.length === users.filter(u => u && u.user_id).length}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>First Name</TableHead>
                      <TableHead>Last Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            </TableRow>
                        ))
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center">
                          <UserX className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          No users found in this project.
                        </TableCell>
                      </TableRow>
                    ) : users.map((user, index) => {
                      if (!user || !user.user_id) {
                        return null; // Skip rendering invalid user objects
                      }
                      return (
                      <TableRow key={`${user.user_id}-${index}`} data-state={selectedUsers.includes(user.user_id) && "selected"}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUsers.includes(user.user_id)}
                            onCheckedChange={() => handleSelectUser(user.user_id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{user.email_id}</TableCell>
                        <TableCell>{user.first_name}</TableCell>
                        <TableCell>{user.last_name}</TableCell>
                        <TableCell>{user.role_details.role_name}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === 'ACTIVE' ? 'success' : 'secondary'}>{user.status}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </DashboardLayout>

        <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>API Connection Status</DialogTitle>
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
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                        This will permanently delete {selectedUsers.length} user(s). This action cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </>
  );
};

export default ManageUsers;