
import React, { useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { Lock, Mail, User, Loader2, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Try to sign in with email first
            let { error: signInError } = await supabase.auth.signInWithPassword({
                email: login,
                password,
            });

            if (signInError) {
                // If email login fails, try to find user by nickname
                const { data: user, error: userError } = await supabase
                    .from('profiles')
                    .select('email')
                    .eq('nickname', login)
                    .single();

                if (userError || !user) {
                    throw new Error('Неверный email, никнейм или пароль');
                }

                // Try to sign in with the found email
                const { error: secondSignInError } = await supabase.auth.signInWithPassword({
                    email: user.email,
                    password,
                });

                if (secondSignInError) {
                    throw new Error('Неверный email, никнейм или пароль');
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('Произошла неизвестная ошибка');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decorations */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[120px]" />

            <div className="w-full max-w-md relative animate-in fade-in zoom-in-95 duration-500">
                <div className="bg-slate-900/50 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-10 shadow-2xl">
                    <div className="text-center mb-10">
                        <div className="inline-flex p-4 bg-blue-600 rounded-3xl shadow-lg shadow-blue-600/20 mb-6">
                            <Lock className="text-white" size={32} />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic">CALIDAD ERP</h1>
                        <p className="text-slate-400 text-sm font-medium mt-2">Система управления цепочками поставок</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl flex items-start gap-3 animate-in slide-in-from-top-2">
                                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                                <span className="text-sm font-bold tracking-tight leading-tight">{error}</span>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email или никнейм</label>
                            <div className="relative">
                                <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600/50 transition-all"
                                    placeholder="admin@company.com или admin"
                                    value={login}
                                    onChange={e => setLogin(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Пароль</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-800/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white font-bold outline-none focus:ring-4 focus:ring-blue-600/20 focus:border-blue-600/50 transition-all"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 mt-4"
                        >
                            {isLoading ? <Loader2 size={24} className="animate-spin" /> : 'Войти в систему'}
                        </button>
                    </form>

                    <div className="mt-8 text-center">
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.2em]">Authorized Access Only</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
