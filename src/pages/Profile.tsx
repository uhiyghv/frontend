import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  User, Camera, Save, Loader2, Settings, Bell, Shield, 
  Palette, LogOut, Mail, Calendar, Upload, X, Check
} from "lucide-react";
import { supabase } from "@/integrations/backend/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNotificationContext } from "@/contexts/NotificationContext";

// Validation schema
const usernameSchema = z.string().trim().max(50, "Il nome utente deve essere massimo 50 caratteri").optional();

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  preferences: Record<string, any>;
  tutorial_completed: boolean | null;
  created_at: string;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { addLocalNotification } = useNotificationContext();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [username, setUsername] = useState("");
  const [preferences, setPreferences] = useState({
    notifications_enabled: true,
    email_notifications: false,
    dark_mode: false,
    low_stock_alerts: true,
    expiry_alerts: true,
  });

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setProfile({
          ...data,
          preferences: typeof data.preferences === 'object' && data.preferences !== null ? data.preferences as Record<string, any> : {},
        });
        setUsername(data.username || "");
        const prefs = typeof data.preferences === 'object' && data.preferences !== null ? data.preferences as Record<string, any> : {};
        setPreferences(prev => ({ ...prev, ...prefs }));
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    
    // Validate username
    const usernameResult = usernameSchema.safeParse(username);
    if (!usernameResult.success) {
      toast.error(usernameResult.error.errors[0]?.message || "Nome utente non valido");
      return;
    }
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          username: usernameResult.data || null,
          preferences,
        })
        .eq("user_id", user.id);

      if (error) throw error;
      
      toast.success("Profilo aggiornato con successo");
      addLocalNotification("Profilo", "Le tue preferenze sono state salvate", "success");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Errore nel salvataggio del profilo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file
    if (!file.type.startsWith("image/")) {
      toast.error("Seleziona un file immagine valido");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'immagine deve essere inferiore a 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Update profile
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast.success("Avatar aggiornato");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Errore nel caricamento dell'avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getInitials = () => {
    if (username) return username.slice(0, 2).toUpperCase();
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return "U";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold mb-2">Il mio Profilo</h1>
        <p className="text-muted-foreground">Gestisci le tue informazioni personali e preferenze</p>
      </div>

      {/* Profile Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="pt-0 -mt-12">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4">
            {/* Avatar */}
            <div className="relative group">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile?.avatar_url || undefined} alt={username} />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary/90"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="flex-1 text-center sm:text-left pb-4">
              <h2 className="text-2xl font-bold">{username || "Utente"}</h2>
              <p className="text-muted-foreground flex items-center gap-2 justify-center sm:justify-start">
                <Mail className="h-4 w-4" />
                {user?.email}
              </p>
              <div className="flex gap-2 mt-2 justify-center sm:justify-start">
                <Badge variant="secondary" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  Membro dal {new Date(profile?.created_at || Date.now()).toLocaleDateString("it-IT", { month: "long", year: "numeric" })}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Informazioni Personali
            </CardTitle>
            <CardDescription>Modifica le tue informazioni di base</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Nome utente</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Il tuo nome"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">L'email non può essere modificata</p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifiche
            </CardTitle>
            <CardDescription>Configura le tue preferenze di notifica</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notifiche push</Label>
                <p className="text-xs text-muted-foreground">Ricevi notifiche nel browser</p>
              </div>
              <Switch
                checked={preferences.notifications_enabled}
                onCheckedChange={(checked) => setPreferences({ ...preferences, notifications_enabled: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Avvisi scorte basse</Label>
                <p className="text-xs text-muted-foreground">Quando i prodotti scendono sotto soglia</p>
              </div>
              <Switch
                checked={preferences.low_stock_alerts}
                onCheckedChange={(checked) => setPreferences({ ...preferences, low_stock_alerts: checked })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Avvisi scadenze</Label>
                <p className="text-xs text-muted-foreground">Prodotti in scadenza entro 3 giorni</p>
              </div>
              <Switch
                checked={preferences.expiry_alerts}
                onCheckedChange={(checked) => setPreferences({ ...preferences, expiry_alerts: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              Aspetto
            </CardTitle>
            <CardDescription>Personalizza l'interfaccia</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Tema scuro</Label>
                <p className="text-xs text-muted-foreground">Passa al tema dark</p>
              </div>
              <Switch
                checked={preferences.dark_mode}
                onCheckedChange={(checked) => setPreferences({ ...preferences, dark_mode: checked })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Sicurezza
            </CardTitle>
            <CardDescription>Gestisci l'accesso al tuo account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => navigate("/reset-password")}>
              <Settings className="h-4 w-4" />
              Cambia password
            </Button>
            <Button variant="destructive" className="w-full justify-start gap-2" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              Esci dall'account
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)}>Annulla</Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salva Modifiche
        </Button>
      </div>
    </div>
  );
};

export default Profile;
