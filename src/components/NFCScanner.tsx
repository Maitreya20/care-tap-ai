import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Smartphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface NFCScannerProps {
  onPatientScanned: (patientId: string) => void;
}

export const NFCScanner = ({ onPatientScanned }: NFCScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(true);

  const handleNFCScan = async () => {
    // Check if Web NFC is supported
    if (!('NDEFReader' in window)) {
      setNfcSupported(false);
      toast.error("NFC not supported on this device", {
        description: "Web NFC requires Chrome on Android. Using demo mode instead."
      });
      // Demo mode - simulate scan after 2 seconds
      setIsScanning(true);
      setTimeout(() => {
        setIsScanning(false);
        onPatientScanned("DEMO-12345");
        toast.success("Demo patient loaded");
      }, 2000);
      return;
    }

    try {
      setIsScanning(true);
      // @ts-ignore - Web NFC API types
      const ndef = new NDEFReader();
      await ndef.scan();

      toast.info("Ready to scan", {
        description: "Hold NFC card near your device"
      });

      // @ts-ignore
      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        console.log("NFC tag detected:", serialNumber);
        
        for (const record of message.records) {
          if (record.recordType === "text") {
            const textDecoder = new TextDecoder(record.encoding || "utf-8");
            const patientId = textDecoder.decode(record.data);
            
            setIsScanning(false);
            onPatientScanned(patientId);
            toast.success("Patient card scanned successfully");
            return;
          }
        }
        
        // If no valid record found, use serial number
        setIsScanning(false);
        onPatientScanned(serialNumber);
        toast.success("NFC tag detected");
      });

      // @ts-ignore
      ndef.addEventListener("readingerror", () => {
        setIsScanning(false);
        toast.error("Failed to read NFC tag");
      });

    } catch (error) {
      console.error("NFC error:", error);
      setIsScanning(false);
      toast.error("NFC scan failed", {
        description: "Please check permissions and try again"
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
          Scan NFC Health Card
        </h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          {nfcSupported 
            ? "Tap the patient's NFC health card or wearable to access their emergency medical profile"
            : "NFC not available - demo mode enabled"
          }
        </p>

        <Button 
          size="lg" 
          onClick={handleNFCScan}
          disabled={isScanning}
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-lg"
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
      </Card>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 flex items-start gap-3 bg-card border border-border">
          {nfcSupported ? (
            <>
              <CheckCircle2 className="h-5 w-5 text-stable mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-foreground">NFC Ready</h4>
                <p className="text-xs text-muted-foreground">Device supports Web NFC scanning</p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-urgent mt-0.5" />
              <div>
                <h4 className="font-semibold text-sm text-foreground">Demo Mode</h4>
                <p className="text-xs text-muted-foreground">NFC unavailable - using simulation</p>
              </div>
            </>
          )}
        </Card>

        <Card className="p-4 flex items-start gap-3 bg-card border border-border">
          <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold text-sm text-foreground">Encrypted Data</h4>
            <p className="text-xs text-muted-foreground">Patient IDs are AES-256 encrypted</p>
          </div>
        </Card>
      </div>
    </div>
  );
};
