import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiError, authApi } from '../api';

type Props = {
  onClose: () => void;
};

// Modale mot de passe oublie : etape 1 l'email, etape 2 le code recu + nouveau mot de passe.
function ForgotPasswordModal({ onClose }: Props) {
  const { t } = useTranslation();

  const [step, setStep] = useState<'email' | 'reset' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass = 'w-full rounded-xl border px-4 py-3 outline-none';

  // etape 1 : demander un code de reinitialisation
  const askReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      // en mode demo l'API renvoie le code : on le pre-remplit
      if (res.reset_token) setToken(res.reset_token);
      setInfo(t('login.forgotEmailSent'));
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setLoading(false);
    }
  };

  // etape 2 : envoyer le code + le nouveau mot de passe
  const doReset = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full">
        <h3 className="text-2xl font-bold mb-4 text-slate-800">
          {t('login.forgotTitle')}
        </h3>

        {step === 'email' && (
          <form className="space-y-4" onSubmit={askReset}>
            <p className="text-sm text-slate-500">{t('login.forgotEmailHint')}</p>
            <input
              type="email"
              placeholder={t('login.emailPlaceholder')}
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <p className="text-sm text-orange-1 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2F6F73] text-white py-3 font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('common.pleaseWait') : t('login.forgotSubmitEmail')}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form className="space-y-4" onSubmit={doReset}>
            {info && <p className="text-sm text-green-700">{info}</p>}
            <input
              type="text"
              placeholder={t('login.forgotTokenPlaceholder')}
              className={inputClass}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder={t('login.forgotNewPasswordPlaceholder')}
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-orange-1 font-medium">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#2F6F73] text-white py-3 font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {loading ? t('common.pleaseWait') : t('login.forgotSubmitReset')}
            </button>
          </form>
        )}

        {step === 'done' && (
          <p className="text-sm text-green-700">{t('login.forgotDone')}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-6 text-sm text-[#2F6F73] font-medium"
        >
          {t('login.forgotBackToLogin')}
        </button>
      </div>
    </div>
  );
}

export default ForgotPasswordModal;
