import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { NFCScanner } from "@/components/NFCScanner";
import { PatientDashboard } from "@/components/PatientDashboard";
import { Shield, Activity, LogOut, UserPlus, Smartphone, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AIChatbot } from "@/components/AIChatbot";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [scannedPatientId, setScannedPatientId] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => setUserRole(data?.role ?? null));
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary p-2 rounded-lg shrink-0">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">MediScan</h1>
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Emergency Health Response System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground hidden lg:inline truncate max-w-[180px]">
              {user?.email}
            </span>
            {userRole && userRole !== "patient" && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate("/add-patient")}>
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Add Patient</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate("/write-nfc")}>
                  <Smartphone className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Write NFC</span>
                </Button>
              </>
            )}
            {userRole === "admin" && (
              <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate("/profile")}>
              <User className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Profile</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!scannedPatientId ? (
          <div className="max-w-2xl mx-auto">
            <NFCScanner onPatientScanned={setScannedPatientId} />
            
            {/* Info Section */}
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-2">For Medical Responders</h3>
                <p className="text-muted-foreground text-sm">
                  Tap the patient's NFC health card to instantly access emergency medical data and AI-powered triage analysis.
                </p>
              </div>
              <div className="bg-card p-6 rounded-lg border border-border">
                <h3 className="text-lg font-semibold text-foreground mb-2">AI-Powered Diagnosis</h3>
                <p className="text-muted-foreground text-sm">
                  Our AI analyzes patient history in real-time to provide probable conditions, triage levels, and recommended actions.
                </p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-8 bg-muted p-4 rounded-lg border-l-4 border-primary">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Medical Disclaimer:</strong> This system provides AI-assisted triage recommendations only. 
                Always defer to trained medical professionals for final diagnosis and treatment decisions.
              </p>
            </div>
          </div>
        ) : (
          <PatientDashboard 
            patientId={scannedPatientId} 
            onBack={() => setScannedPatientId(null)} 
          />
        )}
      </main>
      
      <AIChatbot />
    </div>
  );
};

export default Index;
