import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { TrendingUp, DollarSign, Package, Truck } from 'lucide-react';

const COLORS = ['hsl(217,91%,60%)', 'hsl(142,76%,36%)', 'hsl(38,92%,50%)', 'hsl(0,72%,51%)', 'hsl(270,60%,60%)', 'hsl(200,70%,50%)'];

export default function FinancialReports() {
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [period, setPeriod] = useState('30');

  useEffect(() => { loadData(); }, [period]);

  const loadData = async () => {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - Number(period));
    const [ordersRes, statusesRes] = await Promise.all([
      supabase.from('orders').select('*, offices(name)').gte('created_at', daysAgo.toISOString()).order('created_at', { ascending: true }),
      supabase.from('order_statuses').select('*').order('sort_order'),
    ]);
    setOrders(ordersRes.data || []);
    setStatuses(statusesRes.data || []);
  };

  const deliveredStatusIds = statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id);
  const rejectPaidShipId = statuses.find(s => s.name === 'رفض ودفع شحن')?.id;
  const halfShipId = statuses.find(s => s.name === 'استلم ودفع نص الشحن')?.id;

  // Shipping revenue = deliveries shipping + reject paid shipping
  const totalShipping = orders.reduce((s, o) => {
    if (deliveredStatusIds.includes(o.status_id)) return s + Number(o.delivery_price);
    if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) return s + Number(o.shipping_paid || 0);
    return s;
  }, 0);
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + Number(o.price), 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Daily chart
  const dailyMap = new Map<string, { date: string; shipping: number; count: number }>();
  orders.forEach(o => {
    const day = new Date(o.created_at).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });
    const existing = dailyMap.get(day) || { date: day, shipping: 0, count: 0 };
    if (deliveredStatusIds.includes(o.status_id)) existing.shipping += Number(o.delivery_price);
    else if (o.status_id === rejectPaidShipId || o.status_id === halfShipId) existing.shipping += Number(o.shipping_paid || 0);
    existing.count++;
    dailyMap.set(day, existing);
  });
  const dailyData = Array.from(dailyMap.values());

  const statusCounts = statuses.map(s => ({
    name: s.name,
    value: orders.filter(o => o.status_id === s.id).length,
    color: s.color || '#6b7280',
  })).filter(s => s.value > 0);

  const officeMap = new Map<string, number>();
  orders.forEach(o => {
    const name = o.offices?.name || 'بدون مكتب';
    officeMap.set(name, (officeMap.get(name) || 0) + 1);
  });
  const topOffices = Array.from(officeMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">التقارير المالية</h1>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px] bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">آخر 7 أيام</SelectItem>
            <SelectItem value="14">آخر 14 يوم</SelectItem>
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
            <div className="rounded-lg p-2 bg-primary/20"><Package className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الأوردرات</p><p className="text-xl font-bold">{totalOrders}</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-success/20"><DollarSign className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الإيرادات</p><p className="text-xl font-bold">{totalRevenue.toLocaleString()} ج.م</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-warning/20"><Truck className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">إجمالي الشحن</p><p className="text-xl font-bold">{totalShipping.toLocaleString()} ج.م</p></div>
          </div>
        </CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2 bg-destructive/20"><TrendingUp className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">متوسط قيمة الأوردر</p><p className="text-xl font-bold">{avgOrderValue.toLocaleString()} ج.م</p></div>
          </div>
        </CardContent></Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">إيراد الشحن اليومي</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff', fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="shipping" name="الشحن" stroke="hsl(38,92%,50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">توزيع الحالات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusCounts} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                    {statusCounts.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2"><CardTitle className="text-base">أعلى المكاتب طلبات</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topOffices} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} width={80} />
                  <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                  <Bar dataKey="count" fill="hsl(142,76%,36%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-base">عدد الأوردرات يومياً</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,16%,20%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,60%)' }} />
                <Tooltip contentStyle={{ background: 'hsl(220,20%,13%)', border: '1px solid hsl(220,16%,20%)', borderRadius: 8, color: '#fff' }} />
                <Bar dataKey="count" name="الأوردرات" fill="hsl(217,91%,60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
