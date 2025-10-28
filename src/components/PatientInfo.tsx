import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Droplet, AlertTriangle, Pill, Stethoscope, Phone } from "lucide-react";

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

interface PatientInfoProps {
  patient: PatientData;
}

export const PatientInfo = ({ patient }: PatientInfoProps) => {
  return (
    <Card className="p-6 bg-card border border-border">
      <div className="flex items-start gap-4 mb-6">
        <div className="bg-primary/10 p-3 rounded-full">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{patient.name}</h2>
          <p className="text-muted-foreground">Age: {patient.age} years • ID: {patient.id}</p>
        </div>
      </div>

      {/* Blood Type */}
      <div className="mb-6 p-4 bg-critical/10 rounded-lg border border-critical/30">
        <div className="flex items-center gap-2 mb-1">
          <Droplet className="h-4 w-4 text-critical" />
          <span className="text-sm font-semibold text-foreground">Blood Type</span>
        </div>
        <p className="text-2xl font-bold text-critical">{patient.bloodType}</p>
      </div>

      {/* Allergies */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-urgent" />
          <span className="text-sm font-semibold text-foreground">Allergies</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {patient.allergies.map((allergy, idx) => (
            <Badge key={idx} variant="destructive" className="bg-urgent text-white">
              {allergy}
            </Badge>
          ))}
        </div>
      </div>

      {/* Current Medications */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Pill className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Current Medications</span>
        </div>
        <ul className="space-y-2">
          {patient.medications.map((med, idx) => (
            <li key={idx} className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {med}
            </li>
          ))}
        </ul>
      </div>

      {/* Medical Conditions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Stethoscope className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Known Conditions</span>
        </div>
        <ul className="space-y-2">
          {patient.conditions.map((condition, idx) => (
            <li key={idx} className="text-sm text-muted-foreground bg-muted p-2 rounded">
              {condition}
            </li>
          ))}
        </ul>
      </div>

      {/* Emergency Contact */}
      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Emergency Contact</span>
        </div>
        <p className="text-sm font-medium text-foreground">{patient.emergencyContact.name}</p>
        <p className="text-sm text-muted-foreground">{patient.emergencyContact.relation}</p>
        <p className="text-sm font-mono text-primary mt-1">{patient.emergencyContact.phone}</p>
      </div>
    </Card>
  );
};
