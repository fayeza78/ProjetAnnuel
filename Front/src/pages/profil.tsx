import { useEffect, useState, type FormEvent } from 'react';
import { PersonCircle, ShieldLock, ShieldCheck, Laptop, Translate, TagsFill, X } from 'react-bootstrap-icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import QRCode from 'qrcode';
import { useAuth } from '../context/AuthContext';
import { userApi, gdprApi, authApi, interestsApi, ApiError } from '../api';
import { CATALOGUE_INTERETS } from '../interest';

function Profil() {
  const navigate = useNavigate();
  const { user, logout, refreshMe } = useAuth();
  const { t, i18n } = useTranslation();

  const [points, setPoints] = useState<number | null>(null);
  const [consent, setConsent] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── État MFA (2FA) ──────────────────────────────────────────────────────────
  const mfaEnabled = !!user?.mfa_enabled;
  const [setupMode, setSetupMode] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState<string | null>(null);
  const [mfaMsg, setMfaMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // ── État changement mot de passe / e-mail / téléphone ───────────────────────
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '', code: '' });
  const [pwdNeedsMfa, setPwdNeedsMfa] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdMsg, setPwdMsg] = useState<string | null>(null);

  const [emailForm, setEmailForm] = useState({ password: '', next: '', code: '' });
  const [emailNeedsMfa, setEmailNeedsMfa] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  const [phoneForm, setPhoneForm] = useState({ password: '', next: '', code: '' });
  const [phoneNeedsMfa, setPhoneNeedsMfa] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneMsg, setPhoneMsg] = useState<string | null>(null);

  // ── État centres d'intérêt (recommandations Neo4j) ──────────────────────────
  const [interests, setInterests] = useState<string[]>([]);
  const [interestsBusy, setInterestsBusy] = useState(false);
  const [interestsError, setInterestsError] = useState<string | null>(null);
  const [interestsMsg, setInterestsMsg] = useState<string | null>(null);

  // ── État SSO (connexion du client Java) ─────────────────────────────────────
  const isPrivilegie = user?.role === 'admin' || user?.role === 'moderateur';
  const [ssoTicket, setSsoTicket] = useState<string | null>(null);
  const [ssoQr, setSsoQr] = useState<string | null>(null);
  const [ssoSeconds, setSsoSeconds] = useState(0);
  const [ssoBusy, setSsoBusy] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [ssoCopied, setSsoCopied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, c, i] = await Promise.all([
          userApi.points().catch(() => ({ points: 0 })),
          gdprApi.getConsent().catch(() => ({ consentDonne: false, date: null })),
          interestsApi.get().catch(() => ({ interests: [] as string[] })),
        ]);
        setPoints(p.points);
        setConsent(c.consentDonne);
        setInterests(i.interests);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('profil.loadError'));
      }
    })();
  }, [t]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleConsent = async () => {
    const next = !consent;
    try {
      await gdprApi.setConsent(next);
      setConsent(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profil.genericError'));
    }
  };

  const handleExport = async () => {
    const data = await gdprApi.export();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mes-donnees-rgpd.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Actions MFA ─────────────────────────────────────────────────────────────
  const startMfaSetup = async () => {
    setMfaError(null);
    setMfaMsg(null);
    setBusy(true);
    try {
      const { secret, otpauthUrl } = await authApi.mfaSetup();
      const dataUrl = await QRCode.toDataURL(otpauthUrl, { width: 220, margin: 1 });
      setSecret(secret);
      setQrDataUrl(dataUrl);
      setSetupMode(true);
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t('profil.mfaStartError'));
    } finally {
      setBusy(false);
    }
  };

  const confirmMfa = async () => {
    setMfaError(null);
    setBusy(true);
    try {
      await authApi.mfaVerify(mfaCode.trim());
      setSetupMode(false);
      setQrDataUrl(null);
      setSecret(null);
      setMfaCode('');
      setMfaMsg(t('profil.mfaActivatedMsg'));
      await refreshMe();
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t('profil.mfaInvalidCode'));
    } finally {
      setBusy(false);
    }
  };

  const disableMfa = async () => {
    setMfaError(null);
    setMfaMsg(null);
    setBusy(true);
    try {
      await authApi.mfaDisable();
      setMfaMsg(t('profil.mfaDeactivatedMsg'));
      await refreshMe();
    } catch (err) {
      setMfaError(err instanceof ApiError ? err.message : t('profil.mfaDisableError'));
    } finally {
      setBusy(false);
    }
  };

  const cancelSetup = () => {
    setSetupMode(false);
    setQrDataUrl(null);
    setSecret(null);
    setMfaCode('');
    setMfaError(null);
  };

  // Détecte le cas "code MFA requis" renvoyé par l'API (401 + { mfa_required: true })
  // pour tous les changements sensibles (mot de passe / e-mail / téléphone).
  const mfaRequiredFrom = (err: unknown) =>
    err instanceof ApiError &&
    err.status === 401 &&
    !!(err.body as { mfa_required?: boolean } | undefined)?.mfa_required;

  // ── Actions changement mot de passe / e-mail / téléphone ────────────────────
  const submitPasswordChange = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError(null);
    setPwdMsg(null);

    if (pwdForm.next !== pwdForm.confirm) {
      setPwdError(t('profil.passwordMismatch'));
      return;
    }

    setPwdBusy(true);
    try {
      await authApi.changePassword(
        pwdForm.current,
        pwdForm.next,
        pwdNeedsMfa ? pwdForm.code : undefined,
      );
      setPwdMsg(t('profil.passwordChanged'));
      setPwdForm({ current: '', next: '', confirm: '', code: '' });
      setPwdNeedsMfa(false);
    } catch (err) {
      if (mfaRequiredFrom(err)) {
        setPwdNeedsMfa(true);
        setPwdError(t('profil.mfaCodeHint'));
      } else {
        setPwdError(err instanceof ApiError ? err.message : t('profil.changeError'));
      }
    } finally {
      setPwdBusy(false);
    }
  };

  const submitEmailChange = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailMsg(null);
    setEmailBusy(true);
    try {
      await authApi.changeEmail(
        emailForm.password,
        emailForm.next,
        emailNeedsMfa ? emailForm.code : undefined,
      );
      setEmailMsg(t('profil.emailChanged'));
      setEmailForm({ password: '', next: '', code: '' });
      setEmailNeedsMfa(false);
      await refreshMe();
    } catch (err) {
      if (mfaRequiredFrom(err)) {
        setEmailNeedsMfa(true);
        setEmailError(t('profil.mfaCodeHint'));
      } else {
        setEmailError(err instanceof ApiError ? err.message : t('profil.changeError'));
      }
    } finally {
      setEmailBusy(false);
    }
  };

  const submitPhoneChange = async (e: FormEvent) => {
    e.preventDefault();
    setPhoneError(null);
    setPhoneMsg(null);
    setPhoneBusy(true);
    try {
      await authApi.changePhone(
        phoneForm.password,
        phoneForm.next,
        phoneNeedsMfa ? phoneForm.code : undefined,
      );
      setPhoneMsg(t('profil.phoneChanged'));
      setPhoneForm({ password: '', next: '', code: '' });
      setPhoneNeedsMfa(false);
      await refreshMe();
    } catch (err) {
      if (mfaRequiredFrom(err)) {
        setPhoneNeedsMfa(true);
        setPhoneError(t('profil.mfaCodeHint'));
      } else {
        setPhoneError(err instanceof ApiError ? err.message : t('profil.changeError'));
      }
    } finally {
      setPhoneBusy(false);
    }
  };

  // ── Actions centres d'intérêt (sélection depuis le catalogue prédéfini) ──────
  const toggleInterest = (value: string) => {
    setInterestsError(null);
    setInterestsMsg(null);
    if (interests.includes(value)) {
      setInterests((prev) => prev.filter((i) => i !== value));
      return;
    }
    if (interests.length >= 10) {
      setInterestsError(t('profil.interestsMax'));
      return;
    }
    setInterests((prev) => [...prev, value]);
  };

  const removeInterest = (value: string) => {
    setInterests((prev) => prev.filter((i) => i !== value));
  };

  const saveInterests = async () => {
    setInterestsError(null);
    setInterestsMsg(null);
    setInterestsBusy(true);
    try {
      const res = await interestsApi.set(interests);
      setInterests(res.interests);
      setInterestsMsg(t('profil.interestsSaved'));
    } catch (err) {
      setInterestsError(
        err instanceof ApiError ? err.message : t('profil.interestsSaveError'),
      );
    } finally {
      setInterestsBusy(false);
    }
  };

  // ── Actions SSO (client Java) ───────────────────────────────────────────────
  const generateSsoTicket = async () => {
    setSsoError(null);
    setSsoCopied(false);
    setSsoBusy(true);
    try {
      const { sso_ticket, expires_in } = await authApi.ssoTicket();
      const qr = await QRCode.toDataURL(sso_ticket, { width: 200, margin: 1 });
      setSsoTicket(sso_ticket);
      setSsoQr(qr);
      setSsoSeconds(expires_in);
    } catch (err) {
      setSsoError(err instanceof ApiError ? err.message : t('profil.ssoGenerateError'));
    } finally {
      setSsoBusy(false);
    }
  };

  const copySsoTicket = async () => {
    if (!ssoTicket) return;
    try {
      await navigator.clipboard.writeText(ssoTicket);
      setSsoCopied(true);
    } catch {
      setSsoError(t('profil.ssoCopyError'));
    }
  };

  // Compte à rebours : le ticket n'est valable que 120 s. À 0, on l'efface.
  useEffect(() => {
    if (!ssoTicket) return;
    if (ssoSeconds <= 0) {
      setSsoTicket(null);
      setSsoQr(null);
      return;
    }
    const t = setTimeout(() => setSsoSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [ssoTicket, ssoSeconds]);

  const displayName = user?.email ? user.email.split('@')[0] : t('common.user');

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">
            {t('profil.title')}
          </h1>

          <div className="flex items-center gap-4">
            <PersonCircle size={54} className="text-orange-1" />
            <div>
              <p className="text-2xl font-bold text-blue-1">{displayName}</p>
              <p className="font-medium text-blue-2">{user?.email}</p>
            </div>
          </div>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-3xl font-bold mb-6">{t('profil.myPoints')}</h2>
            <p className="text-5xl font-bold text-blue-1">
              {points === null ? '…' : points}
            </p>
            <p className="text-gray-500 mt-2">{t('profil.pointsHint')}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-2">
            <h2 className="text-3xl font-bold mb-6">{t('profil.information')}</h2>
            <div className="space-y-3">
              <p><strong>{t('profil.email')} :</strong> {user?.email}</p>
              <p><strong>{t('profil.role')} :</strong> {user?.role}</p>
              <p><strong>{t('profil.city')} :</strong> {user?.ville ?? '—'}</p>
              <p>
                <strong>{t('profil.neighbourhood')} :</strong>{' '}
                {typeof user?.quartier === 'string'
                  ? user.quartier
                  : user?.quartier?.nom_quartier ?? '—'}
              </p>
              {user?.vote_blocked && (
                <p className="text-orange-1 font-semibold">
                  {t('profil.voteBlocked')}
                </p>
              )}
            </div>
          </div>

          {/* ── Modifier mes informations sensibles ── */}
          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
            <h2 className="text-3xl font-bold mb-6">{t('profil.editInfoTitle')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Mot de passe */}
              <form onSubmit={submitPasswordChange} className="flex flex-col gap-3">
                <h3 className="text-xl font-bold mb-1">{t('profil.passwordSectionTitle')}</h3>
                {pwdError && <p className="text-orange-1 text-sm font-medium">{pwdError}</p>}
                {pwdMsg && <p className="text-green-700 text-sm font-medium">{pwdMsg}</p>}
                <input
                  type="password"
                  placeholder={t('profil.currentPasswordPlaceholder')}
                  value={pwdForm.current}
                  onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))}
                  required
                  className="w-full border rounded-xl p-3"
                />
                <input
                  type="password"
                  placeholder={t('profil.newPasswordPlaceholder')}
                  value={pwdForm.next}
                  onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))}
                  required
                  minLength={8}
                  className="w-full border rounded-xl p-3"
                />
                <input
                  type="password"
                  placeholder={t('profil.confirmNewPasswordPlaceholder')}
                  value={pwdForm.confirm}
                  onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))}
                  required
                  minLength={8}
                  className="w-full border rounded-xl p-3"
                />
                {pwdNeedsMfa && (
                  <input
                    placeholder={t('profil.mfaCodePlaceholder')}
                    value={pwdForm.code}
                    onChange={(e) =>
                      setPwdForm((f) => ({
                        ...f,
                        code: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    inputMode="numeric"
                    className="w-full border rounded-xl p-3 tracking-[0.3em] text-center font-bold"
                  />
                )}
                <button
                  type="submit"
                  disabled={pwdBusy}
                  className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {pwdBusy ? t('common.pleaseWait') : t('profil.changePasswordButton')}
                </button>
              </form>

              {/* E-mail */}
              <form onSubmit={submitEmailChange} className="flex flex-col gap-3">
                <h3 className="text-xl font-bold mb-1">{t('profil.emailSectionTitle')}</h3>
                {emailError && <p className="text-orange-1 text-sm font-medium">{emailError}</p>}
                {emailMsg && <p className="text-green-700 text-sm font-medium">{emailMsg}</p>}
                <input
                  type="password"
                  placeholder={t('profil.passwordPlaceholder')}
                  value={emailForm.password}
                  onChange={(e) => setEmailForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full border rounded-xl p-3"
                />
                <input
                  type="email"
                  placeholder={t('profil.newEmailPlaceholder')}
                  value={emailForm.next}
                  onChange={(e) => setEmailForm((f) => ({ ...f, next: e.target.value }))}
                  required
                  className="w-full border rounded-xl p-3"
                />
                {emailNeedsMfa && (
                  <input
                    placeholder={t('profil.mfaCodePlaceholder')}
                    value={emailForm.code}
                    onChange={(e) =>
                      setEmailForm((f) => ({
                        ...f,
                        code: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    inputMode="numeric"
                    className="w-full border rounded-xl p-3 tracking-[0.3em] text-center font-bold"
                  />
                )}
                <button
                  type="submit"
                  disabled={emailBusy}
                  className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {emailBusy ? t('common.pleaseWait') : t('profil.changeEmailButton')}
                </button>
              </form>

              {/* Téléphone */}
              <form onSubmit={submitPhoneChange} className="flex flex-col gap-3">
                <h3 className="text-xl font-bold mb-1">{t('profil.phoneSectionTitle')}</h3>
                {phoneError && <p className="text-orange-1 text-sm font-medium">{phoneError}</p>}
                {phoneMsg && <p className="text-green-700 text-sm font-medium">{phoneMsg}</p>}
                <input
                  type="password"
                  placeholder={t('profil.passwordPlaceholder')}
                  value={phoneForm.password}
                  onChange={(e) => setPhoneForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full border rounded-xl p-3"
                />
                <input
                  type="tel"
                  placeholder={t('profil.newPhonePlaceholder')}
                  value={phoneForm.next}
                  onChange={(e) => setPhoneForm((f) => ({ ...f, next: e.target.value }))}
                  required
                  className="w-full border rounded-xl p-3"
                />
                {phoneNeedsMfa && (
                  <input
                    placeholder={t('profil.mfaCodePlaceholder')}
                    value={phoneForm.code}
                    onChange={(e) =>
                      setPhoneForm((f) => ({
                        ...f,
                        code: e.target.value.replace(/\D/g, '').slice(0, 6),
                      }))
                    }
                    inputMode="numeric"
                    className="w-full border rounded-xl p-3 tracking-[0.3em] text-center font-bold"
                  />
                )}
                <button
                  type="submit"
                  disabled={phoneBusy}
                  className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {phoneBusy ? t('common.pleaseWait') : t('profil.changePhoneButton')}
                </button>
              </form>
            </div>
          </div>

          {/* ── Sécurité : double authentification (2FA) ── */}
          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              {mfaEnabled ? (
                <ShieldCheck size={32} className="text-green-600" />
              ) : (
                <ShieldLock size={32} className="text-orange-1" />
              )}
              <h2 className="text-3xl font-bold">{t('profil.mfaTitle')}</h2>
              <span
                className={`ml-auto px-4 py-1.5 rounded-full font-bold text-sm ${
                  mfaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {mfaEnabled ? t('profil.mfaEnabled') : t('profil.mfaDisabled')}
              </span>
            </div>

            <p className="text-gray-500 mb-6">
              {t('profil.mfaDescription')}
            </p>

            {mfaMsg && <p className="text-green-700 font-medium mb-4">{mfaMsg}</p>}
            {mfaError && <p className="text-orange-1 font-medium mb-4">{mfaError}</p>}

            {/* Cas 1 : MFA déjà active */}
            {mfaEnabled && !setupMode && (
              <button
                onClick={disableMfa}
                disabled={busy}
                className="bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {t('profil.disableMfaButton')}
              </button>
            )}

            {/* Cas 2 : MFA inactive, pas encore en configuration */}
            {!mfaEnabled && !setupMode && (
              <button
                onClick={startMfaSetup}
                disabled={busy}
                className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {busy ? t('common.pleaseWait') : t('profil.enableMfaButton')}
              </button>
            )}

            {/* Cas 3 : configuration en cours (QR + code) */}
            {setupMode && (
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="text-center">
                  {qrDataUrl && (
                    <img
                      src={qrDataUrl}
                      alt="QR code 2FA"
                      className="rounded-xl border-2 border-gray-100"
                    />
                  )}
                  {secret && (
                    <p className="mt-3 text-sm text-gray-500">
                      {t('profil.manualKey')}<br />
                      <code className="font-mono font-bold text-gray-700 break-all">{secret}</code>
                    </p>
                  )}
                </div>

                <div className="flex-1">
                  <ol className="list-decimal list-inside text-gray-600 space-y-2 mb-4">
                    <li>{t('profil.mfaStep1')}</li>
                    <li>{t('profil.mfaStep2')}</li>
                  </ol>
                  <input
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('profil.sixDigitCodePlaceholder')}
                    inputMode="numeric"
                    className="w-full border rounded-xl px-4 py-3 outline-none tracking-[0.3em] text-center text-xl font-bold mb-4"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={confirmMfa}
                      disabled={busy || mfaCode.length !== 6}
                      className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
                    >
                      {t('profil.confirm')}
                    </button>
                    <button
                      onClick={cancelSetup}
                      disabled={busy}
                      className="bg-gray-100 text-gray-600 px-6 py-3 rounded-full font-bold hover:bg-gray-200"
                    >
                      {t('profil.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Connexion de l'application Java (SSO) — admin/modérateur ── */}
          {isPrivilegie && (
            <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <Laptop size={32} className="text-blue-1" />
                <h2 className="text-3xl font-bold">{t('profil.ssoTitle')}</h2>
              </div>

              <p className="text-gray-500 mb-6">
                {t('profil.ssoDescription')}
              </p>

              {ssoError && <p className="text-orange-1 font-medium mb-4">{ssoError}</p>}

              {!ssoTicket && (
                <button
                  onClick={generateSsoTicket}
                  disabled={ssoBusy}
                  className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
                >
                  {ssoBusy ? t('common.pleaseWait') : t('profil.ssoGenerateButton')}
                </button>
              )}

              {ssoTicket && (
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="text-center">
                    {ssoQr && (
                      <img
                        src={ssoQr}
                        alt="QR code SSO"
                        className="rounded-xl border-2 border-gray-100"
                      />
                    )}
                  </div>

                  <div className="flex-1">
                    <p className="text-gray-600 mb-2">{t('profil.ssoTicketLabel')}</p>
                    <code className="block font-mono font-bold text-gray-700 break-all bg-gray-50 rounded-xl px-4 py-3 mb-4">
                      {ssoTicket}
                    </code>
                    <div className="flex flex-wrap items-center gap-4">
                      <button
                        onClick={copySsoTicket}
                        className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
                      >
                        {ssoCopied ? t('profil.ssoCopied') : t('profil.ssoCopyButton')}
                      </button>
                      <span className="font-bold text-orange-1">
                        {t('profil.ssoExpiresIn', { seconds: ssoSeconds })}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Langue de l'application ── */}
          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <Translate size={32} className="text-blue-1" />
              <h2 className="text-3xl font-bold">{t('profil.languageTitle')}</h2>
            </div>
            <p className="text-gray-500 mb-6">{t('profil.languageHint')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => i18n.changeLanguage('fr')}
                className={`px-6 py-3 rounded-full font-bold border-2 transition-colors ${
                  i18n.language.startsWith('fr')
                    ? 'bg-blue-1 border-blue-1 text-white'
                    : 'border-blue-1 text-blue-1 hover:bg-gray-50'
                }`}
              >
                {t('profil.languageFr')}
              </button>
              <button
                onClick={() => i18n.changeLanguage('en')}
                className={`px-6 py-3 rounded-full font-bold border-2 transition-colors ${
                  i18n.language.startsWith('en')
                    ? 'bg-blue-1 border-blue-1 text-white'
                    : 'border-blue-1 text-blue-1 hover:bg-gray-50'
                }`}
              >
                {t('profil.languageEn')}
              </button>
            </div>
          </div>

          {/* ── Centres d'intérêt (recommandations) ── */}
          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <TagsFill size={32} className="text-blue-1" />
              <h2 className="text-3xl font-bold">{t('profil.interestsTitle')}</h2>
            </div>
            <p className="text-gray-500 mb-6">{t('profil.interestsHint')}</p>

            {interestsError && <p className="text-orange-1 font-medium mb-4">{interestsError}</p>}
            {interestsMsg && <p className="text-green-700 font-medium mb-4">{interestsMsg}</p>}

            <div className="flex flex-wrap gap-2 mb-4">
              {interests.length === 0 && (
                <p className="text-gray-400">{t('profil.noInterests')}</p>
              )}
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="flex items-center gap-2 bg-blue-50 text-blue-1 px-4 py-2 rounded-full font-semibold"
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    className="hover:text-orange-1"
                  >
                    <X size={16} />
                  </button>
                </span>
              ))}
            </div>

            <p className="text-sm text-gray-500 mb-3">
              {t('profil.interestsCatalogHint', { count: interests.length })}
            </p>
            <div className="flex flex-wrap gap-2 mb-6">
              {CATALOGUE_INTERETS.map((interest) => {
                const selected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    disabled={!selected && interests.length >= 10}
                    className={
                      'px-4 py-2 rounded-full font-semibold border transition disabled:opacity-40 ' +
                      (selected
                        ? 'bg-blue-1 text-white border-blue-1'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-blue-1')
                    }
                  >
                    {interest}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveInterests}
                disabled={interestsBusy}
                className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {interestsBusy ? t('common.pleaseWait') : t('profil.saveInterestsButton')}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 xl:col-span-3">
            <h2 className="text-3xl font-bold mb-6">{t('profil.gdprTitle')}</h2>

            <div className="flex justify-between items-center border-b py-4">
              <span className="font-bold">{t('profil.consentLabel')}</span>
              <button
                onClick={toggleConsent}
                className={`px-5 py-2 rounded-full font-bold ${
                  consent ? 'bg-blue-1 text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {consent === null ? '…' : consent ? t('profil.consentGranted') : t('profil.consentDenied')}
              </button>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleExport}
                className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90"
              >
                {t('profil.exportButton')}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mt-8">
          <h2 className="text-3xl font-bold mb-4">{t('profil.logoutTitle')}</h2>
          <p className="text-gray-500 mb-6">
            {t('profil.logoutHint')}
          </p>
          <button
            onClick={handleLogout}
            className="bg-orange-1 text-white px-8 py-4 rounded-full font-bold hover:opacity-90 transition"
          >
            {t('profil.logoutButton')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profil;
