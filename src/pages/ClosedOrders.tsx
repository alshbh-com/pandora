import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { moveToTrash } from '@/lib/trashUtils';

export default function ClosedOrders() {
  const { isOwner } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<Record<string, string>>({});
  const [offices, setOffices] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { loadOrders(); loadCouriers(); loadOffices(); }, []);

  const loadCouriers = async () => {
    const { data } = await supabase.from('profiles').select('id, full_name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.full_name; });
      setCouriers(map);
    }
  };

  const loadOffices = async () => {
    const { data } = await supabase.from('offices').select('id, name').order('name');
    setOffices(data || []);
  };

  const loadOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, order_statuses(name, color), offices(name)')
      .eq('is_closed', true)
      .order('updated_at', { ascending: false })
      .limit(500);
    setOrders(data || []);
  };

  const filtered = orders.filter(o => {
    if (officeFilter !== 'all' && o.office_id !== officeFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      o.tracking_id?.toLowerCase().includes(term) || 
      o.customer_name?.toLowerCase().includes(term) || 
      o.customer_phone?.includes(search) || 
      o.barcode?.includes(search) || 
      o.customer_code?.toLowerCase().includes(term) ||
      o.address?.toLowerCase().includes(term)
    );
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(o => o.id)));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`نقل ${selected.size} أوردر إلى سلة المحذوفات؟`)) return;
    const ids = Array.from(selected);
    moveToTrash(ids);
    toast.success('تم النقل إلى سلة المحذوفات');
    setSelected(new Set());
    loadOrders();
  };

  const reopenSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`إلغاء تقفيل ${selected.size} أوردر؟`)) return;
    const { error } = await supabase.from('orders').update({ is_closed: false }).in('id', Array.from(selected));
    if (error) { toast.error(error.message); return; }
    toast.success('تم إعادة فتح الأوردرات');
    setSelected(new Set());
    loadOrders();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">الأوردرات القديمة (المقفلة)</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 bg-secondary border-border" />
        </div>
        <Select value={officeFilter} onValueChange={setOfficeFilter}>
          <SelectTrigger className="w-[160px] bg-secondary border-border">
            <SelectValue placeholder="كل المكاتب" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المكاتب</SelectItem>
            {offices.map(o => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isOwner && selected.size > 0 && (
          <>
            <Button size="sm" variant="outline" onClick={reopenSelected}><Unlock className="h-4 w-4 ml-1" />إلغاء التقفيل {selected.size}</Button>
            <Button size="sm" variant="destructive" onClick={deleteSelected}><Trash2 className="h-4 w-4 ml-1" />حذف {selected.size}</Button>
          </>
        )}
      </div>
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  {isOwner && <TableHead className="w-10"><Checkbox checked={filtered.length > 0 && selected.size === filtered.length} onCheckedChange={toggleAll} /></TableHead>}
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">المنتج</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                   <TableHead className="text-right hidden md:table-cell">المكتب</TableHead>
                   <TableHead className="text-right hidden sm:table-cell">المندوب</TableHead>
                   <TableHead className="text-right">الحالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={isOwner ? 10 : 9} className="text-center text-muted-foreground py-8">لا توجد أوردرات مقفلة</TableCell></TableRow>
                ) : filtered.map(order => (
                  <TableRow key={order.id} className="border-border">
                    {isOwner && <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>}
                    <TableCell className="text-xs"><div className="text-muted-foreground">{new Date(order.created_at).toLocaleDateString('ar-EG')}</div><div className="font-mono font-bold">{order.barcode || '-'}</div></TableCell>
                    <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                    <TableCell className="text-sm">{order.customer_name}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]">{order.address || '-'}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{order.product_name}</TableCell>
                    <TableCell className="font-bold text-sm">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{order.offices?.name || '-'}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{order.courier_id ? (couriers[order.courier_id] || '-') : '-'}</TableCell>
                    <TableCell>
                      <Badge style={{ backgroundColor: order.order_statuses?.color || undefined }} className="text-xs">
                        {order.order_statuses?.name || '-'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
