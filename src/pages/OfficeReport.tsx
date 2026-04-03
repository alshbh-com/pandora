import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export default function OfficeReport() {
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
  }, []);

  useEffect(() => {
    if (selectedOffice) loadOrders();
    else setOrders([]);
  }, [selectedOffice, dateFrom, dateTo]);

  const loadOrders = async () => {
    setLoading(true);
    let query = supabase
      .from('orders')
      .select('*, order_statuses(name, color)')
      .eq('office_id', selectedOffice)
      .order('created_at', { ascending: false });

    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);

    const { data } = await query.limit(1000);
    setOrders(data || []);
    setLoading(false);
  };

  // Stats
  const delivered = orders.filter(o => o.order_statuses?.name === 'تم التسليم');
  const returned = orders.filter(o => ['مرتجع', 'رفض ولم يدفع شحن', 'رفض ودفع شحن'].includes(o.order_statuses?.name || ''));
  const pending = orders.filter(o => ['مؤجل', 'قيد التوصيل', 'بدون حالة'].includes(o.order_statuses?.name || ''));
  const partial = orders.filter(o => o.order_statuses?.name === 'تسليم جزئي');

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">تقرير المكاتب</h1>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">المكتب</Label>
          <Select value={selectedOffice} onValueChange={setSelectedOffice}>
            <SelectTrigger className="w-52 bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
            <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">من تاريخ</Label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40 bg-secondary border-border" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">إلى تاريخ</Label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40 bg-secondary border-border" />
        </div>
        {(dateFrom || dateTo) && (
          <button className="text-xs text-muted-foreground underline" onClick={() => { setDateFrom(''); setDateTo(''); }}>الكل</button>
        )}
      </div>

      {selectedOffice && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">إجمالي</p><p className="text-lg font-bold">{orders.length}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">تم التسليم</p><p className="text-lg font-bold text-emerald-500">{delivered.length}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">مرتجع</p><p className="text-lg font-bold text-destructive">{returned.length}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">معلق</p><p className="text-lg font-bold text-amber-500">{pending.length}</p></CardContent></Card>
            <Card className="bg-card border-border"><CardContent className="p-3 text-center"><p className="text-xs text-muted-foreground">تسليم جزئي</p><p className="text-lg font-bold text-blue-500">{partial.length}</p></CardContent></Card>
          </div>

          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">الاسم</TableHead>
                      <TableHead className="text-right">الكود</TableHead>
                      <TableHead className="text-right">السعر</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">التاريخ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">جاري التحميل...</TableCell></TableRow>
                    ) : orders.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                    ) : orders.map((o, idx) => (
                      <TableRow key={o.id} className="border-border">
                        <TableCell className="text-sm">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{o.customer_name}</TableCell>
                        <TableCell className="font-mono text-xs">{o.customer_code || o.barcode || '-'}</TableCell>
                        <TableCell className="text-sm font-bold">{o.price} ج.م</TableCell>
                        <TableCell>
                          <Badge style={{ backgroundColor: o.order_statuses?.color }} className="text-xs">
                            {o.order_statuses?.name || '-'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString('ar-EG')}</TableCell>
                      </TableRow>
                    ))}
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