import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, ApiError } from '../../api';

const EXAMPLES = [
  'FIND events WHERE tags CONTAINS "social" LIMIT 5',
  'FIND votes WHERE status = "active"',
  'FIND services LIMIT 10',
];

// Mots-clés du langage + collections MongoDB interrogeables.
const KEYWORDS = ['FIND', 'WHERE', 'LIMIT', 'AND', 'OR', 'CONTAINS'];
const COLLECTIONS = [
  'events', 'contracts', 'messages', 'votes', 'services',
  'inhabitants', 'neighborhoods', 'conversations',
];
// Vocabulaire complet pour l'autocomplétion.
const VOCAB = [...KEYWORDS, ...COLLECTIONS];

export default function AdminQuery() {
  const { t } = useTranslation();
  const [query, setQuery] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // mot en cours de frappe, pour proposer la suite
  const motCourant = query.split(/\s/).pop() ?? '';
  const suggestions =
    motCourant.length >= 1
      ? VOCAB.filter(
          (mot) =>
            mot.toLowerCase().startsWith(motCourant.toLowerCase()) &&
            mot.toLowerCase() !== motCourant.toLowerCase(),
        ).slice(0, 6)
      : [];

  // Remplace le dernier mot tapé par la suggestion choisie.
  const appliquerSuggestion = (mot: string) => {
    const tokens = query.split(/(\s+)/);
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].trim() !== '') {
        tokens[i] = mot;
        break;
      }
    }
    setQuery(tokens.join('') + ' ');
  };

  // Ajoute un mot (une collection) à la fin de la requête.
  const ajouterMot = (mot: string) => {
    setQuery((q) => `${q.trimEnd()} ${mot} `.trimStart());
  };

  const run = async () => {
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      const res = await adminApi.runQuery(query);
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.queryError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-2">{t('admin.queryConsoleTitle')}</h2>
      <p className="text-gray-500 mb-4">{t('admin.queryConsoleHint')}</p>

      <div className="flex flex-wrap gap-2 mb-3">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setQuery(ex)}
            className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 font-mono"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={3}
          className="w-full border rounded-xl p-4 font-mono text-sm outline-none focus:border-blue-1"
        />

        {/* Suggestions d'autocomplétion, collées juste sous la zone de saisie */}
        {suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 bg-white border rounded-xl shadow-lg p-2 flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400">{t('admin.querySuggestions')} :</span>
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => appliquerSuggestion(s)}
                className="text-xs bg-blue-50 text-blue-1 hover:bg-blue-100 rounded-full px-3 py-1 font-mono"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Collections MongoDB interrogeables (clic = insertion dans la requête) */}
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-500 mb-2">
          {t('admin.queryCollections')} :
        </p>
        <div className="flex flex-wrap gap-2">
          {COLLECTIONS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => ajouterMot(c)}
              className="text-xs bg-gray-100 hover:bg-gray-200 rounded-full px-3 py-1 font-mono"
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-3">
        <button
          onClick={run}
          disabled={busy || !query.trim()}
          className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? t('admin.running') : t('admin.runButton')}
        </button>
      </div>

      {error && <p className="bg-orange-100 text-orange-1 font-semibold px-4 py-2 rounded-xl mt-4">{error}</p>}

      {result && (
        <pre className="mt-4 bg-gray-900 text-green-300 rounded-xl p-4 overflow-auto max-h-[420px] text-sm">
          {result}
        </pre>
      )}
    </div>
  );
}
