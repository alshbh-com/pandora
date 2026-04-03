import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Phone, ExternalLink, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function CustomersPage() {
  const [offices, setOffices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [officesRes, ordersRes, statusRes] = await Promise.all([
      supabase.from('offices').select('*').order('name'),
      supabase.from('orders').select('id, office_id, status_id, price, delivery_price'),
      supabase.from('order_statuses').select('*'),
    ]);
    setOffices(officesRes.data || []);
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
  };

  const filtered = offices.filter(o => !search || o.name?.includes(search));

  const getOfficeStats = (officeId: string) => {
    const officeOrders = orders.filter(o => o.office_id === officeId);
    const statusCounts: Record<string, number> = {};
    officeOrders.forEach(o => {
      const st = statuses.find(s => s.id === o.status_id);
      const name = st?.name || 'بدون حالة';
      statusCounts[name] = (statusCounts[name] || 0) + 1;
    });
    return { total: officeOrders.length, statusCounts };
  };

  const selectedStats = selectedOffice ? getOfficeStats(selectedOffice) : null;
  const selectedOfficeData = selectedOffice ? offices.find(o => o.id === selectedOffice) : null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">العملاء (المكاتب)</h1>

      <div className="relative max-w-lg">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="بحث بالاسم..." value={search} onChange={e => setSearch(e.target.value)} className="pr-9 bg-secondary border-border" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right">المكتب</TableHead>
                      <TableHead className="text-right">المالك</TableHead>
                      <TableHead className="text-right">الهاتف</TableHead>
                      <TableHead className="text-center">الأوردرات</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد مكاتب</TableCell></TableRow>
                    ) : filtered.map(o => {
                      const stats = getOfficeStats(o.id);
                      return (
                        <TableRow key={o.id} className={`border-border cursor-pointer hover:bg-secondary/50 ${selectedOffice === o.id ? 'bg-secondary' : ''}`} onClick={() => setSelectedOffice(o.id)}>
                          <TableCell className="font-medium">{o.name}</TableCell>
                          <TableCell>{o.owner_name || '-'}</TableCell>
                          <TableCell dir="ltr">{o.owner_phone || '-'}</TableCell>
                          <TableCell className="text-center font-bold">{stats.total}</TableCell>
                          <TableCell>
                            <div className="flex gap-1 justify-center">
                              {o.owner_phone && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); window.open(`tel:${o.owner_phone}`); }}>
                                    <Phone className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${o.owner_phone.replace(/^0/, '20')}`); }}>
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
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

        <div>
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Package className="h-4 w-4" />تفاصيل المكتب</h3>
              {!selectedOffice ? (
                <p className="text-sm text-muted-foreground">اختر مكتب لعرض تفاصيله</p>
              ) : (
                <div className="space-y-3">
                  <p className="font-bold text-lg">{selectedOfficeData?.name}</p>
                  <p className="text-sm text-muted-foreground">إجمالي الأوردرات: <strong>{selectedStats?.total}</strong></p>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">توزيع الحالات:</p>
                    {selectedStats && Object.entries(selectedStats.statusCounts).map(([name, count]) => {
                      const st = statuses.find(s => s.name === name);
                      return (
                        <div key={name} className="flex justify-between items-center text-sm">
                          <Badge style={{ backgroundColor: st?.color ? st.color + '30' : undefined, color: st?.color }} className="text-xs">{name}</Badge>
                          <span className="font-bold">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
