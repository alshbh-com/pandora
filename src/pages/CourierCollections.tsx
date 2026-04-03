import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';

export default function CourierCollections() {
  const { user, isOwner } = useAuth();
  const [couriers, setCouriers] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState('');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [commissionPerOrder, setCommissionPerOrder] = useState('');
  const [commissionStatuses, setCommissionStatuses] = useState<string[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [bonuses, setBonuses] = useState<any[]>([]);
  const [bonusDialogOpen, setBonusDialogOpen] = useState(false);
  const [bonusType, setBonusType] = useState<'special' | 'office_commission'>('special');
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusReason, setBonusReason] = useState('');
  const [orderNotes, setOrderNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      const { data: roles } = await supabase.from('user_roles').select('user_id').eq('role', 'courier');
      if (roles && roles.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', roles.map(r => r.user_id));
        setCouriers(profiles || []);
      }
      const { data: sts } = await supabase.from('order_statuses').select('*').order('sort_order');
      setStatuses(sts || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedCourier) loadCourierData();
    else {
      setOrders([]);
      setBonuses([]);
      setSelectedOrders(new Set());
    }
  }, [selectedCourier]);

  const loadCourierData = async () => {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color)')
      .eq('courier_id', selectedCourier)
      .eq('is_courier_closed', false)
      .order('created_at', { ascending: false });
    setOrders(orderData || []);
    setSelectedOrders(new Set());
    // Initialize notes from orders
    const notes: Record<string, string> = {};
    (orderData || []).forEach((o: any) => { notes[o.id] = o.notes || ''; });
    setOrderNotes(notes);

    const { data: bonusData } = await supabase
      .from('courier_bonuses')
      .select('*')
      .eq('courier_id', selectedCourier)
      .order('created_at', { ascending: false });
    setBonuses(bonusData || []);
  };

  const deliveredStatus = statuses.find(s => s.name === 'تم التسليم');
  const rejectWithShipStatus = statuses.find(s => s.name === 'رفض ودفع شحن');
  const halfShipStatus = statuses.find(s => s.name === 'استلم ودفع نص الشحن');
  const partialDeliveryStatus = statuses.find(s => s.name === 'تسليم جزئي');

  const getCollectedAmount = (order: any) => {
    if (order.status_id === deliveredStatus?.id) return Number(order.price) + Number(order.delivery_price);
    if (order.status_id === partialDeliveryStatus?.id) return Number(order.partial_amount || 0);
    if (order.status_id === rejectWithShipStatus?.id || order.status_id === halfShipStatus?.id) return Number(order.shipping_paid || 0);
    return 0;
  };

  const totalCollection = orders.reduce((sum, o) => sum + getCollectedAmount(o), 0);

  const rate = parseFloat(commissionPerOrder) || 0;
  const eligibleOrders = orders.filter(o => commissionStatuses.includes(o.status_id));
  const commissionTotal = eligibleOrders.length * rate;

  const officeCommissionBonuses = bonuses.filter(b => b.reason?.startsWith('__office_commission__'));
  const totalOfficeCommission = officeCommissionBonuses.reduce((sum, b) => sum + Number(b.amount), 0);
  const regularBonuses = bonuses.filter(b => !b.reason?.startsWith('__office_commission__'));
  const totalRegularBonuses = regularBonuses.reduce((sum, b) => sum + Number(b.amount), 0);

  const netDue = totalCollection + totalOfficeCommission - commissionTotal - totalRegularBonuses;

  const toggleStatus = (statusId: string) => {
    setCommissionStatuses(prev => prev.includes(statusId) ? prev.filter(s => s !== statusId) : [...prev, statusId]);
  };

  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrders(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  };

  const toggleSelectAllOrders = () => {
    if (orders.length > 0 && selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
      return;
    }
    setSelectedOrders(new Set(orders.map(o => o.id)));
  };

  const closeSelectedOrders = async () => {
    if (selectedOrders.size === 0) { toast.error('اختر أوردرات للتقفيل'); return; }
    if (!confirm(`هل تريد تقفيل ${selectedOrders.size} أوردر؟`)) return;

    const ids = Array.from(selectedOrders);
    const { error } = await supabase.from('orders').update({ is_courier_closed: true }).in('id', ids);
    if (error) {
      toast.error(error.message);
      return;
    }

    logActivity('تقفيل أوردرات من تحصيلات المندوب', { courier_id: selectedCourier, count: ids.length });
    toast.success(`تم تقفيل ${ids.length} أوردر`);
    setSelectedOrders(new Set());
    loadCourierData();
  };

  const addBonus = async () => {
    if (!bonusAmount || !selectedCourier) return;
    const { error } = await supabase.from('courier_bonuses').insert({
      courier_id: selectedCourier,
      amount: parseFloat(bonusAmount),
      reason: bonusType === 'office_commission' ? `__office_commission__${bonusReason ? ':' + bonusReason : ''}` : (bonusReason || 'عمولة للمندوب'),
      created_by: user?.id,
    });
    if (error) { toast.error(error.message); return; }
    logActivity('إضافة عمولة لمندوب', { courier_id: selectedCourier, type: bonusType, amount: parseFloat(bonusAmount) });
    toast.success(bonusType === 'office_commission' ? 'تم إضافة عمولة المكتب' : 'تم إضافة العمولة');
    setBonusDialogOpen(false);
    setBonusAmount('');
    setBonusReason('');
    loadCourierData();
  };

  const deleteBonus = async (id: string) => {
    if (!confirm('حذف هذه العمولة؟')) return;
    await supabase.from('courier_bonuses').delete().eq('id', id);
    logActivity('حذف عمولة مندوب', { bonus_id: id, courier_id: selectedCourier });
    toast.success('تم الحذف');
    loadCourierData();
  };

  const updateOrderNotes = async (orderId: string, notes: string) => {
    setOrderNotes(prev => ({ ...prev, [orderId]: notes }));
  };

  const saveOrderNotes = async (orderId: string) => {
    const notes = orderNotes[orderId] || '';
    const { error } = await supabase.from('orders').update({ notes }).eq('id', orderId);
    if (error) { toast.error('فشل حفظ الملاحظة'); return; }
    toast.success('تم حفظ الملاحظة');
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">تحصيلات المندوبين</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">المندوب</Label>
          <Select value={selectedCourier} onValueChange={setSelectedCourier}>
            <SelectTrigger className="w-48 bg-secondary border-border"><SelectValue placeholder="اختر مندوب" /></SelectTrigger>
            <SelectContent>{couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {selectedCourier && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">إجمالي التحصيل</p><p className="text-lg font-bold text-emerald-500">{totalCollection} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">عمولة مكتب</p><p className="text-lg font-bold text-amber-500">{totalOfficeCommission} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">العمولة</p><p className="text-lg font-bold text-destructive">{commissionTotal} ج.م</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">صافي المستحق</p><p className="text-lg font-bold text-primary">{netDue} ج.م</p></CardContent></Card>
          </div>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">حاسبة العمولة</CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Dialog open={bonusDialogOpen} onOpenChange={v => { setBonusDialogOpen(v); if (!v) setBonusType('special'); }}>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => { setBonusType('special'); setBonusDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" />عمولة للمندوب</Button>
                    <Button size="sm" variant="outline" onClick={() => { setBonusType('office_commission'); setBonusDialogOpen(true); }}><Plus className="h-4 w-4 ml-1" />عمولة مكتب</Button>
                  </div>
                  <DialogContent className="bg-card border-border">
                    <DialogHeader><DialogTitle>{bonusType === 'office_commission' ? 'إضافة عمولة مكتب' : 'إضافة عمولة للمندوب'}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div><Label>المبلغ</Label><Input type="number" value={bonusAmount} onChange={e => setBonusAmount(e.target.value)} className="bg-secondary border-border" /></div>
                      <div><Label>{bonusType === 'office_commission' ? 'ملاحظة / السبب' : 'السبب'}</Label><Input value={bonusReason} onChange={e => setBonusReason(e.target.value)} className="bg-secondary border-border" placeholder={bonusType === 'office_commission' ? 'سبب عمولة المكتب...' : 'مشوار خاص...'} /></div>
                      <Button onClick={addBonus} className="w-full">حفظ</Button>
                    </div>
                  </DialogContent>
                </Dialog>
                {selectedOrders.size > 0 && (
                  <Button size="sm" variant="destructive" onClick={closeSelectedOrders}><Lock className="h-4 w-4 ml-1" />تقفيل ({selectedOrders.size})</Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {statuses.map(s => (
                  <Badge key={s.id}
                    style={{ backgroundColor: commissionStatuses.includes(s.id) ? s.color : undefined }}
                    variant={commissionStatuses.includes(s.id) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleStatus(s.id)}>
                    {s.name}
                  </Badge>
                ))}
              </div>
              <div className="flex gap-3 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">مبلغ العمولة لكل أوردر (ج.م)</Label>
                  <Input type="number" value={commissionPerOrder} onChange={e => setCommissionPerOrder(e.target.value)}
                    className="w-40 bg-secondary border-border" placeholder="30"
                    onFocus={e => { if (e.target.value === '0') setCommissionPerOrder(''); }} />
                </div>
                <p className="text-sm">= {commissionTotal} ج.م ({eligibleOrders.length} أوردر)</p>
              </div>
            </CardContent>
          </Card>

          {bonuses.length > 0 && (
            <Card className="bg-card border-border">
              <CardHeader><CardTitle className="text-base">العمولات</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow className="border-border">
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">السبب</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bonuses.map(b => (
                      <TableRow key={b.id} className="border-border">
                        <TableCell className="text-sm">{b.reason?.startsWith('__office_commission__') ? 'عمولة مكتب' : 'عمولة للمندوب'}</TableCell>
                        <TableCell className="font-bold">{b.amount} ج.م</TableCell>
                        <TableCell>{b.reason?.startsWith('__office_commission__') ? (b.reason.split(':')[1] || '-') : (b.reason || '-')}</TableCell>
                        <TableCell>{new Date(b.created_at).toLocaleDateString('ar-EG')}</TableCell>
                        <TableCell>
                          {isOwner && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteBonus(b.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card className="bg-card border-border">
            <CardHeader><CardTitle className="text-base">أوردرات المندوب ({orders.length})</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right w-10"><Checkbox checked={orders.length > 0 && selectedOrders.size === orders.length} onCheckedChange={toggleSelectAllOrders} /></TableHead>
                      <TableHead className="text-right">الباركود</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">التوصيل</TableHead>
                      <TableHead className="text-right">الإجمالي</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التحصيل</TableHead>
                      <TableHead className="text-right">تعليق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-4">لا توجد أوردرات</TableCell></TableRow>
                    ) : orders.map(o => {
                      const collected = getCollectedAmount(o);
                      return (
                        <TableRow key={o.id} className="border-border">
                          <TableCell><Checkbox checked={selectedOrders.has(o.id)} onCheckedChange={() => toggleSelectOrder(o.id)} /></TableCell>
                          <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                          <TableCell className="font-mono text-xs">{o.customer_code || '-'}</TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell>{o.price} ج.م</TableCell>
                          <TableCell>{o.delivery_price} ج.م</TableCell>
                          <TableCell className="font-bold">{Number(o.price) + Number(o.delivery_price)} ج.م</TableCell>
                          <TableCell>
                            <Badge style={{ backgroundColor: o.order_statuses?.color }} className="text-xs">
                              {o.order_statuses?.name || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold text-primary">{collected > 0 ? `${collected} ج.م` : '-'}</TableCell>
                          <TableCell>
                            <Input
                              value={orderNotes[o.id] || ''}
                              onChange={(e) => updateOrderNotes(o.id, e.target.value)}
                              onBlur={() => saveOrderNotes(o.id)}
                              className="bg-secondary border-border h-7 w-32 text-xs"
                              placeholder="تعليق..."
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}