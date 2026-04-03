import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { Copy, Plus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const DIARY_STATUSES = [
  'بدون حالة', 'تم التسليم', 'مؤجل', 'مرتجع', 'تسليم جزئي',
  'فرق شحن', 'عمولة التسليم', 'رفض دون شحن', 'غرامة مرتجع',
];

const RETURN_STATUSES = ['مرتجع', 'فرق شحن', 'عمولة التسليم', 'رفض دون شحن', 'غرامة مرتجع'];

interface Props {
  diary: any;
  diaryOrders: any[];
  onCopyOrder: (orderId: string) => void;
}

export default function FinancialSheet({ diary, diaryOrders, onCopyOrder }: Props) {
  const qc = useQueryClient();
  const [partialDialog, setPartialDialog] = useState<{ open: boolean; diaryOrderId: string; order: any } | null>(null);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Local state for manual inputs
  const [localFields, setLocalFields] = useState<Record<string, Record<string, string>>>({});

  // Financial summary - persisted to diary
  const [cashArrivedEntries, setCashArrivedEntries] = useState<string[]>(['']);
  const [balance, setBalance] = useState('');
  const [previousDue, setPreviousDue] = useState('');
  const [showPostponedDue, setShowPostponedDue] = useState(true);
  const [manualArrivedTotal, setManualArrivedTotal] = useState<string>('');

  // Load persisted financial data from diary
  useEffect(() => {
    if (diary) {
      const entries = (diary as any).cash_arrived_entries;
      if (Array.isArray(entries) && entries.length > 0) {
        setCashArrivedEntries(entries.map(String));
      }
      const bal = (diary as any).balance;
      if (bal) setBalance(String(bal));
      const prev = (diary as any).previous_due;
      if (prev) setPreviousDue(String(prev));
      setShowPostponedDue((diary as any).show_postponed_due !== false);
      const mat = (diary as any).manual_arrived_total;
      if (mat != null) setManualArrivedTotal(String(mat));
    }
  }, [diary?.id]);

  // Save financial summary to diary
  const saveFinancialSummary = useCallback(async (field: string, value: any) => {
    await supabase.from('diaries').update({ [field]: value } as any).eq('id', diary.id);
  }, [diary?.id]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, partial }: { id: string; status: string; partial?: number }) => {
      if (diary.lock_status_updates) throw new Error('تعديل الحالات مقفل');
      const update: any = { status_inside_diary: status };
      if (partial !== undefined) update.partial_amount = partial;
      const { error } = await supabase.from('diary_orders').update(update).eq('id', id);
      if (error) throw error;
      await logActivity('تغيير حالة أوردر في يومية', { diary_order_id: id, new_status: status, diary_id: diary.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
      toast.success('تم تحديث الحالة');
    },
    onError: (e: any) => toast.error(e.message || 'فشل التحديث'),
  });

  const updateNColumn = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase.from('diary_orders').update({ n_column: value.slice(0, 1) }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] }),
  });

  // Save manual field on blur
  const saveManualField = async (id: string, field: string, value: string) => {
    const numVal = field === 'manual_return_status' ? value : (parseFloat(value) || 0);
    await supabase.from('diary_orders').update({ [field]: numVal } as any).eq('id', id);
    qc.invalidateQueries({ queryKey: ['diary-orders', diary.id] });
  };

  const getLocalValue = (id: string, field: string, dbValue: any) => {
    if (localFields[id]?.[field] !== undefined) return localFields[id][field];
    return dbValue != null && dbValue !== 0 ? String(dbValue) : '';
  };

  const setLocalValue = (id: string, field: string, value: string) => {
    setLocalFields(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [field]: value } }));
  };

  const handleStatusChange = (diaryOrder: any, newStatus: string) => {
    if (diary.lock_status_updates) {
      toast.error('تعديل الحالات مقفل في هذه اليومية');
      return;
    }
    if (newStatus === 'تسليم جزئي') {
      setPartialDialog({ open: true, diaryOrderId: diaryOrder.id, order: diaryOrder.orders });
      setCollectedAmount('');
      return;
    }
    updateStatus.mutate({ id: diaryOrder.id, status: newStatus, partial: 0 });
  };

  const handlePartialSubmit = () => {
    if (!partialDialog) return;
    const collected = parseFloat(collectedAmount);
    const shipping = partialDialog.order?.delivery_price || 0;
    if (isNaN(collected) || collected <= 0) {
      toast.error('أدخل مبلغ صحيح');
      return;
    }
    if (collected < shipping) {
      toast.warning('تحذير: المبلغ المحصل أقل من مصاريف الشحن!');
    }
    const partialDelivery = Math.max(0, collected - shipping);
    updateStatus.mutate({ id: partialDialog.diaryOrderId, status: 'تسليم جزئي', partial: partialDelivery });
    setPartialDialog(null);
  };

  const calcRow = (dOrder: any) => {
    const price = dOrder.orders?.price || 0;
    const status = dOrder.status_inside_diary;
    const partial = dOrder.partial_amount || 0;
    const manualPickup = Number(dOrder.manual_pickup) || 0;
    const manualShippingDiff = Number(dOrder.manual_shipping_diff) || 0;
    const manualDeliveryCommission = Number(dOrder.manual_delivery_commission) || 0;
    const manualRejectNoShip = Number(dOrder.manual_reject_no_ship) || 0;
    const manualReturnPenalty = Number(dOrder.manual_return_penalty) || 0;
    const manualReturnStatus = dOrder.manual_return_status || '';

    return {
      price,
      executed: status === 'تم التسليم' ? price : 0,
      postponed: status === 'مؤجل' ? price : 0,
      returned: status === 'تسليم جزئي' ? (price - partial) : (RETURN_STATUSES.includes(status) ? price : 0),
      partial: status === 'تسليم جزئي' ? partial : 0,
      shippingDiff: manualShippingDiff,
      transferDelivery: manualDeliveryCommission,
      refuseNoShipping: manualRejectNoShip,
      returnPenalty: manualReturnPenalty,
      pickup: manualPickup,
      returnStatus: manualReturnStatus,
    };
  };

  const filteredOrders = diaryOrders.filter((dOrder: any) => {
    if (!searchTerm) return true;
    const o = dOrder.orders;
    const term = searchTerm.toLowerCase();
    return o?.customer_name?.toLowerCase().includes(term) || o?.barcode?.toLowerCase().includes(term) || o?.customer_code?.toLowerCase().includes(term);
  });

  const totals = filteredOrders.reduce(
    (acc: any, dOrder: any) => {
      const row = calcRow(dOrder);
      acc.price += row.price;
      acc.executed += row.executed;
      acc.postponed += row.postponed;
      acc.returned += row.returned;
      acc.partial += row.partial;
      acc.shippingDiff += row.shippingDiff;
      acc.transferDelivery += row.transferDelivery;
      acc.refuseNoShipping += row.refuseNoShipping;
      acc.returnPenalty += row.returnPenalty;
      acc.pickup += row.pickup;
      return acc;
    },
    { price: 0, executed: 0, postponed: 0, returned: 0, partial: 0, shippingDiff: 0, transferDelivery: 0, refuseNoShipping: 0, returnPenalty: 0, pickup: 0 }
  );

  // Use manual arrived total if user has set it, otherwise use calculated
  const displayArrivedTotal = manualArrivedTotal !== '' ? (parseFloat(manualArrivedTotal) || 0) : totals.executed;

  const renderManualInput = (dOrder: any, field: string, dbValue: any, width = 'w-16', isText = false) => (
    <Input
      type={isText ? 'text' : 'number'}
      className={`${width} h-7 text-xs p-1`}
      value={getLocalValue(dOrder.id, field, dbValue)}
      onChange={(e) => setLocalValue(dOrder.id, field, e.target.value)}
      onBlur={() => {
        const val = localFields[dOrder.id]?.[field];
        if (val !== undefined) saveManualField(dOrder.id, field, val);
      }}
      disabled={diary.lock_status_updates}
      placeholder={isText ? '-' : '0'}
    />
  );

  return (
    <>
      <div className="mb-3">
        <Input
          placeholder="بحث بالاسم أو الباركود أو الكود..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right w-8">#</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right w-10">ن</TableHead>
              <TableHead className="text-right">الكود</TableHead>
              <TableHead className="text-right">السعر</TableHead>
              <TableHead className="text-right">منفذ</TableHead>
              <TableHead className="text-right">نزول</TableHead>
              <TableHead className="text-right">مرتجع</TableHead>
              <TableHead className="text-right">تسليم جزئي</TableHead>
              <TableHead className="text-right">بيك اب</TableHead>
              <TableHead className="text-right">فرق شحن</TableHead>
              <TableHead className="text-right">عمولة التسليم</TableHead>
              <TableHead className="text-right">رفض دون شحن</TableHead>
              <TableHead className="text-right">غرامة مرتجع</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right">حالة المرتجع</TableHead>
              <TableHead className="text-right w-12">نسخ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={17} className="text-center py-8 text-muted-foreground">
                  لا توجد أوردرات في هذه اليومية
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((dOrder: any, idx: number) => {
                const order = dOrder.orders;
                const row = calcRow(dOrder);
                return (
                  <TableRow key={dOrder.id} className={dOrder.locked_status ? 'bg-muted/30' : ''}>
                    <TableCell className="text-sm">{idx + 1}</TableCell>
                    <TableCell className="text-sm font-medium">{order?.customer_name}</TableCell>
                    <TableCell>
                      <Input
                        className="w-8 h-7 text-center p-0 text-xs"
                        maxLength={1}
                        value={getLocalValue(dOrder.id, 'n_column', dOrder.n_column)}
                        onChange={(e) => setLocalValue(dOrder.id, 'n_column', e.target.value)}
                        onBlur={() => {
                          const val = localFields[dOrder.id]?.n_column;
                          if (val !== undefined) updateNColumn.mutate({ id: dOrder.id, value: val });
                        }}
                        disabled={diary.lock_status_updates}
                      />
                    </TableCell>
                    <TableCell className="text-sm">{order?.barcode || order?.customer_code}</TableCell>
                    <TableCell className="text-sm font-medium">{order?.price}</TableCell>
                    <TableCell className="text-sm text-green-600 font-medium">{row.executed || ''}</TableCell>
                    <TableCell className="text-sm text-yellow-600 font-medium">{row.postponed || ''}</TableCell>
                    <TableCell className="text-sm text-red-600 font-medium">{row.returned || ''}</TableCell>
                    <TableCell className="text-sm text-blue-600 font-medium">{row.partial || ''}</TableCell>
                    {renderManualInput(dOrder, 'manual_pickup', dOrder.manual_pickup)}
                    {renderManualInput(dOrder, 'manual_shipping_diff', dOrder.manual_shipping_diff)}
                    {renderManualInput(dOrder, 'manual_delivery_commission', dOrder.manual_delivery_commission)}
                    {renderManualInput(dOrder, 'manual_reject_no_ship', dOrder.manual_reject_no_ship)}
                    {renderManualInput(dOrder, 'manual_return_penalty', dOrder.manual_return_penalty)}
                    <TableCell>
                      <Select
                        value={dOrder.status_inside_diary}
                        onValueChange={(v) => handleStatusChange(dOrder, v)}
                        disabled={diary.lock_status_updates}
                      >
                        <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DIARY_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {renderManualInput(dOrder, 'manual_return_status', dOrder.manual_return_status, 'w-20', true)}
                    </TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCopyOrder(dOrder.order_id)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {filteredOrders.length > 0 && (
            <TableFooter>
              <TableRow className="bg-muted/30 font-bold text-sm">
                <TableCell colSpan={4} className="text-right">الإجمالي</TableCell>
                <TableCell>{totals.price}</TableCell>
                <TableCell className="text-green-600">
                  <Input
                    type="number"
                    className="w-20 h-7 text-xs p-1 font-bold text-green-600"
                    value={manualArrivedTotal !== '' ? manualArrivedTotal : String(totals.executed)}
                    onChange={(e) => setManualArrivedTotal(e.target.value)}
                    onBlur={() => {
                      const val = manualArrivedTotal !== '' ? (parseFloat(manualArrivedTotal) || 0) : null;
                      saveFinancialSummary('manual_arrived_total', val);
                    }}
                  />
                </TableCell>
                <TableCell className="text-yellow-600">{totals.postponed}</TableCell>
                <TableCell className="text-red-600">{totals.returned}</TableCell>
                <TableCell className="text-blue-600">{totals.partial}</TableCell>
                <TableCell>{totals.pickup}</TableCell>
                <TableCell className="text-orange-600">{totals.shippingDiff}</TableCell>
                <TableCell className="text-purple-600">{totals.transferDelivery}</TableCell>
                <TableCell className="text-gray-600">{totals.refuseNoShipping}</TableCell>
                <TableCell className="text-pink-600">{totals.returnPenalty}</TableCell>
                <TableCell colSpan={3}></TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Summary Cards */}
      {filteredOrders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">عدد الأوردرات</p>
            <p className="text-lg font-bold">{filteredOrders.length}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المنفذ</p>
            <p className="text-lg font-bold text-green-600">{displayArrivedTotal}</p>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي النزول</p>
            <p className="text-lg font-bold text-yellow-600">{totals.postponed}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">إجمالي المرتجع</p>
            <p className="text-lg font-bold text-red-600">{totals.returned}</p>
          </div>
        </div>
      )}

      {/* Manual Financial Summary - PERSISTED */}
      {filteredOrders.length > 0 && (
        <div className="mt-4 border rounded-lg p-4 space-y-4 bg-muted/20">
          <h3 className="font-bold text-foreground">الملخص المالي</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left side - Cash entries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">الواصل نقدي</label>
                <Button size="sm" variant="outline" onClick={() => {
                  const updated = [...cashArrivedEntries, ''];
                  setCashArrivedEntries(updated);
                  saveFinancialSummary('cash_arrived_entries', updated);
                }}>
                  <Plus className="h-3 w-3 ml-1" /> إضافة
                </Button>
              </div>
              {cashArrivedEntries.map((val, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const updated = [...cashArrivedEntries];
                      updated[idx] = e.target.value;
                      setCashArrivedEntries(updated);
                    }}
                    onBlur={() => saveFinancialSummary('cash_arrived_entries', cashArrivedEntries)}
                    className="h-8 text-sm"
                    placeholder={`واصل نقدي ${idx + 1}`}
                  />
                  {cashArrivedEntries.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                      const updated = cashArrivedEntries.filter((_, i) => i !== idx);
                      setCashArrivedEntries(updated);
                      saveFinancialSummary('cash_arrived_entries', updated);
                    }}>×</Button>
                  )}
                </div>
              ))}
              <div className="text-sm font-medium">
                إجمالي الواصل نقدي: <strong>{cashArrivedEntries.reduce((s, v) => s + (parseFloat(v) || 0), 0)}</strong>
              </div>
            </div>

            {/* Right side - Summary calculations */}
            <div className="space-y-3">
              {(() => {
                const totalCashArrived = cashArrivedEntries.reduce((s, v) => s + (parseFloat(v) || 0), 0);
                const balanceNum = parseFloat(balance) || 0;
                const previousDueNum = parseFloat(previousDue) || 0;
                const diaryDiff = totals.price - totalCashArrived;
                const finalDue = (diaryDiff + previousDueNum) - (balanceNum + totals.returned + totals.postponed + totals.pickup + totals.shippingDiff + totals.transferDelivery + totals.refuseNoShipping + totals.returnPenalty);
                const dueWithPostponed = finalDue + totals.postponed;

                return (
                  <>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-36">الواصل:</label>
                      <span className="font-bold">{totalCashArrived}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-36">الرصيد:</label>
                      <Input type="number" value={balance} onChange={e => setBalance(e.target.value)}
                        onBlur={() => saveFinancialSummary('balance', parseFloat(balance) || 0)}
                        className="h-8 text-sm w-36" placeholder="0" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm w-36">مستحق سابق للعميل:</label>
                      <Input type="number" value={previousDue} onChange={e => setPreviousDue(e.target.value)}
                        onBlur={() => saveFinancialSummary('previous_due', parseFloat(previousDue) || 0)}
                        className="h-8 text-sm w-36" placeholder="0" />
                    </div>
                    <div className="border-t border-border pt-2 space-y-2 text-sm">
                      <div>فرق اليومية = {totals.price} - {totalCashArrived} = <strong>{diaryDiff}</strong></div>
                      <div>
                        المستحق = ({diaryDiff} + {previousDueNum}) - ({balanceNum} + {totals.returned} + {totals.postponed} + {totals.pickup} + {totals.shippingDiff} + {totals.transferDelivery} + {totals.refuseNoShipping} + {totals.returnPenalty}) = <strong className="text-primary text-lg">{finalDue}</strong>
                      </div>
                      
                      {/* Show/Hide postponed due toggle */}
                      <div className="flex items-center gap-2 mt-2">
                        <Switch
                          checked={showPostponedDue}
                          onCheckedChange={(checked) => {
                            setShowPostponedDue(checked);
                            saveFinancialSummary('show_postponed_due', checked);
                          }}
                        />
                        <label className="text-sm">إظهار المستحق بالنزول (المؤجل)</label>
                      </div>

                      {showPostponedDue && (
                        <div className="bg-yellow-50 dark:bg-yellow-950/20 p-2 rounded border border-yellow-200 dark:border-yellow-800">
                          المستحق بالنزول (المؤجل) = {finalDue} + {totals.postponed} = <strong className="text-primary text-lg">{dueWithPostponed}</strong>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Partial Delivery Dialog */}
      <Dialog open={!!partialDialog?.open} onOpenChange={(o) => !o && setPartialDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تسليم جزئي</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
              <div>سعر الأوردر: <strong>{partialDialog?.order?.price}</strong></div>
              <div>مصاريف الشحن: <strong>{partialDialog?.order?.delivery_price}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ المحصل من العميل</label>
              <Input type="number" value={collectedAmount} onChange={(e) => setCollectedAmount(e.target.value)} placeholder="أدخل المبلغ المحصل" className="mt-1" />
            </div>
            {collectedAmount && parseFloat(collectedAmount) > 0 && (
              <div className="text-sm space-y-1 bg-blue-50 dark:bg-blue-950/20 p-3 rounded border">
                <div>تسليم جزئي = <strong>{Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</strong></div>
                <div>مرتجع = <strong>{(partialDialog?.order?.price || 0) - Math.max(0, parseFloat(collectedAmount) - (partialDialog?.order?.delivery_price || 0))}</strong></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartialDialog(null)}>إلغاء</Button>
            <Button onClick={handlePartialSubmit}>تأكيد</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
