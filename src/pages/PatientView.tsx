import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, User, Droplet, AlertTriangle, Pill, Stethoscope, Phone, ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PatientViewData {
  id: string;
  blood_type: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  medical_notes: string | null;
  insurance_provider: string | null;
  primary_physician: string | null;
  primary_physician_phone: string | null;
  profile: {
    full_name: string;
    date_of_birth: string | null;
    phone: string | null;
    gender: string | null;
  } | null;
  allergies: { allergen: string; severity: string; reaction: string | null }[];
  medications: { medication_name: string; dosage: string; frequency: string }[];
  conditions: { condition: string; status: string }[];
  emergency_contacts: { name: string; phone: string; relationship: string; email: string | null }[];
}

const PatientView = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [patient, setPatient] = useState<PatientViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    
    const fetchPatient = async () => {
      if (!id) {
        setError("No patient ID provided");
        setLoading(false);
        return;
      }

      try {
        const { data: patientData, error: patientError } = await supabase
          .from("patients")
          .select("id, blood_type, height_cm, weight_kg, medical_notes, insurance_provider, primary_physician, primary_physician_phone, user_id")
          .eq("id", id)
          .eq("is_active", true)
          .single();

        if (patientError || !patientData) {
          setError("Patient not found");
          setLoading(false);
          return;
        }

        const [profileRes, allergiesRes, medsRes, conditionsRes, contactsRes] = await Promise.all([
          supabase.from("profiles").select("full_name, date_of_birth, phone, gender").eq("id", patientData.user_id).single(),
          supabase.from("allergies").select("allergen, severity, reaction").eq("patient_id", id),
          supabase.from("medications").select("medication_name, dosage, frequency").eq("patient_id", id).eq("is_active", true),
          supabase.from("medical_history").select("condition, status").eq("patient_id", id),
          supabase.from("emergency_contacts").select("name, phone, relationship, email").eq("patient_id", id).eq("is_active", true),
        ]);

        setPatient({
          id: patientData.id,
          blood_type: patientData.blood_type,
          height_cm: patientData.height_cm,
          weight_kg: patientData.weight_kg,
          medical_notes: patientData.medical_notes,
          insurance_provider: patientData.insurance_provider,
          primary_physician: patientData.primary_physician,
          primary_physician_phone: patientData.primary_physician_phone,
          profile: profileRes.data || null,
          allergies: allergiesRes.data || [],
          medications: medsRes.data || [],
          conditions: conditionsRes.data || [],
          emergency_contacts: contactsRes.data || [],
        });
      } catch (err) {
        setError("Failed to load patient data");
      } finally {
        setLoading(false);
      }
    };

    fetchPatient();
  }, [id, user, authLoading]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4" />
          <p className="text-muted-foreground">Loading patient data...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold text-foreground mb-2">Patient Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "Unable to locate patient record."}</p>
          <Link to="/">
            <Button>Go to Dashboard</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const age = patient.profile?.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <div className="bg-primary p-2 rounded-lg">
            <Activity className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">MediScan AI</h1>
            <p className="text-sm text-muted-foreground">Emergency Patient Information</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* Patient Identity */}
        <Card className="p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="bg-primary/10 p-3 rounded-full">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{patient.profile?.full_name || "Unknown"}</h2>
              <p className="text-muted-foreground">
                {age !== null && `Age: ${age} years • `}
                {patient.profile?.gender && `${patient.profile.gender.charAt(0).toUpperCase() + patient.profile.gender.slice(1)} • `}
                ID: {patient.id.slice(0, 8)}…
              </p>
            </div>
          </div>

          {/* Blood Type */}
          {patient.blood_type && (
            <div className="p-4 bg-critical/10 rounded-lg border border-critical/30">
              <div className="flex items-center gap-2 mb-1">
                <Droplet className="h-4 w-4 text-critical" />
                <span className="text-sm font-semibold text-foreground">Blood Type</span>
              </div>
              <p className="text-2xl font-bold text-critical">{patient.blood_type}</p>
            </div>
          )}
        </Card>

        {/* Allergies */}
        {patient.allergies.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5 text-urgent" />
              <h3 className="text-lg font-semibold text-foreground">Allergies</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {patient.allergies.map((a, i) => (
                <Badge key={i} variant="destructive" className="bg-urgent text-white">
                  {a.allergen} — {a.severity}
                  {a.reaction && ` (${a.reaction})`}
                </Badge>
              ))}
            </div>
          </Card>
        )}

        {/* Medications */}
        {patient.medications.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Pill className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Current Medications</h3>
            </div>
            <ul className="space-y-2">
              {patient.medications.map((m, i) => (
                <li key={i} className="text-sm bg-muted p-3 rounded text-foreground">
                  <strong>{m.medication_name}</strong> — {m.dosage} — {m.frequency}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Medical Conditions */}
        {patient.conditions.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Stethoscope className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Medical Conditions</h3>
            </div>
            <ul className="space-y-2">
              {patient.conditions.map((c, i) => (
                <li key={i} className="text-sm bg-muted p-3 rounded flex items-center justify-between">
                  <span className="text-foreground">{c.condition}</span>
                  <Badge variant="outline" className="text-xs">{c.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {/* Emergency Contacts */}
        {patient.emergency_contacts.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Phone className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">Emergency Contacts</h3>
            </div>
            {patient.emergency_contacts.map((ec, i) => (
              <div key={i} className="p-3 bg-primary/5 rounded-lg border border-primary/20 mb-2 last:mb-0">
                <p className="font-medium text-foreground">{ec.name}</p>
                <p className="text-sm text-muted-foreground">{ec.relationship}</p>
                <a href={`tel:${ec.phone}`} className="text-sm font-mono text-primary mt-1 block">{ec.phone}</a>
              </div>
            ))}
          </Card>
        )}

        {/* Additional Info */}
        {(patient.primary_physician || patient.medical_notes) && (
          <Card className="p-6 space-y-3">
            {patient.primary_physician && (
              <div>
                <span className="text-sm font-semibold text-foreground">Primary Physician: </span>
                <span className="text-sm text-muted-foreground">{patient.primary_physician}</span>
                {patient.primary_physician_phone && (
                  <a href={`tel:${patient.primary_physician_phone}`} className="text-sm font-mono text-primary ml-2">{patient.primary_physician_phone}</a>
                )}
              </div>
            )}
            {patient.medical_notes && (
              <div>
                <span className="text-sm font-semibold text-foreground">Notes: </span>
                <span className="text-sm text-muted-foreground">{patient.medical_notes}</span>
              </div>
            )}
          </Card>
        )}

        {/* Disclaimer */}
        <div className="bg-muted p-4 rounded-lg border-l-4 border-primary">
          <p className="text-xs text-muted-foreground">
            ⚕️ This information is provided for emergency medical responders. Always verify patient identity before administering treatment.
          </p>
        </div>
      </main>
    </div>
  );
};

export default PatientView;
