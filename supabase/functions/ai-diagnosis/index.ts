import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiter (per user, max 10 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000; // 1 minute

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }

  if (userLimit.count >= RATE_LIMIT) {
    return false;
  }

  userLimit.count++;
  return true;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's auth context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error("Auth error:", authError?.message);
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`User ${user.id} requesting AI diagnosis`);

    // Check rate limit
    if (!checkRateLimit(user.id)) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      return new Response(
        JSON.stringify({ error: "Rate limit exceeded. Please wait before making another request." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has medical_responder or hospital_admin role
    const { data: roles, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (roleError) {
      console.error("Role check error:", roleError.message);
      return new Response(
        JSON.stringify({ error: "Failed to verify user role" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hasPermission = roles?.some(
      (r) => r.role === "medical_responder" || r.role === "hospital_admin"
    );

    if (!hasPermission) {
      console.warn(`User ${user.id} lacks required role for AI diagnosis`);
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Medical responder or admin role required." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const { patientData } = await req.json();
    if (!patientData) {
      return new Response(
        JSON.stringify({ error: "Patient data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate patient data structure
    if (!patientData.name || !patientData.age || !patientData.bloodType) {
      return new Response(
        JSON.stringify({ error: "Invalid patient data structure" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing AI diagnosis for patient: ${patientData.name}`);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are an expert medical AI assistant for emergency medical responders. Analyze patient data and provide triage recommendations.

IMPORTANT: You provide preliminary AI-assisted analysis only. All recommendations must be verified by trained medical professionals.

Respond with a JSON object containing:
{
  "triageLevel": "critical" | "urgent" | "stable",
  "probableConditions": [{"name": string, "confidence": number (0-100)}],
  "immediateActions": string[],
  "medicationRecommendations": [{"medication": string, "reason": string, "warning": string}],
  "explanation": string
}

Consider the patient's:
- Medical history and existing conditions
- Current medications (check for interactions)
- Known allergies (CRITICAL for medication recommendations)
- Age and blood type`;

    const userPrompt = `Analyze this patient for emergency triage:

Name: ${patientData.name}
Age: ${patientData.age}
Blood Type: ${patientData.bloodType}
Known Allergies: ${patientData.allergies?.join(", ") || "None reported"}
Current Medications: ${patientData.medications?.join(", ") || "None reported"}
Medical Conditions: ${patientData.conditions?.join(", ") || "None reported"}

Provide your emergency triage analysis.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResponse.ok) {
      const errorStatus = aiResponse.status;
      console.error(`AI Gateway error: ${errorStatus}`);

      if (errorStatus === 429) {
        return new Response(
          JSON.stringify({ error: "AI service rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errorStatus === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required. Please contact administrator." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const analysisContent = aiData.choices?.[0]?.message?.content;

    if (!analysisContent) {
      console.error("No content in AI response");
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let analysis;
    try {
      analysis = JSON.parse(analysisContent);
    } catch {
      console.error("Failed to parse AI response:", analysisContent);
      return new Response(
        JSON.stringify({ error: "Failed to parse AI analysis" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the request to access_logs
    const { error: logError } = await supabase.from("access_logs").insert({
      user_id: user.id,
      action: "ai_diagnosis",
      resource: "ai-diagnosis",
      metadata: {
        patient_name: patientData.name,
        triage_level: analysis.triageLevel,
      },
    });

    if (logError) {
      console.warn("Failed to log access:", logError.message);
      // Don't fail the request for logging errors
    }

    console.log(`AI diagnosis completed for patient ${patientData.name}: ${analysis.triageLevel}`);

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
