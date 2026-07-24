import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { voteApi, ApiError, type Vote } from '../../api';

export default function AdminVotes() {
  const { t } = useTranslation();
  const [votes, setVotes] = useState<Vote[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [question, setQuestion] = useState('');
  const [type, setType] = useState<'single' | 'multiple' | 'yesno'>('single');
  const [options, setOptions] = useState('Oui, Non');

  const load = async () => {
    try {
      setVotes(await voteApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.loadError'));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const opts =
        type === 'yesno'
          ? [t('vote.typeYes'), t('vote.typeNo')]
          : options.split(',').map((o) => o.trim()).filter(Boolean);
      await voteApi.create({ question, type, options: opts });
      setQuestion('');
      setOptions('Oui, Non');
      flash(t('admin.voteCreated'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.createError'));
    }
  };

  const close = async (id: string) => {
    setError(null);
    try {
      await voteApi.close(id);
      flash(t('admin.voteClosed'));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Création */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">{t('admin.createOfficialVoteTitle')}</h2>
        {notice && <p className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-xl mb-3">{notice}</p>}
        {error && <p className="bg-orange-100 text-orange-1 font-semibold px-4 py-2 rounded-xl mb-3">{error}</p>}
        <form onSubmit={create} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="block font-bold mb-1">{t('admin.questionLabel')}</label>
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              required
              className="w-full border rounded-xl p-3"
              placeholder={t('admin.questionPlaceholder')}
            />
          </div>
          <div>
            <label className="block font-bold mb-1">{t('admin.typeLabel')}</label>
            <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="border rounded-xl p-3">
              <option value="single">{t('admin.typeSingle')}</option>
              <option value="multiple">{t('admin.typeMultiple')}</option>
              <option value="yesno">{t('admin.typeYesno')}</option>
            </select>
          </div>
          {type !== 'yesno' && (
            <div className="flex-1 min-w-[240px]">
              <label className="block font-bold mb-1">{t('admin.optionsLabel')}</label>
              <input value={options} onChange={(e) => setOptions(e.target.value)} className="w-full border rounded-xl p-3" />
            </div>
          )}
          <button type="submit" className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90">
            {t('admin.createButton')}
          </button>
        </form>
      </div>

      {/* Liste */}
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">{t('admin.existingVotesTitle', { count: votes.length })}</h2>
        <div className="space-y-3">
          {votes.map((v) => {
            const total = (v.options ?? []).reduce((s, o) => s + o.votesCount, 0);
            const closed = v.status === 'closed';
            return (
              <div key={v.postgres_id} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold truncate">{v.question}</p>
                  <p className="text-sm text-gray-500">
                    {v.type} · {t('admin.votesCount', { count: total })} ·{' '}
                    <span className={closed ? 'text-orange-1' : 'text-green-600'}>
                      {closed ? t('admin.statusClosed') : t('admin.statusActive')}
                    </span>
                  </p>
                </div>
                {!closed && (
                  <button
                    onClick={() => close(v.postgres_id)}
                    className="bg-orange-1 text-white px-4 py-2 rounded-full font-bold text-sm hover:opacity-90 shrink-0"
                  >
                    {t('admin.closeButton')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
