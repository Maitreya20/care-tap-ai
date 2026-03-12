import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory rate limiter (per user, max 10 requests per minute)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_WINDOW_MS });
    return true;
  }
  if (userLimit.count >= RATE_LIMIT) return false;
  userLimit.count++;
  return true;
}

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 2000;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required. Please sign in.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication. Please sign in again.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    if (!checkRateLimit(user.id)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute before sending more messages.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'AI service is not configured. Please contact an administrator.' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate messages
    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_MESSAGES} messages allowed. Please clear the chat and start a new conversation.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const validRoles = ['user', 'assistant'];
    for (const msg of messages) {
      if (!msg.role || !validRoles.includes(msg.role)) {
        return new Response(JSON.stringify({ error: 'Invalid message format' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (typeof msg.content !== 'string' || msg.content.length > MAX_MESSAGE_LENGTH) {
        return new Response(JSON.stringify({ error: `Messages must be under ${MAX_MESSAGE_LENGTH} characters` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch patient context if available
    let patientContext = '';
    try {
      const { data: patientData } = await supabase.rpc('get_patient_id', { _user_id: user.id });
      if (patientData) {
        const [{ data: profile }, { data: medications }, { data: allergies }] = await Promise.all([
          supabase.from('profiles').select('full_name, date_of_birth, gender').eq('id', user.id).single(),
          supabase.from('medications').select('medication_name, dosage, frequency').eq('patient_id', patientData).eq('is_active', true),
          supabase.from('allergies').select('allergen, severity').eq('patient_id', patientData),
        ]);

        if (profile) {
          patientContext = `\n\nPatient context (use to personalize responses):
- Name: ${profile.full_name}
${profile.date_of_birth ? `- Date of birth: ${profile.date_of_birth}` : ''}
${profile.gender ? `- Gender: ${profile.gender}` : ''}
${medications && medications.length > 0 ? `- Current medications: ${medications.map(m => `${m.medication_name} ${m.dosage} ${m.frequency}`).join(', ')}` : ''}
${allergies && allergies.length > 0 ? `- Known allergies: ${allergies.map(a => `${a.allergen} (${a.severity})`).join(', ')}` : ''}`;
        }
      }
    } catch (e) {
      // Patient context is optional, continue without it
      console.log('Could not fetch patient context:', e);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: `You are a helpful medical assistant chatbot for MediScan AI, an emergency health response system. You can help answer general health questions, provide first-aid guidance, and explain medical terminology. 

Key guidelines:
- Always recommend consulting a healthcare professional for specific medical advice or diagnosis.
- Be empathetic, clear, and concise.
- Use markdown formatting for readability (bullet points, bold for emphasis, headers for sections).
- If a user describes emergency symptoms (chest pain, difficulty breathing, severe bleeding, stroke signs), immediately advise calling emergency services (911).
- Never prescribe medications or provide dosage changes - only explain general information.
- If you have patient context below, use it to personalize responses but never reveal raw data back to the user.${patientContext}`
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorStatus = response.status;
      console.error('OpenAI API error:', errorStatus);
      
      if (errorStatus === 429) {
        return new Response(JSON.stringify({ error: 'AI service is temporarily busy. Please try again in a moment.' }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenAI API error: ${errorStatus}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message.content;

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in chatbot function:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
