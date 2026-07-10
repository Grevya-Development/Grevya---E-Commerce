import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    }
)

/**
 * Temporary Compatibility Layer: Dynamic Token Injection
 * Connects third-party Clerk JWTs to Supabase queries for RLS check resolution.
 * This can be safely deprecated if direct client-to-database requests are moved to a backend.
 */
export const setSupabaseToken = async (clerkToken: string | null) => {
    if (clerkToken) {
        await supabase.auth.setSession({
            access_token: clerkToken,
            refresh_token: "",
        });
    } else {
        await supabase.auth.signOut();
    }
};
