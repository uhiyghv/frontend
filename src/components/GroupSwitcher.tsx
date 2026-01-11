import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, ChevronDown, Crown, Check, Bell, Loader2, Settings } from 'lucide-react';
import { useActiveGroup } from '@/contexts/ActiveGroupContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

export const GroupSwitcher = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, activeGroup, pendingInvites, setActiveGroup, acceptInvite, declineInvite } = useActiveGroup();
  const [processingInvite, setProcessingInvite] = useState<string | null>(null);

  const handleGroupChange = async (group: typeof activeGroup) => {
    if (group && group.id !== activeGroup?.id) {
      await setActiveGroup(group);
      toast.success(`Passato a "${group.name}"`);
    }
  };

  const handleAcceptInvite = async (inviteId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProcessingInvite(inviteId);
    const success = await acceptInvite(inviteId);
    setProcessingInvite(null);
    if (success) {
      toast.success('Ti sei unito al gruppo!');
    }
  };

  if (!activeGroup) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 min-w-[160px] justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="max-w-[120px] truncate">{activeGroup.name}</span>
          </div>
          <div className="flex items-center gap-1">
            {pendingInvites.length > 0 && (
              <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
                {pendingInvites.length}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[280px] bg-popover">
        <DropdownMenuLabel>I tuoi gruppi</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {groups.map((group) => (
          <DropdownMenuItem
            key={group.id}
            onClick={() => handleGroupChange(group)}
            className="flex items-center justify-between cursor-pointer"
          >
            <div className="flex items-center gap-2">
              {group.owner_id === user?.id && (
                <Crown className="h-3 w-3 text-primary" />
              )}
              <span className="truncate">{group.name}</span>
            </div>
            {activeGroup.id === group.id && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}

        {pendingInvites.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-2">
              <Bell className="h-3 w-3" />
              Inviti ({pendingInvites.length})
            </DropdownMenuLabel>
            {pendingInvites.map((invite) => (
              <DropdownMenuItem
                key={invite.id}
                className="flex items-center justify-between"
                onSelect={(e) => e.preventDefault()}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{invite.group_name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{invite.role}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(e) => handleAcceptInvite(invite.id, e)}
                  disabled={processingInvite === invite.id}
                >
                  {processingInvite === invite.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                </Button>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => navigate('/gruppi')}
          className="cursor-pointer"
        >
          <Settings className="h-4 w-4 mr-2" />
          Gestisci gruppi
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
