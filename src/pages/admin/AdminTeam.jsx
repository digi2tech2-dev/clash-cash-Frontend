import React, { useCallback, useEffect, useState } from 'react';
import apiClient from '../../services/client';
import useAuthStore from '../../store/useAuthStore';
import { useToast } from '../../components/ui/Toast';

const normalizeRole = (role) => String(role || '').toUpperCase();

async function fetchRoleUsers(role) {
  const all = [];
  const limit = 100;

  for (let page = 1; page <= 1000; page += 1) {
    const response = await apiClient.users.list({ role, page, limit });
    const items = Array.isArray(response)
      ? response
      : (response?.users || []);

    all.push(...items);

    const totalPages = Number(response?.pagination?.pages || 0);
    if (totalPages > 0) {
      if (page >= totalPages) return all;
    } else if (items.length < limit) {
      return all;
    }
  }

  throw new Error('تعذر تحميل القائمة بالكامل.');
}

export default function AdminTeam() {
  const { user: actor } = useAuthStore();
  const { addToast } = useToast();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [error, setError] = useState('');

  const isAdmin = normalizeRole(actor?.role) === 'ADMIN';
  const actorId = String(actor?.id || actor?._id || '');

  const refresh = useCallback(async () => {
    if (!isAdmin) return;

    setLoading(true);
    setError('');

    try {
      const [admins, supervisors] = await Promise.all([
        fetchRoleUsers('ADMIN'),
        fetchRoleUsers('SUPERVISOR'),
      ]);

      const unique = new Map();
      [...admins, ...supervisors].forEach((member) => {
        const id = String(member.id || member._id || '');
        if (id) unique.set(id, member);
      });
      setMembers([...unique.values()]);
    } catch (err) {
      setError(err?.message || 'تعذر تحميل أعضاء الإدارة.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isAdmin) return null;

  const removeRole = (member) => {
    const id = String(member.id || member._id || '');
    if (!id || id === actorId || busyId) return;
    setConfirmTarget(member);
  };

  const confirmRevoke = async () => {
    if (!confirmTarget || busyId) return;

    const id = String(
      confirmTarget.id || confirmTarget._id || ''
    );

    if (!id || id === actorId) return;

    setBusyId(id);

    try {
      await apiClient.users.updateRole(
        id,
        'CUSTOMER',
        actor
      );

      setConfirmTarget(null);
      addToast('تم سحب الصلاحيات بنجاح.', 'success');
      await refresh();
    } catch (err) {
      addToast(
        err?.message || 'فشل سحب الصلاحيات.',
        'error'
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold">إدارة الأدمنز والمشرفين</h2>
          <p className="mt-1 text-xs opacity-70">
            عرض أعضاء الإدارة وسحب صلاحياتهم دون حذف الحسابات
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading || Boolean(busyId)}
          className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-xs disabled:opacity-50"
        >
          تحديث القائمة
        </button>
      </div>

      {loading && <p className="text-xs">جارٍ تحميل أعضاء الإدارة...</p>}

      {error && (
        <p role="alert" className="text-xs text-red-600">{error}</p>
      )}

      {!loading && !error && !members.length && (
        <p className="text-xs">لا توجد حسابات إدارية لعرضها.</p>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {members.map((member) => {
            const id = String(member.id || member._id || '');
            const isSelf = id === actorId;
            const role = normalizeRole(member.role);

            return (
              <div
                key={id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    {member.name || 'بدون اسم'}
                    {isSelf ? ' (حسابك)' : ''}
                  </p>
                  <p className="break-all text-xs opacity-70">{member.email}</p>
                  <p className="mt-1 text-xs font-bold">
                    {role === 'ADMIN' ? 'أدمن' : 'مشرف'}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={isSelf || Boolean(busyId)}
                  onClick={() => removeRole(member)}
                  className="rounded-lg border border-red-500 px-3 py-2 text-xs font-semibold text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSelf
                    ? 'لا يمكن تعديل حسابك'
                    : busyId === id
                      ? 'جارٍ التنفيذ...'
                      : 'سحب الصلاحية'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {confirmTarget && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="team-revoke-heading"
            dir="rtl"
            className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 text-[var(--color-text)] shadow-2xl"
          >
            <h3
              id="team-revoke-heading"
              className="mb-3 text-lg font-bold text-[var(--color-primary)]"
            >
              تأكيد سحب الصلاحية
            </h3>

            <p className="mb-4 text-sm">
              هل تريد سحب صلاحيات الحساب التالي؟
            </p>

            <div className="mb-4 space-y-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
              <p>
                <span className="opacity-65">الاسم: </span>
                <strong>{confirmTarget.name || 'بدون اسم'}</strong>
              </p>
              <p className="break-all" dir="auto">
                <span className="opacity-65">البريد: </span>
                {confirmTarget.email}
              </p>
              <p>
                <span className="opacity-65">الدور الحالي: </span>
                <strong>
                  {normalizeRole(confirmTarget.role) === 'ADMIN'
                    ? 'أدمن'
                    : 'مشرف'}
                </strong>
              </p>
            </div>

            <p className="mb-5 text-sm leading-7 opacity-80">
              سيتم تحويل الحساب إلى مستخدم عادي وإزالة
              أذوناته المخصصة، بدون حذف حسابه أو طلباته
              أو رصيده.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => setConfirmTarget(null)}
                className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={confirmRevoke}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {busyId
                  ? 'جارٍ سحب الصلاحية...'
                  : 'تأكيد سحب الصلاحية'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
