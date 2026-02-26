import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, AlertCircle, CheckCircle2, Usb, Keyboard, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const patientIdSchema = z.string().uuid("Must be a valid patient UUID");

const extractPatientId = (rawData: string): string | null => {
  const trimmed = rawData.trim();
  const directId = patientIdSchema.safeParse(trimmed);
  if (directId.success) return directId.data;

  try {
    const parsedUrl = new URL(trimmed);
    const match = parsedUrl.pathname.match(/^\/patient\/([0-9a-fA-F-]{36})$/);
    if (!match?.[1]) return null;

    const fromUrl = patientIdSchema.safeParse(match[1]);
    return fromUrl.success ? fromUrl.data : null;
  } catch {
    return null;
  }
};

interface NFCScannerProps {
  onPatientScanned: (patientId: string) => void;
}

export const NFCScanner = ({ onPatientScanned }: NFCScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [nfcSupported] = useState(() => "NDEFReader" in window);
  const [manualInput, setManualInput] = useState("");
  const [uuidCardInput, setUuidCardInput] = useState("");
  const [isLookingUp, setIsLookingUp] = useState(false);

  const handleNFCScan = async () => {
    if (!nfcSupported) {
      toast.error("NFC not supported on this device", {
        description: "Web NFC requires Chrome on Android. Use the Hardware Reader or Manual tab instead."
      });
      return;
    }

    try {
      setIsScanning(true);
      // @ts-ignore - Web NFC API
      const ndef = new NDEFReader();
      await ndef.scan();

      toast.info("Ready to scan", {
        description: "Hold NFC card near your device"
      });

      // @ts-ignore - Web NFC API
      ndef.addEventListener("reading", ({ message }) => {
        for (const record of message.records) {
          if (record.recordType === "text" || record.recordType === "url") {
            const textDecoder = new TextDecoder(record.encoding || "utf-8");
            const rawData = textDecoder.decode(record.data);

            const extractedPatientId = extractPatientId(rawData);
            if (!extractedPatientId) {
              setIsScanning(false);
              toast.error("Invalid NFC tag data", {
                description: "Tag does not contain a valid patient ID or patient URL"
              });
              return;
            }

            setIsScanning(false);
            onPatientScanned(extractedPatientId);
            toast.success("Patient card scanned successfully");
            return;
          }
        }

        setIsScanning(false);
        toast.error("No valid patient data found on NFC tag");
      });

      // @ts-ignore - Web NFC API
      ndef.addEventListener("readingerror", () => {
        setIsScanning(false);
        toast.error("Failed to read NFC tag");
      });
    } catch {
      setIsScanning(false);
      toast.error("NFC scan failed", {
        description: "Please check permissions and try again"
      });
    }
  };

  const handleManualSubmit = () => {
    const extractedId = extractPatientId(manualInput);
    if (!extractedId) {
      toast.error("Invalid input", {
        description: "Enter a valid patient UUID or patient URL (e.g. /patient/<uuid>)"
      });
      return;
    }
    onPatientScanned(extractedId);
    toast.success("Patient loaded successfully");
  };

  const handleUuidCardLookup = async () => {
    const cardNumber = uuidCardInput.trim();
    if (!cardNumber) {
      toast.error("Enter a UUID card number");
      return;
    }

    setIsLookingUp(true);
    try {
      // Look up patient by card number using the nfc_cards table
      const { data, error } = await supabase
        .from("nfc_cards")
        .select("patient_id")
        .eq("encrypted_card_id", cardNumber)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        toast.error("Card not found", {
          description: "No active patient record found for this UUID card number"
        });
        return;
      }

      onPatientScanned(data.patient_id);
      toast.success("Patient found via UUID card");
    } catch {
      toast.error("Lookup failed", {
        description: "Could not search for card number"
      });
    } finally {
      setIsLookingUp(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error("Clipboard is empty");
        return;
      }
      setManualInput(text);
      const extractedId = extractPatientId(text);
      if (extractedId) {
        onPatientScanned(extractedId);
        toast.success("Patient loaded from clipboard");
      } else {
        toast.error("Clipboard data is not a valid patient ID or URL");
      }
    } catch {
      toast.error("Could not read clipboard", {
        description: "Please paste manually into the input field"
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-8 text-center bg-card border-2 border-primary/20">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary/10 rounded-full mb-6">
          <Smartphone className="h-10 w-10 text-primary" />
        </div>

        <h2 className="text-2xl font-bold text-foreground mb-2">
          Scan Patient Card
        </h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Tap an NFC card, scan a UUID card, or enter details manually to access a patient's emergency medical profile.
        </p>

        <Tabs defaultValue={nfcSupported ? "mobile" : "uuid-card"} className="w-full max-w-md mx-auto text-left">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="mobile" className="text-xs">
              <Smartphone className="h-3.5 w-3.5 mr-1" />
              Mobile NFC
            </TabsTrigger>
            <TabsTrigger value="uuid-card" className="text-xs">
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              UUID Card
            </TabsTrigger>
            <TabsTrigger value="hardware" className="text-xs">
              <Usb className="h-3.5 w-3.5 mr-1" />
              Hardware
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              <Keyboard className="h-3.5 w-3.5 mr-1" />
              Manual
            </TabsTrigger>
          </TabsList>

          {/* Mobile NFC (Web NFC API) */}
          <TabsContent value="mobile" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              {nfcSupported
                ? "Tap the patient's NFC card on your phone."
                : "Web NFC is not available on this device. Use UUID Card or Manual entry instead."}
            </p>
            <Button
              size="lg"
              onClick={handleNFCScan}
              disabled={isScanning || !nfcSupported}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isScanning ? (
                <>
                  <div className="mr-2 h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Scanning...
                </>
              ) : (
                <>
                  <Smartphone className="mr-2 h-5 w-5" />
                  Start NFC Scan
                </>
              )}
            </Button>
          </TabsContent>

          {/* UUID Card */}
          <TabsContent value="uuid-card" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the UUID card number printed on the patient's card to look up their record.
            </p>
            <Input
              placeholder="Enter UUID card number..."
              value={uuidCardInput}
              onChange={(e) => setUuidCardInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUuidCardLookup()}
            />
            <Button
              onClick={handleUuidCardLookup}
              disabled={!uuidCardInput.trim() || isLookingUp}
              className="w-full"
            >
              {isLookingUp ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Looking up...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Look Up Patient
                </>
              )}
            </Button>
          </TabsContent>

          {/* Hardware Reader (ACR122U, etc.) */}
          <TabsContent value="hardware" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Use your USB NFC reader to scan the card, then paste the result here.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Paste scanned UUID or URL..."
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
              />
              <Button variant="secondary" onClick={handlePasteFromClipboard} title="Paste from clipboard">
                Paste
              </Button>
            </div>
            <Button onClick={handleManualSubmit} disabled={!manualInput.trim()} className="w-full">
              <Usb className="mr-2 h-4 w-4" />
              Load Patient
            </Button>
          </TabsContent>

          {/* Manual Entry */}
          <TabsContent value="manual" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Type or paste a patient UUID or full patient URL.
            </p>
            <Input
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            />
            <Button onClick={handleManualSubmit} disabled={!manualInput.trim()} className="w-full">
              <Keyboard className="mr-2 h-4 w-4" />
              Load Patient
            </Button>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4 flex items-start gap-3 bg-card border border-border">
          {nfcSupported ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-foreground">Mobile NFC Ready</h4>
                <p className="text-xs text-muted-foreground">Web NFC supported</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-sm text-foreground">Mobile NFC Unavailable</h4>
                <p className="text-xs text-muted-foreground">Use UUID card or hardware reader</p>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4 flex items-start gap-3 bg-card border border-border">
          <CreditCard className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">UUID Card Support</h4>
            <p className="text-xs text-muted-foreground">Look up patients by card number</p>
          </div>
        </Card>

        <Card className="p-4 flex items-start gap-3 bg-card border border-border">
          <Usb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">Hardware Readers</h4>
            <p className="text-xs text-muted-foreground">ACR122U & compatible USB readers</p>
          </div>
        </Card>
      </div>
    </div>
  );
};