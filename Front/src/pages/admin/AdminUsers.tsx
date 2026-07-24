import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { adminApi, ApiError, type AdminUser } from '../../api';
import { useAuth } from '../../context/AuthContext';

const ROLES = ['user', 'moderateur', 'admin'];

export default function AdminUsers() {
  const { t } = useTranslation();
  const { user: me } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setUsers(await adminApi.users());
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

  const changeRole = async (id: number, role: string) => {
    setError(null);
    try {
      await adminApi.setRole(id, role);
      setUsers((prev) => prev.map((u) => (u.id_user === id ? { ...u, role: role as AdminUser['role'] } : u)));
      flash(t('admin.roleUpdated'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  const toggleBlock = async (u: AdminUser) => {
    setError(null);
    try {
      const next = !u.vote_blocked;
      await adminApi.setVoteBlock(u.id_user, next);
      setUsers((prev) => prev.map((x) => (x.id_user === u.id_user ? { ...x, vote_blocked: next } : x)));
      flash(next ? t('admin.userBlocked') : t('admin.userUnblocked'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  const remove = async (id: number) => {
    if (!confirm(t('admin.deleteUserConfirm'))) return;
    setError(null);
    try {
      await adminApi.deleteUser(id);
      setUsers((prev) => prev.filter((u) => u.id_user !== id));
      flash(t('admin.userDeleted'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('admin.genericError'));
    }
  };

  const visible = users.filter((u) => u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4 gap-4">
        <h2 className="text-2xl font-bold">{t('admin.usersTitle', { count: users.length })}</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('admin.searchEmailPlaceholder')}
          className="border rounded-full px-4 py-2 outline-none focus:border-blue-1"
        />
      </div>

      {notice && <p className="bg-green-100 text-green-700 font-semibold px-4 py-2 rounded-xl mb-3">{notice}</p>}
      {error && <p className="bg-orange-100 text-orange-1 font-semibold px-4 py-2 rounded-xl mb-3">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="py-3 px-2">#</th>
              <th className="py-3 px-2">{t('admin.colEmail')}</th>
              <th className="py-3 px-2">{t('admin.colNeighbourhood')}</th>
              <th className="py-3 px-2">{t('admin.colRole')}</th>
              <th className="py-3 px-2">{t('admin.colVotes')}</th>
              <th className="py-3 px-2 text-right">{t('admin.colActions')}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((u) => {
              const isMe = me?.id_user === u.id_user;
              return (
                <tr key={u.id_user} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2 text-gray-400">{u.id_user}</td>
                  <td className="py-3 px-2 font-semibold">
                    {u.email} {isMe && <span className="text-xs text-blue-1">{t('admin.me')}</span>}
                  </td>
                  <td className="py-3 px-2 text-gray-600">
                    {typeof u.quartier === 'string' ? u.quartier : u.quartier?.nom_quartier ?? '—'}
                  </td>
                  <td className="py-3 px-2">
                    <select
                      value={u.role}
                      disabled={isMe}
                      onChange={(e) => changeRole(u.id_user, e.target.value)}
                      className="border rounded-lg px-2 py-1 disabled:opacity-50"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => toggleBlock(u)}
                      className={`px-3 py-1 rounded-full text-sm font-bold ${
                        u.vote_blocked ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {u.vote_blocked ? t('admin.blocked') : t('admin.allowed')}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => remove(u.id_user)}
                      disabled={isMe}
                      className="text-red-500 font-semibold hover:underline disabled:opacity-30 disabled:no-underline"
                    >
                      {t('admin.deleteButton')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
