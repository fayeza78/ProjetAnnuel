import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { ApiError, quartierApi, type Quartier } from '../api';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

const Login = () => {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const { t } = useTranslation();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adresse, setAdresse] = useState('');
  const [ville, setVille] = useState('');
  const [cp, setCp] = useState('');
  const [nomQuartier, setNomQuartier] = useState('');
  const [quartiers, setQuartiers] = useState<Quartier[]>([]);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [code, setCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // quartiersCharges reste faux tant que la liste n'est pas revenue de l'API
  const [quartiersCharges, setQuartiersCharges] = useState(false);

  useEffect(() => {
    quartierApi
      .list()
      .then(setQuartiers)
      .catch(() => setQuartiers([]))
      .finally(() => setQuartiersCharges(true));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register({ email, password, adresse, ville, cp, nom_quartier: nomQuartier });
        navigate('/');
      } else {
        const res = await login(email, password, mfaRequired ? code : undefined);
        if ('mfa_required' in res) {
          setMfaRequired(true);
          setError(t('login.mfaRequired'));
        } else {
          navigate('/');
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('common.genericError'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full rounded-xl border px-4 py-3 outline-none';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-[#DEE1E9] via-[#8AC6C7]/60 to-[#D2D4D6] px-6">
      <div className="w-full max-w-md bg-white/80 backdrop-blur rounded-3xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-center text-slate-800">
          {isRegister ? t('login.titleRegister') : t('login.titleLogin')}
        </h1>

        <p className="text-center text-slate-500 mt-2 mb-8">
          {t('common.tagline')}
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={t('login.emailPlaceholder')}
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            type="password"
            placeholder={t('login.passwordPlaceholder')}
            className={inputClass}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {!isRegister && (
            <div className="text-right -mt-2">
              <button
                type="button"
                onClick={() => setShowForgot(true)}
                className="text-sm text-[#2F6F73] font-medium"
              >
                {t('login.forgotLink')}
              </button>
            </div>
          )}

          {isRegister && (
            <>
              <input type="text" placeholder={t('login.addressPlaceholder')} className={inputClass} value={adresse} onChange={(e) => setAdresse(e.target.value)} required />
              <input type="text" placeholder={t('login.cityPlaceholder')} className={inputClass} value={ville} onChange={(e) => setVille(e.target.value)} required />
              <input type="text" placeholder={t('login.postalCodePlaceholder')} className={inputClass} value={cp} onChange={(e) => setCp(e.target.value)} required />
              {/* Liste deroulante des quartiers ; champ libre seulement si l'API n'en renvoie aucun */}
              {quartiers.length > 0 || !quartiersCharges ? (
                <select
                  className={inputClass}
                  value={nomQuartier}
                  onChange={(e) => setNomQuartier(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {quartiersCharges
                      ? t('login.neighbourhoodPlaceholder')
                      : t('login.neighbourhoodLoading')}
                  </option>
                  {quartiers.map((q) => (
                    <option key={q.id_quartier} value={q.nom_quartier}>{q.nom_quartier}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder={t('login.neighbourhoodPlaceholder')}
                    className={inputClass}
                    value={nomQuartier}
                    onChange={(e) => setNomQuartier(e.target.value)}
                    required
                  />
                  <p className="text-sm text-orange-1">{t('login.neighbourhoodEmpty')}</p>
                </>
              )}
            </>
          )}

          {mfaRequired && !isRegister && (
            <input
              type="text"
              placeholder={t('login.mfaPlaceholder')}
              className={inputClass}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-orange-1 font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#2F6F73] text-white py-3 font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {loading ? t('common.pleaseWait') : isRegister ? t('login.submitRegister') : t('login.submitLogin')}
          </button>
        </form>

        <button
          onClick={() => {
            setIsRegister(!isRegister);
            setError(null);
            setMfaRequired(false);
          }}
          className="w-full mt-6 text-sm text-[#2F6F73] font-medium"
        >
          {isRegister
            ? t('login.switchToLogin')
            : t('login.switchToRegister')}
        </button>
      </div>

      {showForgot && (
        <ForgotPasswordModal onClose={() => setShowForgot(false)} />
      )}
    </div>
  );
};

export default Login;
