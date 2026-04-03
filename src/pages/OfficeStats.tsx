import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(217,91%,60%)', 'hsl(142,76%,36%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(270,60%,60%)', 'hsl(200,70%,50%)', 'hsl(160,60%,45%)', 'hsl(340,65%,47%)'];

export default function OfficeStats() {
  const [offices, setOffices] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [officesRes, ordersRes, statusRes] = await Promise.all([
      supabase.from('offices').select('*'),
      supabase.from('orders').select('*'),
      supabase.from('order_statuses').select('*'),
    ]);
    setOffices(officesRes.data || []);
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
  };

  const deliveredStatusIds = statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
  const rejectPaidShipId = statuses.find(s => s.name === 'رفض ودفع شحن')?.id;
  const halfShipId = statuses.find(s => s.name === 'استلم ودفع نص الشحن')?.id;

  const officeData = offices.map(o => {
    const officeOrders = orders.filter(ord => ord.office_id === o.id);
    const delivered = officeOrders.filter(ord => deliveredStatusIds.includes(ord.status_id));
    // Revenue = shipping from deliveries + shipping_paid from reject+paid
    const shippingRevenue = officeOrders.reduce((s, ord) => {
      if (deliveredStatusIds.includes(ord.status_id)) return s + Number(ord.delivery_price);
      if (ord.status_id === rejectPaidShipId || ord.status_id === halfShipId) return s + Number(ord.shipping_paid || 0);
      return s;
    }, 0);

    return {
      id: o.id,
      name: o.name,
      owner: o.owner_name || '-',
      totalOrders: officeOrders.length,
      delivered: delivered.length,
      shippingRevenue,
      successRate: officeOrders.length > 0 ? Math.round((delivered.length / officeOrders.length) * 100) : 0,
    };
  }).sort((a, b) => b.totalOrders - a.totalOrders);

  const pieData = officeData.slice(0, 8).map(o => ({ name: o.name, value: o.totalOrders }));
  const barData = officeData.slice(0, 10).map(o => ({
    name: o.name.length > 12 ? o.name.slice(0, 12) + '..' : o.name,
    أوردرات: o.totalOrders,
    تسليم: o.delivered,
  }));

  const totalAllOrders = officeData.reduce((s, o) => s + o.totalOrders, 0);
  const totalAllShipping = officeData.reduce((s, o) => s + o.shippingRevenue, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">إحصائيات المكاتب</h1>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">عدد المكاتب</p>
          <p className="text-2xl font-bold text-primary">{offices.length}</p>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">إجمالي الأوردرات</p>
          <p className="text-2xl font-bold">{totalAllOrders}</p>
        </CardContent></Card>
        <Card className="bg-card border-border col-span-2 lg:col-span-1"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">إجمالي إيرادات الشحن</p>
          <p className="text-2xl font-bold text-success">{totalAllShipping.toLocaleString()} ج.م</p>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">حصة كل مكتب</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">الأوردرات vs التسليم</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,60%)' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                  <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                  <Bar dataKey="أوردرات" fill="hsl(217,91%,60%)" />
                  <Bar dataKey="تسليم" fill="hsl(142,76%,36%)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">المالك</TableHead>
                  <TableHead className="text-center">الأوردرات</TableHead>
                  <TableHead className="text-center">تسليم</TableHead>
                  <TableHead className="text-center">النجاح</TableHead>
                  <TableHead className="text-right">إيراد الشحن</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {officeData.map((o, i) => (
                  <TableRow key={o.id} className="border-border">
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{o.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{o.owner}</TableCell>
                    <TableCell className="text-center">{o.totalOrders}</TableCell>
                    <TableCell className="text-center text-success font-bold">{o.delivered}</TableCell>
                    <TableCell className="text-center">{o.successRate}%</TableCell>
                    <TableCell className="font-bold">{o.shippingRevenue.toLocaleString()} ج.م</TableCell>
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
