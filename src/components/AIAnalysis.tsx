import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, AlertCircle, Activity, Volume2, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PatientData {
  id: string;
  name: string;
  age: number;
  bloodType: string;
  allergies: string[];
  medications: string[];
  conditions: string[];
}

interface AIAnalysisProps {
  patient: PatientData;
  isLoading: boolean;
  onVoiceAlert: (text: string) => void;
}

interface DiagnosisResult {
  triageLevel: "critical" | "urgent" | "stable";
  probableConditions: Array<{
    condition: string;
    confidence: number;
    severity: string;
  }>;
  immediateActions: string[];
  recommendations: string[];
  explanation: string;
}

// Mock AI analysis result based on patient data
const generateMockAnalysis = (patient: PatientData): DiagnosisResult => {
  const hasCardiacHistory = patient.conditions.some(c => c.toLowerCase().includes('mi') || c.toLowerCase().includes('heart'));
  const hasDiabetes = patient.conditions.some(c => c.toLowerCase().includes('diabetes'));
  
  return {
    triageLevel: hasCardiacHistory ? "urgent" : "stable",
    probableConditions: [
      { 
        condition: hasCardiacHistory ? "Acute Coronary Syndrome" : "Hypertensive Crisis", 
        confidence: hasCardiacHistory ? 72 : 45,
        severity: hasCardiacHistory ? "High" : "Moderate"
      },
      { 
        condition: hasDiabetes ? "Diabetic Emergency" : "Cardiac Arrhythmia", 
        confidence: hasDiabetes ? 58 : 38,
        severity: "Moderate"
      },
      { 
        condition: "Medication Interaction", 
        confidence: 34,
        severity: "Low-Moderate"
      }
    ],
    immediateActions: hasCardiacHistory ? [
      "Call ambulance immediately (suspected cardiac event)",
      "Administer aspirin 325mg if conscious and no allergy",
      "Monitor vital signs every 2 minutes",
      "Prepare for CPR - history of MI present",
      "Do NOT administer nitroglycerin without BP reading"
    ] : [
      "Monitor blood pressure - patient on antihypertensives",
      "Check blood glucose levels - active diabetic",
      "Assess consciousness and responsiveness",
      "Prepare emergency contact information",
      "Monitor for allergic reactions"
    ],
    recommendations: [
      "Avoid Penicillin-based antibiotics (documented allergy)",
      "Continue current medications unless contraindicated",
      "Fast-track to cardiac unit if chest pain present",
      "Blood glucose monitoring required - on Metformin",
      "Contact emergency contact: Sarah Anderson"
    ],
    explanation: hasCardiacHistory 
      ? "Patient has documented history of myocardial infarction (2020) and is currently on cardiac medications. Combined with age (45) and hypertension, any cardiac symptoms warrant immediate emergency response. Aspirin administration is critical if ACS suspected."
      : "Patient presents with multiple chronic conditions requiring careful medication management. Monitor for drug interactions between Metformin, Lisinopril, and Aspirin. Blood glucose and BP monitoring are essential."
  };
};

export const AIAnalysis = ({ patient, isLoading, onVoiceAlert }: AIAnalysisProps) => {
  const analysis = generateMockAnalysis(patient);

  const triageColors = {
    critical: {
      bg: "bg-critical/10",
      border: "border-critical",
      text: "text-critical",
      badge: "bg-critical text-white"
    },
    urgent: {
      bg: "bg-urgent/10",
      border: "border-urgent",
      text: "text-urgent",
      badge: "bg-urgent text-white"
    },
    stable: {
      bg: "bg-stable/10",
      border: "border-stable",
      text: "text-stable",
      badge: "bg-stable text-white"
    }
  };

  const colors = triageColors[analysis.triageLevel];

  if (isLoading) {
    return (
      <Card className="p-6 bg-card border border-border">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="h-6 w-6 text-primary animate-pulse" />
          <h3 className="text-xl font-bold text-foreground">AI Emergency Analysis</h3>
        </div>
        <div className="space-y-4">
          <div className="h-4 bg-muted rounded animate-pulse" />
          <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
          <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
          <p className="text-sm text-muted-foreground text-center mt-8">
            Analyzing patient history and generating diagnosis...
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 bg-card border border-border">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brain className="h-6 w-6 text-primary" />
          <h3 className="text-xl font-bold text-foreground">AI Emergency Analysis</h3>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onVoiceAlert(`URGENT: Triage level ${analysis.triageLevel}. ${analysis.immediateActions[0]}`)}
          className="border-border"
        >
          <Volume2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Triage Level */}
      <div className={`p-4 rounded-lg border-2 ${colors.border} ${colors.bg} mb-6`}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-foreground">TRIAGE LEVEL</span>
          <Badge className={colors.badge}>
            {analysis.triageLevel.toUpperCase()}
          </Badge>
        </div>
        <p className={`text-2xl font-bold ${colors.text}`}>
          {analysis.triageLevel === "critical" && "⚠️ CRITICAL - Immediate Intervention"}
          {analysis.triageLevel === "urgent" && "🔶 URGENT - Priority Care Required"}
          {analysis.triageLevel === "stable" && "✓ STABLE - Standard Monitoring"}
        </p>
      </div>

      {/* Probable Conditions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Probable Conditions (AI Assessment)</span>
        </div>
        <div className="space-y-3">
          {analysis.probableConditions.map((item, idx) => (
            <div key={idx} className="p-3 bg-muted rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{item.condition}</span>
                <Badge variant="outline" className="border-primary text-primary">
                  {item.severity}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <Progress value={item.confidence} className="flex-1 h-2" />
                <span className="text-xs font-mono text-muted-foreground w-12 text-right">
                  {item.confidence}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Immediate Actions */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className={`h-4 w-4 ${colors.text}`} />
          <span className="text-sm font-semibold text-foreground">Immediate Actions Required</span>
        </div>
        <ol className="space-y-2">
          {analysis.immediateActions.map((action, idx) => (
            <li key={idx} className={`text-sm p-3 rounded-lg border-l-4 ${colors.border} ${colors.bg}`}>
              <span className="font-semibold mr-2">{idx + 1}.</span>
              {action}
            </li>
          ))}
        </ol>
      </div>

      {/* Recommendations */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Clinical Recommendations</span>
        </div>
        <ul className="space-y-2">
          {analysis.recommendations.map((rec, idx) => (
            <li key={idx} className="text-sm text-muted-foreground bg-muted p-2 rounded flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* AI Explanation */}
      <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
        <p className="text-xs text-muted-foreground leading-relaxed">
          <strong className="text-foreground">AI Reasoning:</strong> {analysis.explanation}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          ⚕️ AI-assisted analysis only. Licensed medical professionals must make final treatment decisions.
        </p>
      </div>
    </Card>
  );
};
