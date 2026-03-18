
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { UserProfile, AppRole } from '@/types';

interface AuthContextType {
    user: UserProfile | null;
    session: any | null;
    isLoading: boolean;
    isFirstLoad: boolean;
    initError: string | null;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    retryInit: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'erp_user_profile_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<any | null>(null);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFirstLoad, setIsFirstLoad] = useState(true);
    const [initError, setInitError] = useState<string | null>(null);
    const [retryTrigger, setRetryTrigger] = useState(0);

    const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
        try {
            const { data: profile, error: pError } = await supabase
                .from('profiles')
                .select('id, email, full_name, role')
                .eq('id', userId)
                .maybeSingle();

            if (pError) throw pError;
            if (!profile) return null;

            const { data: perms, error: permsError } = await supabase
                .from('role_permissions')
                .select('matrix')
                .eq('role', profile.role)
                .maybeSingle();

            if (permsError) console.warn("Permissions fetch warning:", permsError);

            const fullProfile: UserProfile = {
                id: profile.id,
                email: profile.email,
                fullName: profile.full_name,
                role: profile.role as AppRole,
                permissions: perms?.matrix || {}
            };

            try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fullProfile));
            } catch (e) {}
            
            return fullProfile;
        } catch (e: any) {
            console.error('fetchProfile error:', e);
            throw e;
        }
    };

    const retryInit = () => {
        setInitError(null);
        setIsLoading(true);
        setIsFirstLoad(true);
        setRetryTrigger(prev => prev + 1);
    };

    const refreshProfile = async () => {
        if (session?.user?.id) {
            try {
                const profile = await fetchProfile(session.user.id);
                setUser(profile);
            } catch (e) {
                console.error("Refresh profile failed", e);
            }
        }
    };

    const signOut = async () => {
        try {
            setIsLoading(true);
            sessionStorage.removeItem(STORAGE_KEY);
            setUser(null);
            setSession(null);
            await supabase.auth.signOut();
        } catch (e) {
            console.error("Sign out error", e);
        } finally {
            setIsLoading(false);
            setIsFirstLoad(false);
        }
    };

    useEffect(() => {
        let isMounted = true;
        
        const watchdog = setTimeout(() => {
            if (isMounted && isLoading && isFirstLoad) {
                setInitError("Сервер не отвечает. Проверьте соединение или обновите страницу.");
                setIsLoading(false);
                setIsFirstLoad(false);
            }
        }, 15000);

        const handleAuthStatus = async (currentSession: any) => {
            if (!isMounted) return;
            
            try {
                setSession(currentSession);
                
                if (currentSession?.user) {
                    const cached = sessionStorage.getItem(STORAGE_KEY);
                    if (cached && isFirstLoad) {
                        try {
                            setUser(JSON.parse(cached));
                        } catch (e) {
                            sessionStorage.removeItem(STORAGE_KEY);
                        }
                    }
                    
                    const profile = await fetchProfile(currentSession.user.id);
                    if (isMounted) setUser(profile);
                } else {
                    setUser(null);
                }
                
                if (isMounted) setInitError(null);
            } catch (e: any) {
                console.error("Auth status handle failed:", e);
                if (isMounted && isFirstLoad) setInitError("Не удалось загрузить данные профиля. Попробуйте войти снова.");
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                    setIsFirstLoad(false);
                    clearTimeout(watchdog);
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
            handleAuthStatus(initialSession);
        }).catch(err => {
            console.error("Session fetch failed:", err);
            if (isMounted) {
                setInitError("Ошибка подключения к серверу авторизации.");
                setIsLoading(false);
                setIsFirstLoad(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (!isMounted) return;

            if (event === 'SIGNED_IN') {
                setIsLoading(true);
                handleAuthStatus(currentSession);
            } else if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
                sessionStorage.removeItem(STORAGE_KEY);
                setIsLoading(false);
                setIsFirstLoad(false);
            } else if (event === 'TOKEN_REFRESHED') {
                setSession(currentSession);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            clearTimeout(watchdog);
        };
    }, [retryTrigger]);

    return (
        <AuthContext.Provider value={{ 
            user, 
            session, 
            isLoading, 
            isFirstLoad,
            initError, 
            signOut, 
            refreshProfile, 
            retryInit 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
