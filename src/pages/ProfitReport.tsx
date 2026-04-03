import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calculator, DollarSign } from 'lucide-react';

export default function ProfitReport() {
  const [orders, setOrders] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [period, setPeriod] = useState('30');

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));
    const [ordersRes, officesRes, statusRes] = await Promise.all([
      supabase.from('orders').select('*').gte('created_at', daysAgo.toISOString()),
      supabase.from('offices').select('*'),
      supabase.from('order_statuses').select('*'),
    ]);
    setOrders(ordersRes.data || []);
    setOffices(officesRes.data || []);
    setStatuses(statusRes.data || []);
  };

  const deliveredStatusIds = statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
  const returnedStatusIds = statuses.filter(s => ['مرتجع', 'رفض ولم يدفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id);
  const rejectPaidShipId = statuses.find(s => s.name === 'رفض ودفع شحن')?.id;
  const halfShipId = statuses.find(s => s.name === 'استلم ودفع نص الشحن')?.id;

  const deliveredOrders = orders.filter(o => deliveredStatusIds.includes(o.status_id));
  const rejectedOrders = orders.filter(o => returnedStatusIds.includes(o.status_id));
  const rejectPaidOrders = orders.filter(o => o.status_id === rejectPaidShipId || o.status_id === halfShipId);

  const totalDelivered = deliveredOrders.length;
  const totalRejected = rejectedOrders.length;
  const totalRejectPaid = rejectPaidOrders.length;

  // Shipping from deliveries
  const deliveredShipping = deliveredOrders.reduce((s, o) => s + Number(o.delivery_price), 0);
  // Shipping from reject+paid
  const rejectPaidShipping = rejectPaidOrders.reduce((s, o) => s + Number(o.shipping_paid || 0), 0);
  const totalShippingRevenue = deliveredShipping + rejectPaidShipping;

  // Average per order = 20 EGP
  const avgPerOrder = 20;
  const netProfit = (totalDelivered + totalRejectPaid) * avgPerOrder;

  // Per-office profit
  const officeProfit = offices.map(o => {
    const offDelivered = deliveredOrders.filter(ord => ord.office_id === o.id);
    const offRejectPaid = rejectPaidOrders.filter(ord => ord.office_id === o.id);
    const shipping = offDelivered.reduce((s, ord) => s + Number(ord.delivery_price), 0) + offRejectPaid.reduce((s, ord) => s + Number(ord.shipping_paid || 0), 0);
    return {
      name: o.name,
      shipping,
      orders: offDelivered.length + offRejectPaid.length,
    };
  }).filter(o => o.orders > 0).sort((a, b) => b.shipping - a.shipping);

  const chartData = officeProfit.slice(0, 8).map(o => ({
    name: o.name.length > 10 ? o.name.slice(0, 10) + '..' : o.name,
    شحن: o.shipping,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">تقرير الأرباح</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="30">آخر 30 يوم</SelectItem>
            <SelectItem value="60">آخر 60 يوم</SelectItem>
            <SelectItem value="90">آخر 90 يوم</SelectItem>
            <SelectItem value="365">آخر سنة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-success/20"><TrendingUp className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">تسليمات</p><p className="text-lg font-bold">{totalDelivered}</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-destructive/20"><Calculator className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">مرفوض</p><p className="text-lg font-bold">{totalRejected}</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-warning/20"><DollarSign className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">رفض ودفع شحن</p><p className="text-lg font-bold">{totalRejectPaid}</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-primary/20"><TrendingUp className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">صافي الربح (متوسط {avgPerOrder} ج/أوردر)</p><p className={`text-lg font-bold ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>{netProfit.toLocaleString()} ج.م</p></div>
          </div>
        </CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">إيراد الشحن حسب المكتب</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                <Legend />
                <Bar dataKey="شحن" fill="hsl(38,92%,50%)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-center">الأوردرات</TableHead>
                  <TableHead className="text-right">الشحن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officeProfit.map(o => (
                  <TableRow key={o.name} className="border-border">
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="text-center">{o.orders}</TableCell>
                    <TableCell className="font-bold">{o.shipping.toLocaleString()} ج.م</TableCell>
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
