import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/SupabaseClient";
import { saveUserProfile } from "../lib/profileManager";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const syncedUserIdRef = useRef(null);

  function buildProfileFromUser(currentUser) {
    if (!currentUser) return null;
    const meta = currentUser.user_metadata || {};
    const defaultHandle = currentUser.email ? currentUser.email.split("@")[0] : "User";
    return {
      id: currentUser.id,
      email: currentUser.email,
      username: meta.username || defaultHandle,
      avatar_url: meta.avatar_url || null,
    };
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        setSession(initialSession || null);
        setUser(initialSession?.user || null);

        if (initialSession?.user) {
          // Build profile instantly from session metadata — zero network calls
          setProfile(buildProfileFromUser(initialSession.user));
          syncedUserIdRef.current = initialSession.user.id;
        }
      } catch (err) {
        console.warn("Auth initialization notice:", err.message);
      } finally {
        setLoading(false);
      }
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession || null);
      setUser(newSession?.user || null);
      setLoading(false);

      if (newSession?.user) {
        // Only update profile if it's a different user or profile not yet set
        if (syncedUserIdRef.current !== newSession.user.id) {
          syncedUserIdRef.current = newSession.user.id;
          setProfile(buildProfileFromUser(newSession.user));
        }
      } else {
        syncedUserIdRef.current = null;
        setProfile(null);
      }
    });

    return () => {
      listener?.subscription?.unsubscribe();
    };
  }, []);

  async function updateProfileData(newUsername, newAvatarUrl) {
    if (!user) return;
    const res = await saveUserProfile(user, newUsername, newAvatarUrl);
    // Refresh profile from updated auth metadata
    const { data: { user: updatedUser } } = await supabase.auth.getUser();
    if (updatedUser) setProfile(buildProfileFromUser(updatedUser));
    return res;
  }

  async function signOut() {
    await supabase.auth.signOut();
    syncedUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        setProfile,
        updateProfileData,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
