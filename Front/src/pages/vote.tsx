import { useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { voteApi, ApiError, type Vote as VoteModel } from '../api';
import { useAuth } from '../context/AuthContext';

const VOTE_TYPE_KEYS = {
  single: 'vote.typeSingle',
  multiple: 'vote.typeMultiple',
  yesno: 'vote.typeYesno',
} as const;

function Vote() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [votes, setVotes] = useState<VoteModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [type, setType] = useState<'single' | 'multiple' | 'yesno'>('single');
  const [options, setOptions] = useState('Oui, Non');
  const [deadline, setDeadline] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string[]>
  >({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setVotes(await voteApi.list());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('vote.loadError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const myId = user ? String(user.id_user) : '';

  const hasVoted = (vote: VoteModel) =>
    (vote.votes ?? []).some((v) => v.user_postgres_id === myId);

  const createVote = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (!user) {
      setError(t('vote.mustBeLoggedIn'));
      return;
    }

    const parsedOptions =
      type === 'yesno'
        ? [t('vote.typeYes'), t('vote.typeNo')]
        : options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);

    if (!question.trim()) {
      setError(t('vote.questionRequired'));
      return;
    }

    if (parsedOptions.length < 2 && type !== 'yesno') {
      setError(t('vote.atLeastTwoOptions'));
      return;
    }

    try {
      setCreating(true);
      const created = await voteApi.create({
        question: question.trim(),
        type,
        options: parsedOptions,
        description: t('vote.defaultDescription'),
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        isAnonymous,
      });
      setQuestion('');
      setOptions('Oui, Non');
      setDeadline('');
      setIsAnonymous(false);
      setType('single');
      setNotice(t('vote.createSuccess'));
      setVotes((prev) => [created, ...prev]);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t('vote.createError'),
      );
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (voteId: string, optionIds: string[]) => {
    if (optionIds.length === 0) return;
    try {
      const updated = await voteApi.vote(voteId, optionIds);
      setVotes((prev) =>
        prev.map((v) => (v.postgres_id === voteId ? updated : v)),
      );
      setSelectedOptions((prev) => {
        const next = { ...prev };
        delete next[voteId];
        return next;
      });
      setNotice(t('vote.voteRecorded'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('vote.voteError'));
    }
  };

  const toggleOption = (voteId: string, optionId: string) => {
    setSelectedOptions((prev) => {
      const current = prev[voteId] ?? [];
      const next = current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
      return { ...prev, [voteId]: next };
    });
  };

  const votesEnCours = votes.filter((v) => v.status !== 'closed').length;
  const totalParticipations = votes.reduce(
    (t, v) => t + (v.options ?? []).reduce((s, o) => s + o.votesCount, 0),
    0,
  );

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('vote.title')}</h1>
          <div className="flex flex-wrap gap-6 md:gap-8">
            <Stat value={votesEnCours} label={t('vote.statInProgress')} />
            <Stat value={totalParticipations} label={t('vote.statVotes')} />
          </div>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}
        {notice && (
          <p className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-xl mb-4">
            {notice}
          </p>
        )}
        {loading && <p className="font-semibold text-gray-600">{t('common.loading')}</p>}

        <div className="flex justify-end mb-6">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition-opacity"
          >
            {showForm ? t('vote.cancelButton') : t('vote.createButton')}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4">{t('vote.formTitle')}</h2>
            <form onSubmit={createVote} className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block font-bold mb-1">{t('vote.questionLabel')}</label>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    required
                    className="w-full border rounded-xl p-3"
                    placeholder={t('vote.questionPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">{t('vote.typeLabel')}</label>
                  <select
                    value={type}
                    onChange={(e) =>
                      setType(e.target.value as 'single' | 'multiple' | 'yesno')
                    }
                    className="border rounded-xl p-3"
                  >
                    <option value="single">{t('vote.typeSingle')}</option>
                    <option value="multiple">{t('vote.typeMultiple')}</option>
                    <option value="yesno">{t('vote.typeYesno')}</option>
                  </select>
                </div>
              </div>

              {type !== 'yesno' && (
                <div>
                  <label className="block font-bold mb-1">
                    {t('vote.optionsLabel')}
                  </label>
                  <input
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    className="w-full border rounded-xl p-3"
                    placeholder={t('vote.optionsPlaceholder')}
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold mb-1">{t('vote.deadlineLabel')}</label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    className="w-full border rounded-xl p-3"
                  />
                </div>
                <div className="flex items-center gap-2 pt-8">
                  <input
                    id="anonymous-vote"
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <label htmlFor="anonymous-vote" className="font-bold">
                    {t('vote.anonymousLabel')}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={creating || !user}
                className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed self-start"
              >
                {creating ? t('vote.creating') : t('vote.submitCreate')}
              </button>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {!loading && votes.length === 0 && (
            <div className="col-span-full bg-white p-10 rounded-2xl shadow-lg text-center">
              <p className="text-xl font-bold text-gray-700">
                {t('vote.empty')}
              </p>
            </div>
          )}

          {votes.map((vote) => {
            const totalVotes = (vote.options ?? []).reduce(
              (s, o) => s + o.votesCount,
              0,
            );
            const voted = hasVoted(vote);
            const closed = vote.status === 'closed';

            return (
              <div
                key={vote.postgres_id}
                className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col gap-5"
              >
                <span className="w-fit bg-orange-100 text-orange-1 px-4 py-2 rounded-full font-semibold">
                  {t(VOTE_TYPE_KEYS[vote.type])}
                </span>

                <h2 className="text-2xl font-bold leading-tight min-h-[64px]">
                  {vote.question}
                </h2>

                {vote.description && (
                  <p className="text-gray-600 min-h-[48px]">
                    {vote.description}
                  </p>
                )}

                <div className="flex flex-col gap-3 border-t pt-5">
                  {(vote.options ?? []).map((opt) => {
                    const pct =
                      totalVotes > 0
                        ? Math.round((opt.votesCount / totalVotes) * 100)
                        : 0;
                    const isMultiple = vote.type === 'multiple';
                    const isSelected = (
                      selectedOptions[vote.postgres_id] ?? []
                    ).includes(opt.id);
                    return (
                      <div key={opt.id} className="flex flex-col gap-1">
                        <div className="flex justify-between text-[15px] font-bold px-1">
                          <span>{opt.label}</span>
                          <span className="text-blue-1">
                            {pct}% ({opt.votesCount})
                          </span>
                        </div>
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-1 transition-all duration-500"
                            style={{ width: pct + '%' }}
                          />
                        </div>
                        {isMultiple ? (
                          <label className="mt-1 flex items-center gap-2 text-sm font-bold">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={voted || closed}
                              onChange={() =>
                                toggleOption(vote.postgres_id, opt.id)
                              }
                              className="h-4 w-4"
                            />
                            {t('vote.select')}
                          </label>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleVote(vote.postgres_id, [opt.id])
                            }
                            disabled={voted || closed}
                            className="mt-1 bg-blue-1 text-white text-sm font-bold py-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t('vote.voteButton')}
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {vote.type === 'multiple' && (
                    <button
                      type="button"
                      onClick={() =>
                        handleVote(
                          vote.postgres_id,
                          selectedOptions[vote.postgres_id] ?? [],
                        )
                      }
                      disabled={
                        voted ||
                        closed ||
                        (selectedOptions[vote.postgres_id] ?? []).length === 0
                      }
                      className="mt-2 bg-blue-1 text-white text-sm font-bold py-2 rounded-full hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {t('vote.confirmMyVote')}
                    </button>
                  )}
                </div>

                {voted && (
                  <p className="text-center text-sm font-semibold text-gray-500">
                    {t('vote.votedNotice')}
                  </p>
                )}
                {closed && (
                  <p className="text-center text-sm font-semibold text-orange-1">
                    {t('vote.closedNotice')}
                  </p>
                )}

                <div className="text-center">
                  <span className="text-lg font-medium text-black">
                    {t('vote.totalVotes', { count: totalVotes })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <span className="block text-3xl font-bold text-blue-1">{value}</span>
      <span className="text-sm font-medium uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

export default Vote;
