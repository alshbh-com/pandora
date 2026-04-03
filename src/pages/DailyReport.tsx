import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Printer, Package, Truck, Undo2, Calendar } from 'lucide-react';

export default function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [date]);

  const loadData = async () => {
    const startOfDay = `${date}T00:00:00`;
    const endOfDay = `${date}T23:59:59`;
    const [ordersRes, statusRes] = await Promise.all([
      supabase.from('orders').select('*, offices(name)').gte('created_at', startOfDay).lte('created_at', endOfDay).order('created_at', { ascending: false }),
      supabase.from('order_statuses').select('*'),
    ]);
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
  };

  const getStatus = (id: string) => statuses.find(s => s.id === id);

  const deliveredStatusIds = statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
  const returnedStatusIds = statuses.filter(s => ['مرتجع', 'رفض ودفع شحن', 'رفض ولم يدفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);
  const rejectPaidShipId = statuses.find(s => s.name === 'رفض ودفع شحن')?.id;
  const halfShipId = statuses.find(s => s.name === 'استلم ودفع نص الشحن')?.id;

  const totalOrders = orders.length;
  const delivered = orders.filter(o => deliveredStatusIds.includes(o.status_id)).length;
  const returned = orders.filter(o => returnedStatusIds.includes(o.status_id)).length;
  
  // Shipping revenue = delivery shipping + reject paid shipping + half ship paid
  const totalShipping = orders.reduce((s, o) => {
    if (deliveredStatusIds.includes(o.status_id)) return s + Number(o.delivery_price);
    if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return s + Number(o.shipping_paid || 0);
    return s;
  }, 0);

  const printReport = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const rows = orders.map((o, i) => {
      const st = getStatus(o.status_id);
      return `<tr>
        <td>${i + 1}</td><td>${o.barcode || '-'}</td><td>${o.customer_name}</td>
        <td>${o.offices?.name || '-'}</td><td>${o.address || '-'}</td><td>${st?.name || '-'}</td>
        <td>${Number(o.delivery_price)} ج.م</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><style>
      @page{size:A4;margin:10mm} body{font-family:'Segoe UI',sans-serif;font-size:12px}
      .header{text-align:center;font-size:22px;font-weight:bold;margin-bottom:5px}
      .sub{text-align:center;color:#666;margin-bottom:15px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #333;padding:6px 8px;text-align:right;font-size:11px}
      th{background:#f0f0f0} .summary{margin-top:15px;font-size:14px;font-weight:bold;text-align:center;border:2px solid #000;padding:10px}
    </style></head><body>
      <div class="header">The Pilito - التقرير اليومي</div>
      <div class="sub">${new Date(date).toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} | عدد الأوردرات: ${totalOrders}</div>
      <table><thead><tr><th>#</th><th>الباركود</th><th>العميل</th><th>المكتب</th><th>العنوان</th><th>الحالة</th><th>الشحن</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="summary">تسليم: ${delivered} | مرتجع: ${returned} | إيراد الشحن: ${totalShipping.toLocaleString()} ج.م</div>
    </body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">التقرير اليومي</h1>
        <div className="flex gap-2 items-center">
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-secondary border-border w-[160px]" />
          <Button size="sm" variant="outline" onClick={printReport}><Printer className="h-4 w-4 ml-1" />طباعة</Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-xs text-muted-foreground">إجمالي الأوردرات</p>
          <p className="text-xl font-bold">{totalOrders}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Package className="h-5 w-5 mx-auto mb-1 text-success" />
          <p className="text-xs text-muted-foreground">تسليم</p>
          <p className="text-xl font-bold text-success">{delivered}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Undo2 className="h-5 w-5 mx-auto mb-1 text-destructive" />
          <p className="text-xs text-muted-foreground">مرتجع</p>
          <p className="text-xl font-bold text-destructive">{returned}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-3 text-center">
          <Truck className="h-5 w-5 mx-auto mb-1 text-warning" />
          <p className="text-xs text-muted-foreground">إيراد الشحن</p>
          <p className="text-xl font-bold">{totalShipping.toLocaleString()}</p>
        </CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">المكتب</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد أوردرات في هذا اليوم</TableCell></TableRow>
                ) : orders.map((o, i) => {
                  const st = getStatus(o.status_id);
                  return (
                    <TableRow key={o.id} className="border-border">
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                      <TableCell className="text-sm">{o.customer_name}</TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">{o.offices?.name || '-'}</TableCell>
                      <TableCell className="text-sm truncate max-w-[120px]">{o.address || '-'}</TableCell>
                      <TableCell className="text-center">
                        {st ? <Badge style={{ backgroundColor: st.color + '30', color: st.color }} className="text-xs">{st.name}</Badge> : '-'}
                      </TableCell>
                      <TableCell className="text-sm">{Number(o.delivery_price)} ج.م</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {orders.length > 0 && (
        <div className="flex justify-end">
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="p-3">
              <span className="font-bold text-primary">إيراد الشحن: {totalShipping.toLocaleString()} ج.م</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
