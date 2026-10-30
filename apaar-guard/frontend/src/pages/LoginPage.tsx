import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Shield, Eye, EyeOff, Lock, Mail, AlertCircle, ArrowRight, Globe } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../i18n/LanguageContext';
import { api } from '../services/api';
import { requiredEmailSchema } from '../utils/validation';

const loginSchema = z.object({
  email: requiredEmailSchema,
  password: z.string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, { message: 'Password is required.' }),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface DemoAccount {
  id: number;
  email: string;
  name: string;
  role: string;
  role_label: string;
  institution_name: string;
  institution_code: string;
  preset_password?: string;
}

export const LoginPage: React.FC = () => {
  const { login, user, loading } = useAuth();
  const { t, language, setLanguage } = useTranslation();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched',
    shouldFocusError: true,
  });

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    api.get<{ disclaimer: string; accounts: DemoAccount[] }>('/auth/demo-accounts')
      .then(res => setDemoAccounts(res.accounts))
      .catch(() => {});
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8FC] text-slate-500 font-sans text-sm">
        Checking active session...
      </div>
    );
  }

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || t('login_error_generic', 'Unable to sign in with those credentials.'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectDemoAccount = (acc: DemoAccount) => {
    setValue('email', acc.email, { shouldValidate: true });
    setValue('password', acc.preset_password || 'password123', { shouldValidate: true });
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-[#F6F8FC] relative">
      {/* Language Switcher in Top Right */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-xs">
        <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
            language === 'en' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLanguage('ta')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
            language === 'ta' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          தமிழ்
        </button>
        <button
          type="button"
          onClick={() => setLanguage('hi')}
          className={`px-2.5 py-1 text-xs rounded-lg font-medium transition cursor-pointer ${
            language === 'hi' ? 'bg-blue-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          हिन्दी
        </button>
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#142B4A] text-white shadow-lg mb-4">
          <Shield className="w-9 h-9 text-blue-400" />
        </div>
        <h2 className="text-3xl font-extrabold text-[#172033] tracking-tight">{t('brand_name', 'APAAR GUARD')}</h2>
        <p className="mt-2 text-sm text-slate-600 font-medium">
          {t('brand_tagline', 'Accurate Student Records. Transparent Verification. Trusted Data.')}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {errorMessage && (
            <div role="alert" className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('login_email_label', 'Institutional Email Address')}
                <span className="text-rose-500 ml-0.5 font-bold" aria-hidden="true">*</span>
                <span className="sr-only"> ({t('required', 'required')})</span>
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="login-email"
                  type="email"
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'login-email-error' : undefined}
                  {...register('email')}
                  placeholder={t('login_email_placeholder', 'asha.admin@apex.edu')}
                  className={`block w-full pl-10 pr-3 py-2.5 text-sm border rounded-lg focus:ring-2 outline-none transition ${
                    errors.email 
                      ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-200' 
                      : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600'
                  }`}
                />
              </div>
              {errors.email && (
                <p id="login-email-error" role="alert" className="mt-1 text-xs text-rose-600 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                {t('login_password_label', 'Password')}
                <span className="text-rose-500 ml-0.5 font-bold" aria-hidden="true">*</span>
                <span className="sr-only"> ({t('required', 'required')})</span>
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'login-password-error' : undefined}
                  {...register('password')}
                  placeholder="••••••••••••"
                  className={`block w-full pl-10 pr-10 py-2.5 text-sm border rounded-lg focus:ring-2 outline-none transition ${
                    errors.password 
                      ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-200' 
                      : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600'
                  }`}
                />
                <button
                  type="button"
                  aria-label={showPassword ? t('login_hide_pw', 'Hide password') : t('login_show_pw', 'Show password')}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="login-password-error" role="alert" className="mt-1 text-xs text-rose-600 font-medium">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <span>{t('login_btn_submitting', 'Signing in...')}</span>
              ) : (
                <>
                  <span>{t('login_btn_submit', 'Sign In to Institutional Portal')}</span>
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo Quick-Select Section */}
          <div className="mt-8 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('login_demo_heading', 'Demo Accounts Quick-Select')}
              </span>
              <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-medium">
                Demo
              </span>
            </div>
            
            <p className="text-xs text-slate-500 mb-3">
              {t('login_demo_sub', 'Click any role to auto-fill credentials and test institution isolation:')}
            </p>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => selectDemoAccount(acc)}
                  className="w-full text-left p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition-all text-xs flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="font-semibold text-slate-800 group-hover:text-blue-700">
                      {acc.name}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {acc.institution_name} ({acc.institution_code})
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded font-medium text-[10px] ${
                    acc.role === 'institution_admin' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {acc.role === 'institution_admin' ? t('role_admin', acc.role_label) : t('role_officer', acc.role_label)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
