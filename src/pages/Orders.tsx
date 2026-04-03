import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, Lock, Trash2, UserMinus, Pencil, Camera } from 'lucide-react';
import BarcodeScanner from '@/components/BarcodeScanner';
import { toast } from 'sonner';
import AddOrderDialog from '@/components/AddOrderDialog';
import { useAuth } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { moveToTrash } from '@/lib/trashUtils';

export default function Orders() {
  const { isOwner } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filterOffice, setFilterOffice] = useState('all');
  const [offices, setOffices] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [courierMap, setCourierMap] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignCourier, setAssignCourier] = useState('');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [editOrder, setEditOrder] = useState<any>(null);

  useEffect(() => { loadOrders(); loadFilters(); }, []);

  const loadFilters = async () => {
    const [o, r, s] = await Promise.all([
      supabase.from('offices').select('id, name').order('name'),
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
      supabase.from('order_statuses').select('*').order('sort_order'),
    ]);
    setOffices(o.data || []);
    setStatuses(s.data || []);
    if (r.data && r.data.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', r.data.map(x => x.user_id));
      setCouriers(profiles || []);
      const map: Record<string, string> = {};
      (profiles || []).forEach(p => { map[p.id] = p.full_name; });
      setCourierMap(map);
    }
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .eq('is_closed', false)
      .order('created_at', { ascending: false })
      .limit(500);
    setOrders(data || []);
  };

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.tracking_id?.includes(search) || o.customer_name?.includes(search) ||
      o.customer_phone?.includes(search) || o.barcode?.includes(search) || o.customer_code?.includes(search) ||
      o.address?.includes(search);
    const matchOffice = filterOffice === 'all' || o.office_id === filterOffice;
    return matchSearch && matchOffice;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(o => o.id)));
  };

  const assignToCourier = async () => {
    if (!assignCourier || selected.size === 0) { toast.error('اختر مندوب واوردرات'); return; }
    const courierStatus = statuses.find(s => s.name === 'قيد التوصيل');
    const updateData: any = { courier_id: assignCourier };
    if (courierStatus) updateData.status_id = courierStatus.id;
    
    const { error } = await supabase.from('orders').update(updateData).in('id', Array.from(selected));
    if (error) { toast.error(error.message); return; }
    logActivity('تعيين أوردرات لمندوب', { count: selected.size, courier_id: assignCourier });
    toast.success(`تم تعيين ${selected.size} أوردر للمندوب`);
    setSelected(new Set()); setAssignCourier('');
    loadOrders();
  };

  const unassignCourier = async () => {
    if (selected.size === 0) { toast.error('اختر أوردرات أولاً'); return; }
    const updateData: any = { courier_id: null, status_id: null };
    
    const { error } = await supabase.from('orders').update(updateData).in('id', Array.from(selected));
    if (error) { toast.error(error.message); return; }
    logActivity('إلغاء تعيين أوردرات', { count: selected.size });
    toast.success(`تم إلغاء تعيين ${selected.size} أوردر`);
    setSelected(new Set());
    loadOrders();
  };

  const closeSelected = async () => {
    if (selected.size === 0) { toast.error('اختر أوردرات أولاً'); return; }
    if (!confirm(`هل تريد تقفيل ${selected.size} أوردر؟`)) return;
    const { error } = await supabase.from('orders').update({ is_closed: true }).in('id', Array.from(selected));
    if (error) { toast.error(error.message); return; }
    logActivity('تقفيل أوردرات', { count: selected.size });
    toast.success(`تم تقفيل ${selected.size} أوردر`);
    setSelected(new Set());
    loadOrders();
  };

  const deleteSelected = async () => {
    if (selected.size === 0) { toast.error('اختر أوردرات أولاً'); return; }
    if (!confirm(`هل تريد نقل ${selected.size} أوردر إلى سلة المحذوفات؟`)) return;
    const ids = Array.from(selected);
    moveToTrash(ids);
    const { error } = await supabase.from('orders').update({ is_closed: true }).in('id', ids);
    if (error) { toast.error(error.message); return; }
    logActivity('نقل أوردرات لسلة المحذوفات', { count: selected.size });
    toast.success(`تم حذف ${selected.size} أوردر`);
    setSelected(new Set());
    loadOrders();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">الأوردرات</h1>
        <AddOrderDialog onOrderAdded={loadOrders} />
      </div>

      {editOrder && (
        <AddOrderDialog
          onOrderAdded={() => { loadOrders(); setEditOrder(null); }}
          editOrder={editOrder}
          onClose={() => setEditOrder(null)}
        />
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 bg-secondary border-border" />
        </div>
        <BarcodeScanner onScan={(barcode) => { setSearch(barcode); setSelected(new Set(orders.filter(o => o.barcode === barcode).map(o => o.id))); }} />
        <Select value={filterOffice} onValueChange={setFilterOffice}>
          <SelectTrigger className="w-32 sm:w-40 bg-secondary border-border"><SelectValue placeholder="المكتب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المكاتب</SelectItem>
            {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap gap-2 items-center p-3 bg-secondary rounded-lg border border-border">
          <span className="text-sm font-medium">تم تحديد {selected.size}</span>
          <Select value={assignCourier} onValueChange={setAssignCourier}>
            <SelectTrigger className="w-36 bg-card border-border"><SelectValue placeholder="اختر مندوب" /></SelectTrigger>
            <SelectContent>{couriers.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={assignToCourier} disabled={!assignCourier}><UserPlus className="h-4 w-4 ml-1" />تعيين</Button>
          <Button size="sm" variant="outline" onClick={unassignCourier}><UserMinus className="h-4 w-4 ml-1" />إلغاء التعيين</Button>
          <Button size="sm" variant="secondary" onClick={closeSelected}><Lock className="h-4 w-4 ml-1" />تقفيل</Button>
          {isOwner && <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-4 w-4 ml-1" />حذف</Button>}
        </div>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">الهاتف</TableHead>
                  <TableHead className="text-right hidden md:table-cell">المنتج</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                  <TableHead className="text-right hidden md:table-cell">المكتب</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right w-10">تعديل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={14} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                ) : filtered.map((order) => {
                  const hasCourier = !!order.courier_id;
                  return (
                    <TableRow key={order.id} className={`border-border ${hasCourier ? 'bg-muted/30' : ''}`}>
                      <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                      <TableCell className="text-xs">
                        <div className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric', year: 'numeric' })}</div>
                        <div className="font-mono font-bold">{order.barcode || '-'}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm">{order.customer_name}</TableCell>
                      <TableCell className="text-sm max-w-[250px]" title={order.address || ''}>{order.address || '-'}</TableCell>
                      <TableCell dir="ltr" className="hidden sm:table-cell text-sm">{order.customer_phone}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{order.product_name}</TableCell>
                      <TableCell className="text-sm">{Number(order.price)} ج.م</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell className="font-bold text-sm">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{order.offices?.name || '-'}</TableCell>
                      <TableCell className={`text-sm ${hasCourier ? 'font-medium' : 'text-muted-foreground'}`}>
                        {hasCourier ? (courierMap[order.courier_id] || 'مندوب') : 'غير معين'}
                      </TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: order.order_statuses?.color || undefined }} className="text-xs">
                          {order.order_statuses?.name || 'بدون حالة'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => setEditOrder(order)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
