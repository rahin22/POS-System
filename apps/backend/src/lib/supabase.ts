import { createClient, type User } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service role client for admin operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Why a token was refused. The distinction matters operationally: an expired token
 * means the device stopped refreshing and should retry after a refresh, a bad JWT
 * will never succeed no matter how often it is retried, and an unreachable auth API
 * is our problem rather than the caller's.
 */
export type TokenFailure = 'token_expired' | 'bad_jwt' | 'rejected' | 'auth_unreachable';

export interface TokenCheck {
  user: User | null;
  reason?: TokenFailure;
  detail?: string;
}

// Verify a user's JWT token against Supabase Auth.
export async function verifySupabaseToken(token: string): Promise<TokenCheck> {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (user) {
      return { user };
    }

    // Previously every one of these collapsed into a bare "Invalid token" with nothing
    // written to the log, which made an expired session on one device indistinguishable
    // from a rotated service key or a Supabase outage.
    const code = (error as { code?: string } | null)?.code ?? '';
    const message = error?.message ?? 'auth API returned no user';

    const reason: TokenFailure =
      code === 'session_expired' || /expired/i.test(message)
        ? 'token_expired'
        : code === 'bad_jwt' || /jwt|malformed|signature/i.test(message)
          ? 'bad_jwt'
          : 'rejected';

    return { user: null, reason, detail: message };
  } catch (error: any) {
    // Thrown rather than returned means we never got an answer from Supabase at all
    return {
      user: null,
      reason: 'auth_unreachable',
      detail: error?.message ?? String(error),
    };
  }
}
