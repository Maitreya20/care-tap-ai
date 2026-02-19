import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Nfc, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const WriteNFC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patients, setPatients] = useState<{ id: string; name: string; email: string }[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [isWriting, setIsWriting] = useState(false);
  const [writeStatus, setWriteStatus] = useState<"idle" | "ready" | "success" | "error">("idle");
  const [nfcSupported, setNfcSupported] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");

  useEffect(() => {
    setNfcSupported("NDEFReader" in window);
  }, []);

  useEffect(() => {
    const fetchPatients = async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, user_id")
        .eq("is_active", true);

      if (error || !data) return;

      const profileIds = data.map((p) => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds);

      const merged = data.map((p) => {
        const profile = profiles?.find((pr) => pr.id === p.user_id);
        return {
          id: p.id,
          name: profile?.full_name || "Unknown",
          email: profile?.email || "",
        };
      });
      setPatients(merged);
    };
    fetchPatients();
  }, []);

  const patientUrl = selectedPatientId
    ? `${window.location.origin}/patient/${selectedPatientId}`
    : "";

  const handleWriteNFC = async () => {
    if (!selectedPatientId) {
      toast.error("Please select a patient first");
      return;
    }

    if (!nfcSupported) {
      toast.error("Web NFC not supported", {
        description: "Web NFC requires Chrome on Android. The URL has been copied to clipboard instead.",
      });
      navigator.clipboard.writeText(patientUrl);
      setGeneratedUrl(patientUrl);
      setWriteStatus("success");
      return;
    }

    try {
      setIsWriting(true);
      setWriteStatus("ready");
      toast.info("Hold NFC card near your device to write...");

      // @ts-ignore - Web NFC API
      const ndef = new NDEFReader();

      await ndef.write({
        records: [
          {
            recordType: "url",
            data: patientUrl,
          },
          {
            recordType: "text",
            data: selectedPatientId,
          },
        ],
      });

      setWriteStatus("success");
      setGeneratedUrl(patientUrl);
      setIsWriting(false);
      toast.success("NFC card written successfully!", {
        description: "The patient URL has been written to the NFC card.",
      });
    } catch (error: any) {
      console.error("NFC write error:", error);
      setIsWriting(false);
      setWriteStatus("error");
      toast.error("Failed to write NFC card", {
        description: error?.message || "Check permissions and try again.",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">Write NFC Card</h1>
            <p className="text-sm text-muted-foreground">Program patient URL onto NFC card</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-xl space-y-6">
        {/* Step 1: Select Patient */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">1. Select Patient</h2>
          <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a patient..." />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} — {p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPatientId && (
            <div className="bg-muted rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Patient URL to write:</p>
              <code className="text-sm text-foreground break-all">{patientUrl}</code>
            </div>
          )}
        </Card>

        {/* Step 2: Write to NFC */}
        <Card className="p-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mx-auto">
            <Nfc className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">2. Write to NFC Card</h2>
          <p className="text-sm text-muted-foreground">
            {nfcSupported
              ? "Place the NFC card on your device and click write."
              : "Web NFC not available — the URL will be copied to clipboard instead."}
          </p>
          <Button
            size="lg"
            onClick={handleWriteNFC}
            disabled={!selectedPatientId || isWriting}
            className="w-full"
          >
            {isWriting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Waiting for NFC card...
              </>
            ) : (
              <>
                <Nfc className="mr-2 h-5 w-5" />
                {nfcSupported ? "Write to NFC Card" : "Copy URL to Clipboard"}
              </>
            )}
          </Button>
        </Card>

        {/* Status */}
        {writeStatus === "success" && (
          <Card className="p-4 flex items-start gap-3 border-primary/30 bg-primary/5">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-foreground">
                {nfcSupported ? "NFC Card Written!" : "URL Copied!"}
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                {nfcSupported
                  ? "Scanning this card will open the patient's emergency profile."
                  : "Paste the URL into your NFC writer app."}
              </p>
              <code className="text-xs text-primary break-all mt-2 block">{generatedUrl}</code>
            </div>
          </Card>
        )}

        {writeStatus === "error" && (
          <Card className="p-4 flex items-start gap-3 border-destructive/30 bg-destructive/5">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h4 className="font-semibold text-sm text-foreground">Write Failed</h4>
              <p className="text-xs text-muted-foreground">
                Make sure the card is an NTAG or MIFARE tag and try again.
              </p>
            </div>
          </Card>
        )}

        {/* Instructions */}
        <Card className="p-5 space-y-3 bg-muted/50">
          <h3 className="font-semibold text-sm text-foreground">Instructions</h3>
          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
            <li>Select the patient whose profile you want to link.</li>
            <li>Place an NFC card/tag on your reader (ACR122U or phone).</li>
            <li>Click "Write to NFC Card" — keep the card steady.</li>
            <li>Once written, scanning the card opens the patient's emergency profile.</li>
          </ol>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Tip:</strong> Web NFC requires Chrome 89+ on Android. For desktop, use an NFC writer app with the copied URL.
          </p>
        </Card>
      </main>
    </div>
  );
};

export default WriteNFC;
