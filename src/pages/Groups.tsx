import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, Plus, Mail, Crown, UserPlus, Trash2, Loader2, 
  Check, X, Clock, UserMinus, Edit, Send
} from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { useActiveGroup } from "@/contexts/ActiveGroupContext";
import { toast } from "sonner";
import { useNotificationContext } from "@/contexts/NotificationContext";

interface Group {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface GroupMember {
  id: string;
  user_id: string;
  role: "viewer" | "editor" | "admin";
  accepted_at: string | null;
  profile?: { username: string | null; avatar_url: string | null };
}

interface GroupInvite {
  id: string;
  invited_email: string;
  invited_by_username: string | null;
  role: string;
  status: string;
  created_at: string;
}

const Groups = () => {
  const { user } = useAuth();
  const { groups, activeGroup, refreshGroups, pendingInvites, acceptInvite, declineInvite, refreshInvites } = useActiveGroup();
  const { addLocalNotification } = useNotificationContext();
  
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<string | null>(null);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);

  // Forms
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDesc, setNewGroupDesc] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"viewer" | "editor">("viewer");

  useEffect(() => {
    if (groups.length > 0 && !selectedGroup) {
      selectGroup(groups[0]);
    }
    setIsLoading(false);
  }, [groups]);

  const selectGroup = async (group: Group) => {
    setSelectedGroup(group);
    
    // Fetch members
    const { data: membersData } = await supabase
      .from("group_members")
      .select("*")
      .eq("group_id", group.id);
    
    // Fetch profiles separately
    const membersList: GroupMember[] = [];
    if (membersData) {
      for (const m of membersData) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("username, avatar_url")
          .eq("user_id", m.user_id)
          .maybeSingle();
        
        membersList.push({
          id: m.id,
          user_id: m.user_id,
          role: m.role as "viewer" | "editor" | "admin",
          accepted_at: m.accepted_at,
          profile: profileData || undefined,
        });
      }
    }
    setMembers(membersList);

    // Fetch invites (only if owner)
    if (group.owner_id === user?.id) {
      const { data: invitesData } = await supabase
        .from("group_invites")
        .select("*")
        .eq("group_id", group.id)
        .eq("status", "pending");
      
      setInvites(invitesData || []);
    } else {
      setInvites([]);
    }
  };

  const handleCreateGroup = async () => {
    if (!user || !newGroupName.trim()) return;
    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("groups")
        .insert({
          name: newGroupName.trim(),
          description: newGroupDesc.trim() || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add owner as admin member
      await supabase.from("group_members").insert({
        group_id: data.id,
        user_id: user.id,
        role: "admin",
        invited_by: user.id,
        accepted_at: new Date().toISOString(),
      });

      toast.success("Gruppo creato con successo");
      addLocalNotification("Gruppo", `${newGroupName} è stato creato`, "success");
      setNewGroupName("");
      setNewGroupDesc("");
      setIsCreateOpen(false);
      refreshGroups();
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error("Errore nella creazione del gruppo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInvite = async () => {
    if (!user || !selectedGroup || !inviteEmail.trim()) return;
    setIsSaving(true);
    
    try {
      // Get current user's username
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .maybeSingle();
      
      const inviterName = profile?.username || user.email?.split("@")[0] || "Un utente";

      // Create the invite
      const { data: inviteData, error } = await supabase
        .from("group_invites")
        .insert({
          group_id: selectedGroup.id,
          invited_email: inviteEmail.trim().toLowerCase(),
          invited_by: user.id,
          invited_by_username: inviterName,
          role: inviteRole,
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.error("Questa email è già stata invitata");
        } else {
          throw error;
        }
        return;
      }

      // Send email notification
      try {
        const { error: emailError } = await supabase.functions.invoke("send-invite-email", {
          body: {
            inviteId: inviteData.id,
            groupName: selectedGroup.name,
            inviterName,
            inviteeEmail: inviteEmail.trim().toLowerCase(),
            role: inviteRole,
          },
        });

        if (emailError) {
          console.error("Error sending email:", emailError);
          // Don't fail the invite if email fails
        }
      } catch (emailErr) {
        console.error("Email send error:", emailErr);
      }

      toast.success("Invito inviato");
      addLocalNotification("Invito", `Invito inviato a ${inviteEmail}`, "success");
      setInviteEmail("");
      setIsInviteOpen(false);
      selectGroup(selectedGroup);
    } catch (error) {
      console.error("Error inviting:", error);
      toast.error("Errore nell'invio dell'invito");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      const { error } = await supabase
        .from("groups")
        .delete()
        .eq("id", deleteGroupId);

      if (error) throw error;

      toast.success("Gruppo eliminato");
      setDeleteGroupId(null);
      setSelectedGroup(null);
      refreshGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      toast.error("Errore nell'eliminazione del gruppo");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;
      toast.success("Membro rimosso");
      if (selectedGroup) selectGroup(selectedGroup);
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Errore nella rimozione del membro");
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from("group_invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
      toast.success("Invito annullato");
      if (selectedGroup) selectGroup(selectedGroup);
    } catch (error) {
      console.error("Error canceling invite:", error);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return <Badge className="bg-primary/20 text-primary border-primary/30"><Crown className="h-3 w-3 mr-1" />Admin</Badge>;
      case "editor":
        return <Badge variant="secondary"><Edit className="h-3 w-3 mr-1" />Editor</Badge>;
      default:
        return <Badge variant="outline">Viewer</Badge>;
    }
  };

  const handleAcceptInvite = async (inviteId: string) => {
    setAcceptingInvite(inviteId);
    const success = await acceptInvite(inviteId);
    if (success) {
      toast.success("Invito accettato! Sei ora membro del gruppo.");
      addLocalNotification("Invito accettato", "Sei stato aggiunto al gruppo", "success");
    } else {
      toast.error("Errore nell'accettare l'invito");
    }
    setAcceptingInvite(null);
  };

  const handleDeclineInvite = async (inviteId: string) => {
    const success = await declineInvite(inviteId);
    if (success) {
      toast.success("Invito rifiutato");
    } else {
      toast.error("Errore nel rifiutare l'invito");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Delete Dialog */}
      <AlertDialog open={!!deleteGroupId} onOpenChange={() => setDeleteGroupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo gruppo?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione è irreversibile. Tutti i membri perderanno l'accesso alle dispense condivise.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Gruppi</h1>
          <p className="text-muted-foreground">Gestisci i tuoi gruppi e invita nuovi membri</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" />Nuovo Gruppo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Nuovo Gruppo</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome del gruppo *</Label>
                <Input
                  placeholder="es. Famiglia Rossi"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrizione (opzionale)</Label>
                <Input
                  placeholder="es. Gestione dispensa di casa"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Annulla</Button>
              <Button onClick={handleCreateGroup} disabled={isSaving || !newGroupName.trim()}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea Gruppo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Pending Invites Received */}
      {pendingInvites.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Mail className="h-5 w-5 text-primary" />
              Inviti ricevuti ({pendingInvites.length})
            </CardTitle>
            <CardDescription>Hai ricevuto inviti per unirti a questi gruppi</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-4 rounded-lg bg-background border"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary/20 text-primary">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{invite.group_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Invitato da {invite.invited_by_username || "un utente"} come {invite.role}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(invite.created_at).toLocaleDateString("it-IT")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(invite.role)}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => handleDeclineInvite(invite.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAcceptInvite(invite.id)}
                    disabled={acceptingInvite === invite.id}
                  >
                    {acceptingInvite === invite.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Check className="h-4 w-4 mr-1" />Accetta</>
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {groups.length === 0 && pendingInvites.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium mb-2">Nessun gruppo</h3>
            <p className="text-muted-foreground mb-4">
              Crea un gruppo per iniziare a organizzare le tue dispense
            </p>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Crea il primo gruppo
            </Button>
          </CardContent>
        </Card>
      ) : groups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Groups List */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                I tuoi gruppi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => selectGroup(group)}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedGroup?.id === group.id
                      ? "bg-primary/10 border border-primary/30"
                      : "hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{group.name}</p>
                      {group.description && (
                        <p className="text-sm text-muted-foreground truncate">{group.description}</p>
                      )}
                    </div>
                    {group.owner_id === user?.id && (
                      <Crown className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Group Details */}
          {selectedGroup && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedGroup.name}</CardTitle>
                    <CardDescription>{selectedGroup.description || "Nessuna descrizione"}</CardDescription>
                  </div>
                  {selectedGroup.owner_id === user?.id && (
                    <div className="flex gap-2">
                      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <UserPlus className="h-4 w-4" />
                            Invita
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Invita un membro</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Email</Label>
                              <Input
                                type="email"
                                placeholder="email@esempio.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Ruolo</Label>
                              <Select value={inviteRole} onValueChange={(v: "viewer" | "editor") => setInviteRole(v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover">
                                  <SelectItem value="viewer">Viewer - Solo visualizzazione</SelectItem>
                                  <SelectItem value="editor">Editor - Può modificare</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Annulla</Button>
                            <Button onClick={handleInvite} disabled={isSaving || !inviteEmail.trim()} className="gap-2">
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4" />Invia Invito</>}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive"
                        onClick={() => setDeleteGroupId(selectedGroup.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Members */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Membri ({members.length})
                  </h4>
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.profile?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {member.profile?.username?.slice(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{member.profile?.username || "Utente"}</p>
                            {!member.accepted_at && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> In attesa di accettazione
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getRoleBadge(member.role)}
                          {selectedGroup.owner_id === user?.id && member.user_id !== user?.id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-8 w-8 p-0"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pending Invites */}
                {invites.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Inviti inviati ({invites.length})
                    </h4>
                    <div className="space-y-2">
                      {invites.map((invite) => (
                        <div
                          key={invite.id}
                          className="flex items-center justify-between p-3 rounded-lg border border-dashed"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                <Mail className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{invite.invited_email}</p>
                              <p className="text-xs text-muted-foreground">
                                Invitato il {new Date(invite.created_at).toLocaleDateString("it-IT")}
                                {invite.invited_by_username && ` da ${invite.invited_by_username}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getRoleBadge(invite.role)}
                            <Badge variant="outline" className="text-xs gap-1">
                              <Clock className="h-3 w-3" />
                              In attesa
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-8 w-8 p-0"
                              onClick={() => handleCancelInvite(invite.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default Groups;
