import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { roleFromAccessToken } from "./claims";
import { supabase } from "./supabase";

// Re-exported rather than redeclared. The guard path is the last place that
// should hold a second opinion about what a role is.
import type { Role } from "@legal-ai/db";
export type { Role };

interface AuthState {
  session: Session | null;
  role: Role | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  role: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Role lives in the token's app_metadata claim: set server-side only, by the
  // access token hook from `user_roles` (ADR-0026), and never editable by the
  // user, unlike user_metadata. Read from the claims and not from
  // `session.user.app_metadata` — the user object is built from the jsonb the
  // role no longer lives in, so it would say "no role" for an admin.
  const role = session === null ? null : roleFromAccessToken(session.access_token);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, role, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
