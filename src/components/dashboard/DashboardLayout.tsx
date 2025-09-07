import React from 'react';
import { NavLink } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Ticket, UserPlus, Package, BarChart3, Cloud, Users } from 'lucide-react'; 
import { cn } from '@/lib/utils';
import { ProfileSelector } from './ProfileSelector';
import { Profile, Jobs, InvoiceJobs } from '@/App';
import { Socket } from 'socket.io-client';

// Define ApiStatus type locally or import from a shared types file
type ApiStatus = {
    status: 'loading' | 'success' | 'error';
    message: string;
    fullResponse?: any;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  stats?: {
    totalTickets: number;
    totalToProcess: number;
    isProcessing: boolean;
  };
  onAddProfile: () => void;
  // Add all props needed for ProfileSelector
  profiles: Profile[];
  selectedProfile: Profile | null;
  jobs: Jobs | InvoiceJobs; // This might need to be updated to include Catalyst jobs
  onProfileChange: (profileName: string) => void;
  apiStatus: ApiStatus;
  onShowStatus: () => void;
  onManualVerify: () => void;
  socket: Socket | null;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (profileName: string) => void;
}

// A new component for individual sidebar links
const SidebarNavLink = ({ to, children }: { to: string, children: React.ReactNode }) => (
    <NavLink
      to={to}
      end // Use `end` prop for the root route to avoid it being active for all child routes
      className={({ isActive }) => cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
        isActive && "text-primary bg-primary/10"
      )}
    >
      {children}
    </NavLink>
);

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  stats = { totalTickets: 0, totalToProcess: 0, isProcessing: false },
  onAddProfile,
  ...profileSelectorProps // Use the rest of the props for the ProfileSelector
}) => {
  const progressPercent = stats.totalToProcess > 0 ? (stats.totalTickets / stats.totalToProcess) * 100 : 0;

  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      {/* --- Sidebar --- */}
      <div className="hidden border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <div className="flex items-center gap-2 font-semibold">
              <div className="p-2 bg-gradient-primary rounded-lg shadow-glow">
                  <Ticket className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="">Zoho Blaster</span>
            </div>
          </div>

          {/* Profile Selector in Sidebar */}
          <div className="p-4 border-b">
              <ProfileSelector {...profileSelectorProps} />
          </div>

          <div className="flex-1 overflow-auto py-2">
            <nav className="grid items-start px-2 text-sm font-medium lg:px-4 space-y-4">
              <div>
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zoho Desk</h3>
                <SidebarNavLink to="/">
                  <Ticket className="h-4 w-4" />
                  Bulk Tickets
                </SidebarNavLink>
                <SidebarNavLink to="/single-ticket">
                   <Ticket className="h-4 w-4" />
                  Single Ticket
                </SidebarNavLink>
              </div>
               <div>
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zoho Inventory</h3>
                <SidebarNavLink to="/bulk-invoices">
                  <Package className="h-4 w-4" />
                  Bulk Invoices
                </SidebarNavLink>
                <SidebarNavLink to="/single-invoice">
                  <Package className="h-4 w-4" />
                  Single Invoice
                </SidebarNavLink>
                <SidebarNavLink to="/email-statics">
                  <BarChart3 className="h-4 w-4" />
                  Email Statics
                </SidebarNavLink>
              </div>
              {/* NEW: Zoho Catalyst Section */}
              <div>
                <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zoho Catalyst</h3>
                <SidebarNavLink to="/bulk-signup">
                  <Cloud className="h-4 w-4" />
                  Bulk Signup
                </SidebarNavLink>
                <SidebarNavLink to="/single-signup">
                   <Cloud className="h-4 w-4" />
                  Single Signup
                </SidebarNavLink>
                 <SidebarNavLink to="/catalyst-users">
                    <Users className="h-4 w-4" />
                    Manage Users
                </SidebarNavLink>
              </div>
            </nav>
          </div>
          <div className="mt-auto p-4 border-t">
             <Button size="sm" className="w-full" onClick={onAddProfile}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Account
              </Button>
          </div>
        </div>
      </div>
      
      {/* --- Main Content Area --- */}
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6 sticky top-0 z-30">
          <div className="w-full flex-1">
            {/* You can add a page title or search bar here in the future */}
          </div>
           {stats.isProcessing && stats.totalToProcess > 0 && (
              <div className="absolute bottom-0 left-0 w-full">
                <Progress value={progressPercent} className="h-1 w-full rounded-none bg-muted/50" />
              </div>
            )}
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};