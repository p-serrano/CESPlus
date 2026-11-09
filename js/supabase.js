/* =====================================================
   CESPLUS — SUPABASE
   Conexión con la base de datos
   ===================================================== */

import { createClient } from
    "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "TU_URL_DE_SUPABASE";

const SUPABASE_ANON_KEY = "TU_CLAVE_ANON_PUBLIC";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    }
);