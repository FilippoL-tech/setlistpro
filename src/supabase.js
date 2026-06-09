import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error(
    "Supabase: variabili d'ambiente mancanti — controlla VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (in .env.local in locale, su Vercel in produzione)."
  );
}

export const supabase = createClient(url, anonKey);
