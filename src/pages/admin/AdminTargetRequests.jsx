import React, { useEffect, useMemo, useState } from 'react';
import { Boxes, CheckCircle2, ClipboardList, Target, RefreshCw, Search } from 'lucide-react';
import AdminOrdersTable from '../../components/target/AdminOrdersTable';
import AdminProducts from '../../components/target/AdminProducts';
import RejectionReasonModal from '../../components/target/RejectionReasonModal';
import TargetOrderDetailsModal from '../../components/target/TargetOrderDetailsModal';
import Button from '../../components/ui/Button';
import apiClient from '../../services/client';
import useTargetStore from '../../store/useTargetStore';
import useAuthStore from '../../store/useAuthStore';
import useSystemStore from '../../store/useSystemStore';
import { useToast } from '../../components/ui/Toast';
import { formatNumber } from '../../utils/intl';
import { PERMISSIONS, hasPermission } from '../../utils/permissions';
import { getTargetPaymentMethods, isSiteWalletPaymentMethod } from '../../utils/paymentSettings';

const AdminTargetRequests = () => {
  const {
    products,
    requests,
    addProduct,
    updateProduct,
    deleteProduct,
    loadApps,
    updateRequestStatus,
  } = useTargetStore();
  const { paymentSettings, loadPaymentSettings } = useSystemStore();
  const { user: actor } = useAuthStore();
  const { addToast } = useToast();
  const [rejectingRequest, setRejectingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestPage, setRequestPage] = useState(1);
  const [requestStatus, setRequestStatus] = useState('');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [pageData, setPageData] = useState({ pagination: {}, summary: {} });
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestError, setRequestError] = useState('');
  const [requestRevision, setRequestRevision] = useState(0);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);
  const canConfirmTargetRequests = hasPermission(actor, PERMISSIONS.CONFIRM_TARGET_REQUESTS);

  useEffect(() => {
    void loadApps({ includeInactive: true }).catch(() => addToast('تعذر تحميل تطبيقات التارجت.', 'error'));
    void loadPaymentSettings({ force: true }).catch(() => addToast('تعذر تحميل وسائل الاستلام.', 'error'));
  }, [loadApps, loadPaymentSettings]);

  useEffect(() => {
    let active = true;
    setLoadingRequests(true);
    setRequestError('');
    apiClient.targetPurchases.listPage({ page: requestPage, limit: 20, ...(requestStatus ? { status: requestStatus } : {}), ...(appliedSearch ? { search: appliedSearch } : {}) })
      .then((result) => {
        if (!active) return;
        useTargetStore.setState({ requests: result.orders });
        setPageData(result);
      })
      .catch(() => { if (active) setRequestError('تعذر تحميل الطلبات. حاول مرة أخرى.'); })
      .finally(() => { if (active) setLoadingRequests(false); });
    return () => { active = false; };
  }, [requestPage, requestStatus, appliedSearch, requestRevision]);

  const paymentMethods = useMemo(() => getTargetPaymentMethods(paymentSettings), [paymentSettings]);

  const handleAddProduct = async (payload) => {
    try {
      await addProduct(payload);
      await loadApps({ includeInactive: true }).catch(() => null);
      addToast('تم إنشاء تطبيق التارجت بنجاح.', 'success');
      return true;
    } catch (error) {
      addToast(error?.status === 413 ? 'رفض الخادم رفع الصورة بسبب حد حجم الطلب. يرجى مراجعة إعدادات الرفع على الخادم.' : (error?.message || 'تعذرت إضافة تطبيق التارجت.'), 'error');
      return false;
    }
  };

  const handleUpdateProduct = async (id, payload) => {
    try {
      await updateProduct(id, payload);
      await loadApps({ includeInactive: true }).catch(() => null);
      addToast('تم تحديث تطبيق التارجت بنجاح.', 'success');
      return true;
    } catch (error) {
      addToast(error?.status === 413 ? 'رفض الخادم رفع الصورة بسبب حد حجم الطلب. يرجى مراجعة إعدادات الرفع على الخادم.' : (error?.message || 'تعذر تحديث تطبيق التارجت.'), 'error');
      return false;
    }
  };

  const handleDeleteProduct = async (id) => {
    try {
      await deleteProduct(id);
      addToast('تم تعطيل تطبيق التارجت.', 'success');
    } catch (error) {
      addToast(error?.message || 'تعذر تعطيل تطبيق التارجت.', 'error');
    }
  };

  const handleStatusChange = async (id, status, payload = {}) => {
    if (!canConfirmTargetRequests) {
      addToast('ليس لديك صلاحية مراجعة طلبات التارجت.', 'error');
      return;
    }

    if (String(status).toUpperCase() === 'REJECTED') {
      setRejectingRequest(requests.find((request) => String(request.id) === String(id)) || { id });
      return;
    }

    const targetRequest = requests.find((request) => String(request.id) === String(id));
    const walletPayout = isSiteWalletPaymentMethod({
      id: targetRequest?.paymentMethodId || targetRequest?.paymentMethodIdSnapshot,
      name: targetRequest?.paymentMethodName || targetRequest?.paymentMethodNameSnapshot || targetRequest?.paymentMethod,
      type: targetRequest?.paymentMethodTypeSnapshot,
    });
    if (String(status).toUpperCase() === 'APPROVED' && !walletPayout && !payload.payoutProof) {
      setSelectedRequest(targetRequest || { id });
      addToast('افتح تفاصيل الطلب وارفع إثبات تحويل مستحقات العميل قبل القبول.', 'error');
      return;
    }

    setIsStatusUpdating(true);
    try {
      const updated = await updateRequestStatus(id, status, { rejectionReason: '', ...payload });
      setRequestRevision((value) => value + 1);
      setSelectedRequest((current) => (String(current?.id) === String(id) ? { ...current, ...updated } : current));
      addToast(
        String(status).toUpperCase() === 'APPROVED' && walletPayout
          ? `تم قبول الطلب وإضافة ${updated?.payoutAmount ?? targetRequest?.totalPrice ?? 0} ${updated?.payoutCurrency || 'EGP'} إلى رصيد العميل.`
          : 'تم تحديث حالة طلب التارجت.',
        'success'
      );
    } catch (error) {
      addToast(error?.message || 'تعذر تحديث حالة طلب التارجت.', 'error');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleConfirmReject = async (reason) => {
    if (!rejectingRequest?.id) return;
    setIsStatusUpdating(true);
    try {
      const updated = await updateRequestStatus(rejectingRequest.id, 'REJECTED', { adminNotes: reason, rejectionReason: reason });
      setSelectedRequest((current) => (String(current?.id) === String(rejectingRequest.id) ? { ...current, ...updated } : current));
      setRejectingRequest(null);
      setRequestRevision((value) => value + 1);
      addToast('تم رفض طلب التارجت.', 'success');
    } catch (error) {
      addToast(error?.message || 'تعذر رفض الطلب. حاول مرة أخرى.', 'error');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const pendingCount = pageData.summary?.pendingCount || 0;
  const completedCount = pageData.summary?.approvedCount || 0;

  return (
    <div className="min-w-0 space-y-4 text-[var(--color-text)] sm:space-y-5">
      <section className="overflow-hidden rounded-[1.4rem] border border-sky-500/20 bg-[radial-gradient(26rem_circle_at_top_right,rgb(14_165_233/0.12),transparent_48%),linear-gradient(135deg,rgb(var(--color-card-rgb)/0.98),rgb(var(--color-surface-rgb)/0.9))] p-3.5 shadow-[0_20px_55px_-44px_rgb(14_165_233/0.52)] sm:p-4">
        <div className="flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/15">
              <Target className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="text-base font-black text-[var(--color-text)] sm:text-xl">تطبيقات وطلبات التارجت</h1>
              <p className="mt-0.5 text-[11px] leading-5 text-[var(--color-text-secondary)] sm:text-xs">
              إدارة تطبيقات التارجت ومراجعة طلبات العملاء من لوحة التحكم.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[24rem]">
            <div className="flex items-center gap-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-2.5 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-500"><Boxes className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-base font-black leading-none text-sky-500">{formatNumber(products.length, 'en-US')}</p>
                <p className="mt-1 text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">التطبيقات</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-2.5 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500"><ClipboardList className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-base font-black leading-none text-amber-500">{formatNumber(pendingCount, 'en-US')}</p>
                <p className="mt-1 text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">قيد المراجعة</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500"><CheckCircle2 className="h-3.5 w-3.5" /></span>
              <div>
                <p className="text-base font-black leading-none text-emerald-500">{formatNumber(completedCount, 'en-US')}</p>
                <p className="mt-1 text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">المقبولة</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[1.4rem] border border-indigo-500/20 bg-[radial-gradient(22rem_circle_at_left,rgb(99_102_241/0.1),transparent_60%),linear-gradient(135deg,rgb(var(--color-card-rgb)/0.96),rgb(var(--color-surface-rgb)/0.82))] p-3.5 shadow-[0_20px_55px_-46px_rgb(99_102_241/0.6)] sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/15">
              <ClipboardList className="h-4.5 w-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-black text-[var(--color-text)] sm:text-base">طلبات التارجت</h2>
              <p className="mt-0.5 text-[11px] leading-5 text-[var(--color-text-secondary)] sm:text-xs">
                راجع التحويلات والإثباتات وحالة كل طلب من القائمة أدناه.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-bold text-amber-500">
              <ClipboardList className="h-3.5 w-3.5" />
              {formatNumber(pendingCount, 'en-US')} قيد المراجعة
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-bold text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {formatNumber(completedCount, 'en-US')} مقبولة
            </span>
            <Button type="button" variant="secondary" className="h-9 rounded-xl border-indigo-500/25 bg-indigo-500/10 px-3 text-xs text-indigo-500 hover:border-indigo-500/40 hover:bg-indigo-500/15" onClick={() => document.getElementById('target-orders')?.scrollIntoView({ behavior: 'smooth' })}>
              عرض الطلبات
            </Button>
          </div>
        </div>
      </section>

      <section id="target-orders" className="scroll-mt-24 rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-card)] p-3.5 sm:p-5">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-lg font-black">طلبات التارجت</h2><p className="mt-1 text-xs text-[var(--color-text-secondary)]">راجع التحويلات ووسيلة الاستلام وتفاصيل كل طلب.</p></div><Button type="button" variant="secondary" size="sm" disabled={loadingRequests} onClick={() => setRequestRevision((value) => value + 1)}><RefreshCw className="h-4 w-4" /> تحديث</Button></div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.06] p-2.5 text-center">
              <p className="text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">كل الطلبات</p>
              <p className="mt-1 text-lg font-black leading-none text-sky-500">{formatNumber(pageData.summary?.totalOrders || 0, 'en-US')}</p>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-2.5 text-center">
              <p className="text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">قيد المراجعة</p>
              <p className="mt-1 text-lg font-black leading-none text-amber-500">{formatNumber(pendingCount, 'en-US')}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-2.5 text-center">
              <p className="text-[9px] text-[var(--color-text-secondary)] sm:text-[10px]">المقبولة</p>
              <p className="mt-1 text-lg font-black leading-none text-emerald-500">{formatNumber(completedCount, 'en-US')}</p>
            </div>
          </div>

          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); setRequestPage(1); setAppliedSearch(search.trim()); }}>
            <label className="relative min-w-0 flex-1"><span className="sr-only">البحث في الطلبات</span><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-secondary)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالعميل أو التطبيق أو رقم التحويل" className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-10 text-sm text-[var(--color-text)]" /></label>
            <select aria-label="حالة الطلب" value={requestStatus} onChange={(event) => { setRequestPage(1); setRequestStatus(event.target.value); }} className="h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text)]"><option value="">كل الحالات</option><option value="PENDING">قيد المراجعة</option><option value="APPROVED">مقبولة</option><option value="REJECTED">مرفوضة</option></select>
            <Button type="submit" size="sm" className="h-11">بحث</Button>
          </form>

          <div className="lg:rounded-[1.25rem] lg:border lg:border-[color:rgb(var(--color-border-rgb)/0.78)] lg:bg-[color:rgb(var(--color-card-rgb)/0.72)] lg:p-2">
            {loadingRequests ? <p role="status" className="py-10 text-center text-sm text-[var(--color-text-secondary)]">جارٍ تحميل الطلبات...</p> : requestError ? <p role="alert" className="py-10 text-center text-sm text-[var(--color-error)]">{requestError}</p> : <AdminOrdersTable
              requests={requests}
              onStatusChange={handleStatusChange}
              onViewDetails={(request) => setSelectedRequest(request)}
              canConfirm={canConfirmTargetRequests && !isStatusUpdating}
              showHeader={false}
            />}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-text-secondary)]"><span>الطلبات المطابقة: {formatNumber(pageData.pagination?.total || 0, 'en-US')}</span><div className="flex items-center gap-2"><Button type="button" variant="secondary" size="sm" disabled={loadingRequests || requestPage <= 1} onClick={() => setRequestPage((page) => page - 1)}>السابق</Button><span>صفحة {requestPage} من {Math.max(1, pageData.pagination?.pages || 0)}</span><Button type="button" variant="secondary" size="sm" disabled={loadingRequests || requestPage >= (pageData.pagination?.pages || 1)} onClick={() => setRequestPage((page) => page + 1)}>التالي</Button></div></div>
        </div>
      </section>

      <AdminProducts products={products} paymentMethods={paymentMethods} onAdd={handleAddProduct} onUpdate={handleUpdateProduct} onDelete={handleDeleteProduct} />

      <RejectionReasonModal
        isOpen={Boolean(rejectingRequest)}
        onClose={() => setRejectingRequest(null)}
        onConfirm={handleConfirmReject}
      />

      <TargetOrderDetailsModal
        isOpen={Boolean(selectedRequest)}
        onClose={() => setSelectedRequest(null)}
        order={selectedRequest}
        canManage={canConfirmTargetRequests}
        isUpdating={isStatusUpdating}
        onStatusChange={handleStatusChange}
      />
    </div>
  );
};

export default AdminTargetRequests;
