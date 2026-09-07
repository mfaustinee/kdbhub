import React, { useState } from 'react';
import { useAuth } from '../src/contexts/AuthContext';
import { ShieldCheck, Lock, Mail, Eye, EyeOff, User, ArrowLeft, CheckCircle2, AlertCircle, Loader2, KeyRound, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AdminLoginProps {
  returnTo?: string;
  onSuccess?: () => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AdminLogin: React.FC<AdminLoginProps> = ({ returnTo = '/admin', onSuccess }) => {
  const { signIn, signUp, resetPassword, isConfigured } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode);
    clearMessages();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    if (mode === 'forgot_password') {
      setIsSubmitting(true);
      const res = await resetPassword(email);
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMessage('A password reset link has been dispatched to your email address.');
      } else {
        setErrorMessage(res.error || 'Failed to send password reset email.');
      }
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    if (mode === 'register') {
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter.');
        return;
      }

      setIsSubmitting(true);
      const res = await signUp(email, password, fullName);
      setIsSubmitting(false);

      if (res.success) {
        setSuccessMessage(res.message || 'Account created successfully!');
        if (!res.message?.includes('check your email')) {
          if (onSuccess) onSuccess();
          else navigate(returnTo);
        }
      } else {
        setErrorMessage(res.error || 'Failed to register account.');
      }
      return;
    }

    // Default: 'login'
    setIsSubmitting(true);
    const res = await signIn(email, password);
    setIsSubmitting(false);

    if (res.success) {
      if (onSuccess) onSuccess();
      else navigate(returnTo);
    } else {
      setErrorMessage(res.error || 'Invalid credentials or login failed.');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 py-8 sm:py-12 animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-28 h-28 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="w-14 h-14 bg-white/10 rounded-2xl border border-white/20 flex items-center justify-center mx-auto mb-3.5 backdrop-blur-xs shadow-inner">
            <ShieldCheck className="w-7 h-7 text-emerald-400" />
          </div>

          <h2 className="text-xl font-black tracking-tight text-white">
            Administrative Access
          </h2>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/70 p-1.5 gap-1 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleModeSwitch('login')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => handleModeSwitch('register')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Admin
          </button>
        </div>

        {/* Card Content */}
        <div className="p-6 sm:p-8 space-y-5">
          {/* Status / Notice if Supabase not configured */}
          {!isConfigured && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Supabase Credentials Notice</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Configure <code className="font-mono bg-amber-100/70 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{' '}
                  <code className="font-mono bg-amber-100/70 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code> in environment settings to enable cloud authentication.
                </p>
              </div>
            </div>
          )}

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-xs text-emerald-800 animate-in fade-in duration-150">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Full Name / Officer Designation</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g.John Doe (Compliance)"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>Admin Email Address</span>
              </label>
              <input
                type="email"
                required
                autoFocus
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all"
              />
            </div>

            {mode !== 'forgot_password' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Password</span>
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeSwitch('forgot_password')}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-1"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'register' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span>Confirm Password</span>
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-all font-mono"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : mode === 'login' ? (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Sign In </span>
                </>
              ) : mode === 'register' ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Register Admin Account</span>
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  <span>Send Password Reset Link</span>
                </>
              )}
            </button>

            {mode === 'forgot_password' && (
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className="w-full text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors pt-2 block cursor-pointer"
              >
                Back to Sign In
              </button>
            )}
          </form>


          <div className="pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Public Portal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
