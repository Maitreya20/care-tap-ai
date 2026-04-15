import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory rate limiter
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
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a minute.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY is not configured');
      return new Response(JSON.stringify({ error: 'AI service is not configured.' }), {
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

    if (messages.length > MAX_MESSAGES) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_MESSAGES} messages allowed. Please clear the chat.` }), {
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
      const { data: patientId } = await supabase.rpc('get_patient_id', { _user_id: user.id });
      if (patientId) {
        const [{ data: profile }, { data: medications }, { data: allergies }] = await Promise.all([
          supabase.from('profiles').select('full_name, date_of_birth, gender').eq('id', user.id).single(),
          supabase.from('medications').select('medication_name, dosage, frequency').eq('patient_id', patientId).eq('is_active', true),
          supabase.from('allergies').select('allergen, severity').eq('patient_id', patientId),
        ]);

        if (profile) {
          const age = profile.date_of_birth
            ? Math.floor((Date.now() - new Date(profile.date_of_birth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
            : null;

          patientContext = `\n\nPatient context (use to personalize responses):
- Name: ${profile.full_name}
${age !== null && age > 0 ? `- Age: ${age} years` : '- Age: Unknown'}
${profile.gender ? `- Gender: ${profile.gender}` : ''}
${medications && medications.length > 0 ? `- Current medications: ${medications.map(m => `${m.medication_name} ${m.dosage} ${m.frequency}`).join(', ')}` : ''}
${allergies && allergies.length > 0 ? `- Known allergies: ${allergies.map(a => `${a.allergen} (${a.severity})`).join(', ')}` : ''}`;
        }
      }
    } catch (e) {
      console.log('Could not fetch patient context:', e);
    }

    console.log(`Chatbot request from user ${user.id}, ${messages.length} messages`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { 
            role: 'system', 
            content: `You are a warm, empathetic, and knowledgeable medical assistant for MediScan AI. You talk like a caring doctor friend — approachable and easy to understand.

Core behavior:
- Understand casual, everyday language. Users may say "my tummy hurts", "I feel weird", "got a rash", etc. — interpret naturally.
- Ask gentle follow-up questions to understand symptoms better (location, duration, severity, triggers).
- Explain medical terms in simple language when you use them.
- Give practical, actionable advice (home remedies, when to see a doctor, red flags to watch for).
- Use markdown for readability: **bold** key points, bullet lists for steps, headers for sections.
- Be conversational — use contractions, short sentences, and a reassuring tone.
- Remember context from earlier in the conversation.

Safety rules:
- For emergency symptoms (chest pain, difficulty breathing, severe bleeding, stroke signs, allergic reaction with swelling), IMMEDIATELY and clearly advise calling emergency services (911/112).
- Always recommend seeing a healthcare professional for persistent or worsening symptoms.
- Never prescribe specific medications or dosage changes — only provide general educational information.
- If you have patient context below, use it to personalize your responses naturally (e.g., noting drug interactions with their current medications, or allergy warnings) but never dump raw medical data.${patientContext}`
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorStatus = response.status;
      const errorText = await response.text();
      console.error('AI Gateway error:', errorStatus, errorText);
      
      if (errorStatus === 429) {
        return new Response(JSON.stringify({ error: 'AI service is temporarily busy. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (errorStatus === 402) {
        return new Response(JSON.stringify({ error: 'AI service payment required. Please contact administrator.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`AI Gateway error: ${errorStatus}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices?.[0]?.message?.content;

    if (!assistantMessage) {
      console.error('No content in AI response:', JSON.stringify(data));
      throw new Error('Empty AI response');
    }

    return new Response(JSON.stringify({ message: assistantMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Chatbot error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(JSON.stringify({ error: 'An error occurred. Please try again.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
