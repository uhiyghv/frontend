import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AuthProvider } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TutorialProvider } from "@/contexts/TutorialContext";
import { ActiveGroupProvider, useActiveGroup } from "@/contexts/ActiveGroupContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { TutorialOverlay } from "@/components/TutorialOverlay";
import { GroupOnboarding } from "@/components/GroupOnboarding";
import { Loader2 } from "lucide-react";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Inventario from "./pages/Inventario";
import Dispense from "./pages/Dispense";
import DispensaDetail from "./pages/DispensaDetail";
import ProductDetail from "./pages/ProductDetail";
import Dispositivi from "./pages/Dispositivi";
import Grafici from "./pages/Grafici";
import About from "./pages/About";
import Scanners from "./pages/Scanners";
import Pricing from "./pages/Pricing";
import Profile from "./pages/Profile";
import Groups from "./pages/Groups";
import Scan from "./pages/Scan";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { isLoading, needsOnboarding } = useActiveGroup();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (needsOnboarding) {
    return <GroupOnboarding />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <AppHeader />
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
      <TutorialOverlay />
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <NotificationProvider>
        <TutorialProvider>
          <ActiveGroupProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter 
                future={{ 
                  v7_startTransition: true, 
                  v7_relativeSplatPath: true 
                }}
              >
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/about" element={<About />} />
                  <Route path="/scanners" element={<Scanners />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/dashboard" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
                  <Route path="/inventario" element={<ProtectedRoute><AppLayout><Inventario /></AppLayout></ProtectedRoute>} />
                  <Route path="/prodotti/:id" element={<ProtectedRoute><AppLayout><ProductDetail /></AppLayout></ProtectedRoute>} />
                  <Route path="/dispense" element={<ProtectedRoute><AppLayout><Dispense /></AppLayout></ProtectedRoute>} />
                  <Route path="/dispense/:id" element={<ProtectedRoute><AppLayout><DispensaDetail /></AppLayout></ProtectedRoute>} />
                  <Route path="/dispositivi" element={<ProtectedRoute><AppLayout><Dispositivi /></AppLayout></ProtectedRoute>} />
                  <Route path="/grafici" element={<ProtectedRoute><AppLayout><Grafici /></AppLayout></ProtectedRoute>} />
                  <Route path="/profilo" element={<ProtectedRoute><AppLayout><Profile /></AppLayout></ProtectedRoute>} />
                  <Route path="/gruppi" element={<ProtectedRoute><AppLayout><Groups /></AppLayout></ProtectedRoute>} />
                  <Route path="/scan" element={<ProtectedRoute><AppLayout><Scan /></AppLayout></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </ActiveGroupProvider>
        </TutorialProvider>
      </NotificationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
