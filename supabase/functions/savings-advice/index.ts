import { createSavingsAdviceHandler } from "./handler.ts";

Deno.serve(createSavingsAdviceHandler({
  supabaseUrl: Deno.env.get("SUPABASE_URL"),
  supabaseKey: Deno.env.get("SUPABASE_ANON_KEY"),
  ownerId: Deno.env.get("PAYPLAN_ADVICE_OWNER_ID"),
  openAiKey: Deno.env.get("OPENAI_API_KEY"),
}));
