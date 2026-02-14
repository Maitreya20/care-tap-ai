import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NFCScanner } from "@/components/NFCScanner";
import { PatientDashboard } from "@/components/PatientDashboard";
import { Shield, Activity, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AIChatbot } from "@/components/AIChatbot";

const Index = () => {
  const [scannedPatientId, setScannedPatientId] = useState<string | null>(null);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Activity className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MediScan AI</h1>
              <p className="text-sm text-muted-foreground">Emergency Health Response System</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={() => navigate("/add-patient")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Patient
            </Button>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
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
