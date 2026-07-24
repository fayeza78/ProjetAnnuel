import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  ChatDots,
  PlusLg,
  Search,
  People,
  X,
  SendFill,
  ImageFill,
} from 'react-bootstrap-icons';
import { useTranslation } from 'react-i18next';
import {
  messageApi,
  neighbourApi,
  uploadApi,
  ApiError,
  type ConversationItem,
  type Message,
  type Neighbour,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { dateLocale } from '../i18n/config';

const MAX_PHOTO_SIZE = 20 * 1024 * 1024; // 20 Mo — même limite que l'API

function Messagerie() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const myId = user ? String(user.id_user) : '';

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  const [neighbours, setNeighbours] = useState<Neighbour[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [modalSearch, setModalSearch] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const activeIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // Carte id -> nom lisible (partie locale de l'email)
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of neighbours) map.set(String(n.id_user), n.email.split('@')[0]);
    if (user) map.set(String(user.id_user), t('messagerie.me'));
    return map;
  }, [neighbours, user, t]);

  const nameOf = (id: string) => nameById.get(id) ?? `#${id}`;

  const loadConversations = async () => {
    try {
      setConversations(await messageApi.conversations());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('messagerie.loadError'));
    }
  };

  useEffect(() => {
    loadConversations();
    neighbourApi.list().then(setNeighbours).catch(() => undefined);
  }, []);

  // Auto-scroll en bas du fil à chaque nouveau message
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Rafraîchissement automatique (toutes les 4s) : liste des conversations + fil actif.
  // On ne remplace l'état que si quelque chose a changé, pour éviter de re-scroller inutilement.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        setConversations(await messageApi.conversations());
        const id = activeIdRef.current;
        if (!id) return;
        const fresh = await messageApi.messages(id);
        setMessages((prev) => {
          const sameLength = prev.length === fresh.length;
          const sameLast = prev[prev.length - 1]?.postgres_id === fresh[fresh.length - 1]?.postgres_id;
          return sameLength && sameLast ? prev : fresh;
        });
      } catch {
        /* erreurs de polling ignorées (réseau, token…) */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const openConversation = async (id: string) => {
    setActiveId(id);
    try {
      setMessages(await messageApi.messages(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('messagerie.genericError'));
    }
  };

  const handlePickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de resélectionner le même fichier
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError(t('messagerie.onlyImages'));
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setError(t('messagerie.photoTooLarge'));
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!activeId || (!draft.trim() && !photoFile)) return;
    setSending(true);
    try {
      const mediaAttachments = photoFile
        ? [
            {
              type: 'photo' as const,
              ...(await uploadApi.file(photoFile)),
            },
          ]
        : undefined;
      await messageApi.send(activeId, draft.trim(), undefined, mediaAttachments);
      setDraft('');
      clearPhoto();
      setMessages(await messageApi.messages(activeId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('messagerie.sendError'));
    } finally {
      setSending(false);
    }
  };

  const toggleSelect = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const startConversation = async () => {
    if (selected.length === 0) return;
    try {
      const conv = await messageApi.createConversation(selected.map(String));
      setShowModal(false);
      setSelected([]);
      setModalSearch('');
      await loadConversations();
      await openConversation(conv.postgres_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('messagerie.genericError'));
    }
  };

  const titleOf = (conv: ConversationItem['conversation']) => {
    const others = (conv.participants_postgres_ids ?? []).filter((id) => id !== myId);
    if (conv.title) return conv.title;
    if (others.length === 0) return t('messagerie.conversationFallback');
    return others.map(nameOf).join(', ');
  };

  const filteredNeighbours = neighbours.filter((n) =>
    n.email.toLowerCase().includes(modalSearch.toLowerCase()),
  );

  const activeConv = conversations.find((c) => c.conversation.postgres_id === activeId)?.conversation;

  return (
    <div className="w-full flex p-4">
      <div className="flex-1 flex flex-col px-4">
        {/* En-tête */}
        <div className="shadow-lg w-full bg-white rounded-2xl mb-8 flex flex-col md:flex-row md:justify-between md:items-center gap-4 px-5 md:px-10 py-6">
          <div className="flex items-center gap-4">
            <ChatDots size={36} className="text-orange-1 shrink-0" />
            <h1 className="text-2xl md:text-4xl text-orange-1 font-semibold">{t('messagerie.title')}</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 transition"
          >
            <PlusLg /> {t('messagerie.newConversation')}
          </button>
        </div>

        {error && <p className="text-orange-1 font-medium mb-4">{error}</p>}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Liste des conversations */}
          <div className="bg-white rounded-2xl shadow-lg p-6 h-[600px] flex flex-col">
            <h2 className="text-2xl font-bold mb-4">{t('messagerie.conversationsTitle')}</h2>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
              {conversations.length === 0 && (
                <div className="text-center text-gray-400 mt-10">
                  <ChatDots size={42} className="mx-auto mb-3 opacity-40" />
                  <p>{t('messagerie.noConversations')}</p>
                  <p className="text-sm">{t('messagerie.startOneHint')}</p>
                </div>
              )}
              {conversations.map(({ conversation, lastMessage }) => {
                const active = activeId === conversation.postgres_id;
                const title = titleOf(conversation);
                return (
                  <button
                    key={conversation.postgres_id}
                    onClick={() => openConversation(conversation.postgres_id)}
                    className={`text-left rounded-xl p-3 flex items-center gap-3 transition ${
                      active ? 'bg-blue-1 text-white shadow' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center font-bold ${
                        active ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-1'
                      }`}
                    >
                      {title.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{title}</p>
                      <p className={`text-sm truncate ${active ? 'text-white/80' : 'text-gray-500'}`}>
                        {lastMessage?.content ?? t('messagerie.noMessage')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fil de messages */}
          <div className="bg-white rounded-2xl shadow-lg xl:col-span-2 h-[600px] flex flex-col overflow-hidden">
            {!activeId ? (
              <div className="m-auto text-center text-gray-400">
                <ChatDots size={56} className="mx-auto mb-4 opacity-40" />
                <p className="text-lg">{t('messagerie.selectConversation')}</p>
              </div>
            ) : (
              <>
                {/* Bandeau du fil */}
                <div className="border-b px-6 py-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-1 flex items-center justify-center font-bold">
                    {activeConv ? titleOf(activeConv).charAt(0).toUpperCase() : '?'}
                  </div>
                  <p className="font-bold text-lg">{activeConv ? titleOf(activeConv) : t('messagerie.conversationFallback')}</p>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 p-6 bg-gray-50">
                  {messages.length === 0 && (
                    <p className="text-gray-400 m-auto">{t('messagerie.noMessageYet')}</p>
                  )}
                  {messages.map((m) => {
                    const mine = m.sender_postgres_id === myId;
                    return (
                      <div key={m.postgres_id} className={`flex flex-col max-w-[75%] ${mine ? 'self-end items-end' : 'self-start items-start'}`}>
                        {!mine && (
                          <span className="text-xs font-semibold text-gray-500 mb-1 px-2">
                            {nameOf(m.sender_postgres_id)}
                          </span>
                        )}
                        <div
                          className={`rounded-2xl px-4 py-2.5 flex flex-col gap-2 ${
                            mine
                              ? 'bg-blue-1 text-white rounded-br-sm'
                              : 'bg-white border rounded-bl-sm'
                          }`}
                        >
                          {(m.mediaAttachments ?? [])
                            .filter((att) => att.type === 'photo')
                            .map((att, i) => (
                              <a
                                key={i}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={att.url}
                                  alt={t('messagerie.photoAlt')}
                                  className="max-w-full max-h-64 rounded-xl object-cover"
                                />
                              </a>
                            ))}
                          {m.content && (
                            <p className="break-words">{m.content}</p>
                          )}
                        </div>
                        {m.createdAt && (
                          <span className="text-[11px] text-gray-400 mt-1 px-2">
                            {new Date(m.createdAt).toLocaleString(dateLocale(), {
                              day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    );
                  })}
                  <div ref={threadEndRef} />
                </div>

                {/* Saisie */}
                <form onSubmit={handleSend} className="flex flex-col gap-3 p-4 border-t">
                  {photoPreview && (
                    <div className="relative w-fit">
                      <img
                        src={photoPreview}
                        alt={t('messagerie.previewAlt')}
                        className="h-24 rounded-xl border object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearPhoto}
                        className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full w-6 h-6 flex items-center justify-center hover:opacity-90"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex gap-3">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handlePickPhoto}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      title={t('messagerie.attachPhoto')}
                      className="border-2 border-blue-1 text-blue-1 px-4 py-3 rounded-full font-bold hover:bg-gray-50"
                    >
                      <ImageFill size={20} />
                    </button>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder={t('messagerie.messagePlaceholder')}
                      className="flex-1 border rounded-full px-5 py-3 outline-none focus:border-blue-1"
                    />
                    <button
                      type="submit"
                      disabled={sending || (!draft.trim() && !photoFile)}
                      className="bg-blue-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                    >
                      <SendFill /> {t('messagerie.sendButton')}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal : nouvelle conversation ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-5 border-b">
              <div className="flex items-center gap-3">
                <People size={26} className="text-orange-1" />
                <h2 className="text-2xl font-bold">{t('messagerie.newConversation')}</h2>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700">
                <X size={28} />
              </button>
            </div>

            <div className="px-6 py-4 border-b">
              <div className="flex items-center gap-2 border rounded-full px-4 py-2.5">
                <Search className="text-gray-400" />
                <input
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  placeholder={t('messagerie.searchNeighbourPlaceholder')}
                  className="flex-1 outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2">
              {filteredNeighbours.length === 0 && (
                <p className="text-center text-gray-400 py-8">{t('messagerie.noNeighbourFound')}</p>
              )}
              {filteredNeighbours.map((n) => {
                const isSel = selected.includes(n.id_user);
                return (
                  <button
                    key={n.id_user}
                    onClick={() => toggleSelect(n.id_user)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition ${
                      isSel ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-1 flex items-center justify-center font-bold">
                      {n.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="font-bold truncate">{n.email.split('@')[0]}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {n.quartier ?? n.ville ?? n.email}
                      </p>
                    </div>
                    <span
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSel ? 'bg-blue-1 border-blue-1 text-white' : 'border-gray-300'
                      }`}
                    >
                      {isSel && '✓'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="px-6 py-4 border-t flex items-center justify-between">
              <span className="text-gray-500 text-sm">
                {t('messagerie.selectedCount', { count: selected.length })}
              </span>
              <button
                onClick={startConversation}
                disabled={selected.length === 0}
                className="bg-orange-1 text-white px-6 py-3 rounded-full font-bold hover:opacity-90 disabled:opacity-50"
              >
                {t('messagerie.startChatButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Messagerie;
