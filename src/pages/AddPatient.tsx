import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, UserPlus, Copy, ExternalLink, X, Plus, CreditCard, Activity, QrCode, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import jsPDF from "jspdf";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const AddPatient = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);

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

  // Card & Monitoring
  const [cardMethod, setCardMethod] = useState<"NFC" | "UUID_CARD">("NFC");
  const [uuidCardNumber, setUuidCardNumber] = useState("");
  const [monitoringPriority, setMonitoringPriority] = useState("stable");

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

    if (cardMethod === "UUID_CARD" && !uuidCardNumber.trim()) {
      toast.error("UUID card number is required for UUID Card method");
      return;
    }

    if (!user) {
      toast.error("You must be logged in");
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Create profile via signup or find existing user — here we create the patient record
      //    Since patients reference a user_id, we'll use the current user as the patient owner for now.
      //    In production, you'd create a new auth user for the patient.

      // Create patient record
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

      // 2. Insert allergies
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

      // 3. Insert medications
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

      // 4. Insert medical history
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

      // 5. Insert emergency contact
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

      // 6. Create card record
      const cardId = cardMethod === "UUID_CARD" ? uuidCardNumber.trim() : crypto.randomUUID();
      const { error: nfcError } = await supabase.from("nfc_cards").insert({
        patient_id: patientId,
        encrypted_card_id: cardId,
        card_type: cardMethod,
      });
      if (nfcError) toast.warning("Card record could not be saved");

      // Generate the URL
      const url = `${window.location.origin}/patient/${patientId}`;
      setGeneratedUrl(url);
      toast.success("Patient registered successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to create patient");
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyUrl = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl);
      toast.success("URL copied to clipboard!");
    }
  };

  const generateCardPDF = () => {
    if (!generatedUrl) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });

    // Card background
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, 85.6, 54, "F");

    // Header bar
    doc.setFillColor(59, 130, 246); // blue-500
    doc.rect(0, 0, 85.6, 12, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("MediScan AI — Patient Card", 4, 8);

    // Patient name
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.text(fullName || "Patient", 4, 20);

    // Card ID label
    const cardId = cardMethod === "UUID_CARD" ? uuidCardNumber : "NFC Auto-Generated";
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("CARD ID", 4, 27);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(cardId, 4, 31);

    // Blood type badge
    if (bloodType) {
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text("BLOOD TYPE", 4, 38);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(bloodType, 4, 43);
    }

    // QR code — render to canvas, then embed as image
    const qrCanvas = document.querySelector("#pdf-qr-code canvas") as HTMLCanvasElement | null;
    // Use the hidden QR canvas rendered below
    const qrContainer = document.getElementById("pdf-qr-code");
    if (qrContainer) {
      const svgEl = qrContainer.querySelector("svg");
      if (svgEl) {
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, 200, 200);
          const qrDataUrl = canvas.toDataURL("image/png");
          // White background for QR
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(60, 16, 22, 22, 2, 2, "F");
          doc.addImage(qrDataUrl, "PNG", 61, 17, 20, 20);

          doc.setFontSize(5);
          doc.setTextColor(148, 163, 184);
          doc.text("Scan for records", 63, 41);

          // Footer
          doc.setFontSize(5);
          doc.setTextColor(100, 116, 139);
          doc.text("Emergency medical data — Authorized personnel only", 4, 51);

          doc.save(`patient-card-${fullName.replace(/\s+/g, "-").toLowerCase() || "card"}.pdf`);
          toast.success("Card PDF downloaded!");
        };
        img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
        return;
      }
    }

    // Fallback without QR
    doc.save(`patient-card-${fullName.replace(/\s+/g, "-").toLowerCase() || "card"}.pdf`);
    toast.success("Card PDF downloaded!");
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
            <p className="text-sm text-muted-foreground">Register a new patient and generate NFC scan URL</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {generatedUrl ? (
          <Card className="p-8 text-center space-y-6">
            <div className="bg-stable/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center">
              <UserPlus className="h-8 w-8 text-stable" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">Patient Registered!</h2>
            <p className="text-muted-foreground">
              Share this URL, scan the QR code, or program it into an NFC/UUID card. When scanned, it will display the patient's medical details.
            </p>

            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-border inline-block">
                <QRCodeSVG value={generatedUrl} size={200} level="H" />
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <QrCode className="h-4 w-4" />
                <span>Scan this QR code to access patient profile</span>
              </div>
            </div>

            {/* Hidden QR for PDF generation */}
            <div id="pdf-qr-code" className="hidden">
              <QRCodeSVG value={generatedUrl} size={200} level="H" />
            </div>

            {/* Card ID info */}
            {cardMethod === "UUID_CARD" && uuidCardNumber && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="text-muted-foreground">UUID Card Number: </span>
                <span className="font-mono font-semibold text-foreground">{uuidCardNumber}</span>
              </div>
            )}

            <div className="flex items-center gap-2 bg-muted p-3 rounded-lg">
              <code className="flex-1 text-sm text-foreground break-all text-left">{generatedUrl}</code>
              <Button size="sm" variant="outline" onClick={copyUrl}>
                <Copy className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => window.open(generatedUrl, "_blank")}>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button variant="outline" onClick={generateCardPDF}>
                <Printer className="h-4 w-4 mr-2" />
                Download Card PDF
              </Button>
              <Button onClick={() => { setGeneratedUrl(null); navigate("/add-patient"); window.location.reload(); }}>
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

            {/* Card Type & Monitoring */}
            <Card className="p-6 space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Card Type & Monitoring
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Card Method</Label>
                  <Select value={cardMethod} onValueChange={(v) => setCardMethod(v as "NFC" | "UUID_CARD")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NFC">NFC Card</SelectItem>
                      <SelectItem value="UUID_CARD">UUID Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" />
                    Monitoring Priority
                  </Label>
                  <Select value={monitoringPriority} onValueChange={setMonitoringPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stable">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                          Stable — Routine monitoring
                        </span>
                      </SelectItem>
                      <SelectItem value="urgent">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-yellow-500" />
                          Urgent — Frequent check-ins
                        </span>
                      </SelectItem>
                      <SelectItem value="critical">
                        <span className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-red-500" />
                          Critical — Continuous monitoring
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {cardMethod === "UUID_CARD" && (
                <div>
                  <Label htmlFor="uuidCardNumber">UUID Card Number *</Label>
                  <Input
                    id="uuidCardNumber"
                    value={uuidCardNumber}
                    onChange={(e) => setUuidCardNumber(e.target.value)}
                    placeholder="Enter UUID card number (printed on the card)"
                    required
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the unique identifier printed on the patient's physical card. This will be used to look up their record when scanned.
                  </p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {cardMethod === "NFC" 
                  ? "An NFC card will be programmed with the patient URL. Use the Write NFC page after registration."
                  : "A UUID card stores a printed identifier that links to this patient's record when scanned by a reader."}
              </p>
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
                  Register Patient & Generate URL
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
