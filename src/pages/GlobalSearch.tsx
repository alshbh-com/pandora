import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';
import { logActivity } from '@/lib/activityLogger';

export default function GlobalSearch() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [editOrder, setEditOrder] = useState<any | null>(null);
  const [editStatusId, setEditStatusId] = useState('');

  useEffect(() => {
    supabase.from('order_statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []));
  }, []);

  // Auto-search with debounce
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const doSearch = async () => {
    if (!search.trim()) return;
    setLoading(true);
    const term = search.trim();

    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .or(`barcode.ilike.%${term}%,customer_code.ilike.%${term}%,customer_phone.ilike.%${term}%,tracking_id.ilike.%${term}%,customer_name.ilike.%${term}%,address.ilike.%${term}%`)
      .order('created_at', { ascending: false })
      .limit(100);
    setResults(data || []);
    setLoading(false);
  };

  const openEdit = (order: any) => {
    setEditOrder(order);
    setEditStatusId(order.status_id || '');
  };

  const saveEdit = async () => {
    if (!editOrder) return;
    const { error } = await supabase.from('orders').update({ status_id: editStatusId || null }).eq('id', editOrder.id);
    if (error) { toast.error(error.message); return; }
    logActivity('تغيير حالة أوردر من البحث الشامل', { order_id: editOrder.id, status_id: editStatusId });
    toast.success('تم تحديث الحالة');
    setEditOrder(null);
    doSearch();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">بحث شامل</h1>
      <div className="relative max-w-lg">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالباركود / الكود / رقم الهاتف / الاسم / العنوان..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="pr-9 bg-secondary border-border" />
      </div>

      {loading && <p className="text-sm text-muted-foreground">جاري البحث...</p>}

      {results.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">Tracking</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">الباركود</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">الشحن</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">مقفل</TableHead>
                    <TableHead className="text-right">تعديل</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map(order => (
                    <TableRow key={order.id} className="border-border">
                      <TableCell className="font-mono text-xs">{order.tracking_id}</TableCell>
                      <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                      <TableCell className="font-mono text-xs">{order.barcode || '-'}</TableCell>
                      <TableCell>{order.customer_name}</TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">{order.address || '-'}</TableCell>
                      <TableCell dir="ltr">{order.customer_phone}</TableCell>
                      <TableCell>{order.product_name}</TableCell>
                      <TableCell>{Number(order.price)} ج.م</TableCell>
                      <TableCell>{Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell className="font-bold">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                      <TableCell>{order.offices?.name || '-'}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: order.order_statuses?.color || undefined }} className="text-xs">
                          {order.order_statuses?.name || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[100px]">{order.notes || '-'}</TableCell>
                      <TableCell>{order.is_closed ? '✅' : '❌'}</TableCell>
                      <TableCell>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(order)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editOrder} onOpenChange={v => { if (!v) setEditOrder(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تعديل أوردر - {editOrder?.tracking_id}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الحالة</Label>
              <Select value={editStatusId} onValueChange={setEditStatusId}>
                <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر حالة" /></SelectTrigger>
                <SelectContent>
                  {statuses.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveEdit} className="w-full">حفظ التعديلات</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
