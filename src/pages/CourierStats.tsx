import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, Medal, Award } from 'lucide-react';

export default function CourierStats() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const [rolesRes, ordersRes, statusRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
      supabase.from('orders').select('*').not('courier_id', 'is', null),
      supabase.from('order_statuses').select('*'),
    ]);

    const courierIds = (rolesRes.data || []).map(r => r.user_id);
    if (courierIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone').in('id', courierIds);
      setCouriers(profiles || []);
    } else {
      setCouriers([]);
    }

    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
  };

  const deliveredStatusIds = statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
  const returnedStatusIds = statuses.filter(s => 
    ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)
  ).map(s => s.id);

  const courierData = couriers.map(c => {
    const courierOrders = orders.filter(o => o.courier_id === c.id);
    const delivered = courierOrders.filter(o => deliveredStatusIds.includes(o.status_id));
    const returned = courierOrders.filter(o => returnedStatusIds.includes(o.status_id));
    const totalCollection = delivered.reduce((s, o) => s + Number(o.price) + Number(o.delivery_price), 0);
    const successRate = courierOrders.length > 0 ? Math.round((delivered.length / courierOrders.length) * 100) : 0;

    return {
      id: c.id,
      name: c.full_name || 'بدون اسم',
      phone: c.phone || '-',
      totalOrders: courierOrders.length,
      delivered: delivered.length,
      returned: returned.length,
      pending: courierOrders.length - delivered.length - returned.length,
      totalCollection,
      successRate,
    };
  }).sort((a, b) => b.delivered - a.delivered);

  const chartData = courierData.slice(0, 10).map(c => ({
    name: c.name.length > 10 ? c.name.slice(0, 10) + '..' : c.name,
    تسليم: c.delivered,
    مرتجع: c.returned,
    معلق: c.pending,
  }));

  const topThree = courierData.slice(0, 3);
  const medals = [
    { icon: Trophy, color: 'hsl(38,92%,50%)' },
    { icon: Medal, color: 'hsl(215,20%,60%)' },
    { icon: Award, color: 'hsl(25,60%,45%)' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">إحصائيات المناديب</h1>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {topThree.map((c, i) => {
          const M = medals[i];
          return (
            <Card key={c.id} className="bg-card border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-full p-2" style={{ backgroundColor: M.color + '20' }}>
                  <M.icon className="h-6 w-6" style={{ color: M.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.delivered} تسليم | نسبة النجاح {c.successRate}%</p>
                  <p className="text-sm font-bold text-primary">{c.totalCollection.toLocaleString()} ج.م</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">مقارنة أداء المناديب</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                <Bar dataKey="تسليم" fill="hsl(142,76%,36%)" stackId="a" />
                <Bar dataKey="مرتجع" fill="hsl(0,72%,51%)" stackId="a" />
                <Bar dataKey="معلق" fill="hsl(38,92%,50%)" stackId="a" />
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
                  <TableHead className="text-right">#</TableHead>
                  <TableHead className="text-right">المندوب</TableHead>
                  <TableHead className="text-right">الهاتف</TableHead>
                  <TableHead className="text-center">الإجمالي</TableHead>
                  <TableHead className="text-center">تسليم</TableHead>
                  <TableHead className="text-center">مرتجع</TableHead>
                  <TableHead className="text-center">معلق</TableHead>
                  <TableHead className="text-center">نسبة النجاح</TableHead>
                  <TableHead className="text-right">التحصيل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierData.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : courierData.map((c, i) => (
                  <TableRow key={c.id} className="border-border">
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell dir="ltr" className="text-sm">{c.phone}</TableCell>
                    <TableCell className="text-center">{c.totalOrders}</TableCell>
                    <TableCell className="text-center text-success font-bold">{c.delivered}</TableCell>
                    <TableCell className="text-center text-destructive font-bold">{c.returned}</TableCell>
                    <TableCell className="text-center text-warning font-bold">{c.pending}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.successRate >= 70 ? 'default' : 'destructive'} className="text-xs">
                        {c.successRate}%
                      </Badge>
                    </TableCell>
                    <TableCell className="font-bold">{c.totalCollection.toLocaleString()} ج.م</TableCell>
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
