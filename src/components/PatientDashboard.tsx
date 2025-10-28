import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Volume2 } from "lucide-react";
import { PatientInfo } from "@/components/PatientInfo";
import { AIAnalysis } from "@/components/AIAnalysis";
import { toast } from "sonner";

interface PatientDashboardProps {
  patientId: string;
  onBack: () => void;
}

interface PatientData {
  id: string;
  name: string;
  age: number;
  bloodType: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relation: string;
  };
}

// Mock patient database
const MOCK_PATIENTS: Record<string, PatientData> = {
  "DEMO-12345": {
    id: "DEMO-12345",
    name: "John Anderson",
    age: 45,
    bloodType: "A+",
    allergies: ["Penicillin", "Peanuts"],
    medications: ["Metformin 500mg", "Lisinopril 10mg", "Aspirin 81mg"],
    conditions: ["Type 2 Diabetes", "Hypertension", "History of MI (2020)"],
    emergencyContact: {
      name: "Sarah Anderson",
      phone: "+1 (555) 123-4567",
      relation: "Spouse"
    }
  }
};

export const PatientDashboard = ({ patientId, onBack }: PatientDashboardProps) => {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    // Simulate fetching patient data
    const fetchPatient = async () => {
      await new Promise(resolve => setTimeout(resolve, 500));
      const patientData = MOCK_PATIENTS[patientId] || MOCK_PATIENTS["DEMO-12345"];
      setPatient(patientData);
      
      // Auto-trigger AI analysis
      setTimeout(() => {
        setIsLoadingAI(true);
        setTimeout(() => setIsLoadingAI(false), 2000);
      }, 1000);
    };

    fetchPatient();
  }, [patientId]);

  const speakAlert = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      speechSynthesis.speak(utterance);
      toast.success("Voice alert activated");
    } else {
      toast.error("Text-to-speech not supported");
    }
  };

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-muted-foreground">Loading patient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="border-border"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Scan Another Card
        </Button>

        <Button
          variant="outline"
          onClick={() => speakAlert(`Critical patient alert: ${patient.name}, age ${patient.age}. Blood type ${patient.bloodType}. Known conditions: ${patient.conditions.join(", ")}`)}
          className="border-border"
        >
          <Volume2 className="mr-2 h-4 w-4" />
          Voice Alert
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column: Patient Info */}
        <div className="space-y-6">
          <PatientInfo patient={patient} />
        </div>

        {/* Right Column: AI Analysis */}
        <div className="space-y-6">
          <AIAnalysis 
            patient={patient} 
            isLoading={isLoadingAI}
            onVoiceAlert={speakAlert}
          />
        </div>
      </div>
    </div>
  );
};
