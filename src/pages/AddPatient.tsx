import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserPlus, Copy, ExternalLink, X, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
type AccessType = "uuid" | "nfc";

const AddPatient = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedValue, setGeneratedValue] = useState<string | null>(null);
  const [accessType, setAccessType] = useState<AccessType>("nfc");

  // Patient fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [medicalNotes, setMedicalNotes] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insurancePolicyNumber, setInsurancePolicyNumber] = useState("");
  const [primaryPhysician, setPrimaryPhysician] = useState("");
  const [primaryPhysicianPhone, setPrimaryPhysicianPhone] = useState("");

  // Dynamic lists
  const [allergies, setAllergies] = useState<{ allergen: string; severity: string; reaction: string }[]>([]);
  const [medications, setMedications] = useState<{ name: string; dosage: string; frequency: string }[]>([]);
  const [conditions, setConditions] = useState<{ condition: string; status: string }[]>([]);

  // Emergency contact
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [ecRelationship, setEcRelationship] = useState("");
  const [ecEmail, setEcEmail] = useState("");

  // Allergy input
  const [newAllergen, setNewAllergen] = useState("");
  const [newAllergySeverity, setNewAllergySeverity] = useState("moderate");
  const [newAllergyReaction, setNewAllergyReaction] = useState("");

  // Medication input
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");
  const [newMedFrequency, setNewMedFrequency] = useState("");

  // Condition input
  const [newCondition, setNewCondition] = useState("");
  const [newConditionStatus, setNewConditionStatus] = useState("active");

  const addAllergy = () => {
    if (!newAllergen.trim()) return;
    setAllergies([...allergies, { allergen: newAllergen.trim(), severity: newAllergySeverity, reaction: newAllergyReaction.trim() }]);
    setNewAllergen("");
    setNewAllergyReaction("");
  };

  const addMedication = () => {
    if (!newMedName.trim() || !newMedDosage.trim() || !newMedFrequency.trim()) return;
    setMedications([...medications, { name: newMedName.trim(), dosage: newMedDosage.trim(), frequency: newMedFrequency.trim() }]);
    setNewMedName("");
    setNewMedDosage("");
    setNewMedFrequency("");
  };

  const addCondition = () => {
    if (!newCondition.trim()) return;
    setConditions([...conditions, { condition: newCondition.trim(), status: newConditionStatus }]);
    setNewCondition("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1) Keep profile data aligned with what gets entered in this form.
      // The current schema links one patient record to one auth user, so we persist
      // core identity fields on the user's profile for downstream patient views.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // 2) Create patient record
      const { data: patientData, error: patientError } = await supabase
        .from("patients")
        .insert({
          user_id: user.id,
          blood_type: bloodType as any || null,
          height_cm: heightCm ? parseFloat(heightCm) : null,
          weight_kg: weightKg ? parseFloat(weightKg) : null,
          medical_notes: medicalNotes || null,
          insurance_provider: insuranceProvider || null,
          insurance_policy_number: insurancePolicyNumber || null,
          primary_physician: primaryPhysician || null,
          primary_physician_phone: primaryPhysicianPhone || null,
        })
        .select("id")
        .single();

      if (patientError) throw patientError;

      const patientId = patientData.id;

      // 3. Insert allergies
      if (allergies.length > 0) {
        const { error: allergyError } = await supabase.from("allergies").insert(
          allergies.map((a) => ({
            patient_id: patientId,
            allergen: a.allergen,
            severity: a.severity,
            reaction: a.reaction || null,
          }))
        );
        if (allergyError) toast.warning("Some allergies could not be saved");
      }

      // 4. Insert medications
      if (medications.length > 0) {
        const { error: medError } = await supabase.from("medications").insert(
          medications.map((m) => ({
            patient_id: patientId,
            medication_name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
          }))
        );
        if (medError) toast.warning("Some medications could not be saved");
      }

      // 5. Insert medical history
      if (conditions.length > 0) {
        const { error: condError } = await supabase.from("medical_history").insert(
          conditions.map((c) => ({
            patient_id: patientId,
            condition: c.condition,
            status: c.status,
          }))
        );
        if (condError) toast.warning("Some conditions could not be saved");
      }

      // 6. Insert emergency contact
      if (ecName.trim() && ecPhone.trim() && ecRelationship.trim()) {
        const { error: ecError } = await supabase.from("emergency_contacts").insert({
          patient_id: patientId,
          name: ecName.trim(),
          phone: ecPhone.trim(),
          relationship: ecRelationship.trim(),
          email: ecEmail.trim() || null,
        });
        if (ecError) toast.warning("Emergency contact could not be saved");
      }

      // Generate access output based on selected type
      const url = `${window.location.origin}/patient/${patientId}`;
      setGeneratedValue(accessType === "nfc" ? url : patientId);
      toast.success("Patient registered successfully!");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create patient";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyValue = () => {
    if (generatedValue) {
      navigator.clipboard.writeText(generatedValue);
      toast.success(`${accessType.toUpperCase()} copied to clipboard!`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Add Patient</h1>
            <p className="text-sm text-muted-foreground">Register a new patient and generate an identifier</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {generatedValue ? (
          <Card className="p-8 text-center space-y-6">
            <div className="bg-stable/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-stable" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Patient Registered!</h2>
            <p className="text-muted-foreground">
              {accessType === "nfc"
                ? "Share this NFC URL or program it into an NFC card."
                : "Share this UUID for direct patient identification."}
            </p>
            <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
              <code className="flex-1 text-sm text-foreground break-all text-left">{generatedValue}</code>
              <Button size="sm" variant="outline" onClick={copyValue}>
                <Copy className="h-4 w-4" />
              </Button>
              {accessType === "nfc" && (
                <Button size="sm" variant="outline" onClick={() => window.open(generatedValue, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => { setGeneratedValue(null); navigate("/add-patient"); window.location.reload(); }}>
                Add Another Patient
              </Button>
              <Button variant="outline" onClick={() => navigate("/")}>
                Back to Dashboard
              </Button>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Basic Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
              <div>
                <Label htmlFor="accessType">Identifier Type</Label>
                <Select value={accessType} onValueChange={(value: AccessType) => setAccessType(value)}>
                  <SelectTrigger id="accessType">
                    <SelectValue placeholder="Choose identifier type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uuid">UUID</SelectItem>
                    <SelectItem value="nfc">NFC URL</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  UUID returns a plain patient ID. NFC URL returns a scannable patient link.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" required maxLength={255} />
                </div>
                <div>
                  <Label htmlFor="dob">Date of Birth</Label>
                  <Input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-123-4567" maxLength={20} />
                </div>
                <div>
                  <Label htmlFor="bloodType">Blood Type</Label>
                  <Select value={bloodType} onValueChange={setBloodType}>
                    <SelectTrigger><SelectValue placeholder="Select blood type" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_TYPES.map((bt) => (
                        <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </Card>

            {/* Physical Info */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Physical & Insurance</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="height">Height (cm)</Label>
                  <Input id="height" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="175" min={0} max={300} />
                </div>
                <div>
                  <Label htmlFor="weight">Weight (kg)</Label>
                  <Input id="weight" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="70" min={0} max={500} />
                </div>
                <div>
                  <Label htmlFor="insProvider">Insurance Provider</Label>
                  <Input id="insProvider" value={insuranceProvider} onChange={(e) => setInsuranceProvider(e.target.value)} placeholder="Blue Cross" maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="insPolicy">Policy Number</Label>
                  <Input id="insPolicy" value={insurancePolicyNumber} onChange={(e) => setInsurancePolicyNumber(e.target.value)} placeholder="POL-12345" maxLength={50} />
                </div>
                <div>
                  <Label htmlFor="physician">Primary Physician</Label>
                  <Input id="physician" value={primaryPhysician} onChange={(e) => setPrimaryPhysician(e.target.value)} placeholder="Dr. Smith" maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="physicianPhone">Physician Phone</Label>
                  <Input id="physicianPhone" value={primaryPhysicianPhone} onChange={(e) => setPrimaryPhysicianPhone(e.target.value)} placeholder="+1 555-000-0000" maxLength={20} />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Medical Notes</Label>
                <Textarea id="notes" value={medicalNotes} onChange={(e) => setMedicalNotes(e.target.value)} placeholder="Any relevant medical notes..." maxLength={2000} />
              </div>
            </Card>

            {/* Allergies */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Allergies</h2>
              {allergies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allergies.map((a, i) => (
                    <Badge key={i} variant="destructive" className="gap-1 bg-urgent text-white">
                      {a.allergen} ({a.severity})
                      <button type="button" onClick={() => setAllergies(allergies.filter((_, idx) => idx !== i))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-4">
                <Input value={newAllergen} onChange={(e) => setNewAllergen(e.target.value)} placeholder="Allergen" maxLength={100} />
                <Select value={newAllergySeverity} onValueChange={setNewAllergySeverity}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mild">Mild</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="severe">Severe</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={newAllergyReaction} onChange={(e) => setNewAllergyReaction(e.target.value)} placeholder="Reaction" maxLength={200} />
                <Button type="button" variant="outline" onClick={addAllergy}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </Card>

            {/* Medications */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Current Medications</h2>
              {medications.length > 0 && (
                <div className="space-y-2">
                  {medications.map((m, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                      <span className="text-foreground">{m.name} — {m.dosage} — {m.frequency}</span>
                      <button type="button" onClick={() => setMedications(medications.filter((_, idx) => idx !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-4">
                <Input value={newMedName} onChange={(e) => setNewMedName(e.target.value)} placeholder="Medication name" maxLength={100} />
                <Input value={newMedDosage} onChange={(e) => setNewMedDosage(e.target.value)} placeholder="Dosage (e.g. 500mg)" maxLength={50} />
                <Input value={newMedFrequency} onChange={(e) => setNewMedFrequency(e.target.value)} placeholder="Frequency (e.g. 2x/day)" maxLength={50} />
                <Button type="button" variant="outline" onClick={addMedication}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </Card>

            {/* Medical Conditions */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Medical Conditions</h2>
              {conditions.length > 0 && (
                <div className="space-y-2">
                  {conditions.map((c, i) => (
                    <div key={i} className="flex items-center justify-between bg-muted p-2 rounded text-sm">
                      <span className="text-foreground">{c.condition} ({c.status})</span>
                      <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))}><X className="h-4 w-4 text-muted-foreground" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <Input value={newCondition} onChange={(e) => setNewCondition(e.target.value)} placeholder="Condition" maxLength={200} />
                <Select value={newConditionStatus} onValueChange={setNewConditionStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="chronic">Chronic</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addCondition}><Plus className="h-4 w-4 mr-1" />Add</Button>
              </div>
            </Card>

            {/* Emergency Contact */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground">Emergency Contact</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="ecName">Name</Label>
                  <Input id="ecName" value={ecName} onChange={(e) => setEcName(e.target.value)} placeholder="Jane Doe" maxLength={100} />
                </div>
                <div>
                  <Label htmlFor="ecPhone">Phone</Label>
                  <Input id="ecPhone" value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} placeholder="+1 555-000-0000" maxLength={20} />
                </div>
                <div>
                  <Label htmlFor="ecRel">Relationship</Label>
                  <Input id="ecRel" value={ecRelationship} onChange={(e) => setEcRelationship(e.target.value)} placeholder="Spouse" maxLength={50} />
                </div>
                <div>
                  <Label htmlFor="ecEmail">Email</Label>
                  <Input id="ecEmail" type="email" value={ecEmail} onChange={(e) => setEcEmail(e.target.value)} placeholder="jane@example.com" maxLength={255} />
                </div>
              </div>
            </Card>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent mr-2" />
                  Registering Patient...
                </>
              ) : (
                <>
                  <UserPlus className="h-5 w-5 mr-2" />
                  Register Patient & Generate {accessType === "nfc" ? "NFC URL" : "UUID"}
                </>
              )}
            </Button>
          </form>
        )}
      </main>
    </div>
  );
};

export default AddPatient;
