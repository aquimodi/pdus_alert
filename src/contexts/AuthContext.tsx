import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

export interface User {
  id: string;
  usuario: string;
  rol: 'Administrador' | 'Operador' | 'Tecnico' | 'Observador';
  sitios_asignados: string[] | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (usuario: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toEmail(usuario: string): string {
  return `${usuario.toLowerCase().replace(/\s+/g, '_')}@energy.local`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
      }
      if (event === 'SIGNED_IN') {
        (async () => { await loadProfile(); })();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setUser(null);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (profile) {
      setUser({
        id: profile.id,
        usuario: profile.usuario,
        rol: profile.rol,
        sitios_asignados: profile.sitios_asignados && profile.sitios_asignados.length > 0
          ? profile.sitios_asignados
          : null,
      });
    } else {
      setUser(null);
    }
  };

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await loadProfile();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (usuario: string, password: string) => {
    const email = toEmail(usuario);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Usuario o contrasena incorrectos');
      }
      throw new Error(error.message);
    }

    await loadProfile();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
