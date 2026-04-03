import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Truck, CheckCircle, XCircle, Clock, Search, Phone, User, Navigation2, AlertTriangle, Flame } from 'lucide-react';

const GOVERNORATE_COORDS: Record<string, [number, number]> = {
  'القاهرة': [30.0444, 31.2357], 'الجيزة': [30.0131, 31.2089],
  'الإسكندرية': [31.2001, 29.9187], 'الدقهلية': [31.0409, 31.3785],
  'الشرقية': [30.7327, 31.7195], 'القليوبية': [30.3293, 31.2165],
  'المنوفية': [30.5972, 30.9876], 'الغربية': [30.8754, 31.0297],
  'كفر الشيخ': [31.3085, 30.9404], 'البحيرة': [30.8481, 30.3436],
  'المنيا': [28.1099, 30.7503], 'أسيوط': [27.1783, 31.1859],
  'سوهاج': [26.5591, 31.6948], 'قنا': [26.1551, 32.7160],
  'الأقصر': [25.6872, 32.6396], 'أسوان': [24.0889, 32.8998],
  'الفيوم': [29.3084, 30.8428], 'بني سويف': [29.0661, 31.0994],
  'بورسعيد': [31.2653, 32.3019], 'الإسماعيلية': [30.5965, 32.2715],
  'السويس': [29.9668, 32.5498], 'دمياط': [31.4175, 31.8144],
  'شمال سيناء': [31.1343, 33.7982], 'جنوب سيناء': [28.4927, 33.9176],
  'الوادي الجديد': [25.4409, 30.5464], 'مطروح': [31.3543, 27.2373],
  'البحر الأحمر': [25.6731, 34.1537],
};

interface CourierInfo {
  id: string; name: string; phone: string; coverageAreas: string;
  totalOrders: number; delivered: number; returned: number; pending: number;
  successRate: number; totalCollection: number; orders: any[];
  location?: { lat: number; lng: number; accuracy: number; updated_at: string };
}

export default function CourierTracking() {
  const [couriers, setCouriers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [offices, setOffices] = useState<any[]>([]);
  const [courierLocations, setCourierLocations] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourier, setSelectedCourier] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('tracking');
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const [heatMapContainer, setHeatMapContainer] = useState<HTMLDivElement | null>(null);

  useEffect(() => { loadData(); }, []);

  // Auto-refresh locations every 30s
  useEffect(() => {
    const interval = setInterval(loadLocations, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadLocations = async () => {
    const { data } = await supabase.from('courier_locations' as any).select('*');
    setCourierLocations(data || []);
  };

  const loadData = async () => {
    const [rolesRes, ordersRes, statusRes, officesRes] = await Promise.all([
      supabase.from('user_roles').select('user_id').eq('role', 'courier'),
      supabase.from('orders').select('*').not('courier_id', 'is', null).eq('is_closed', false),
      supabase.from('order_statuses').select('*'),
      supabase.from('offices').select('id, name'),
    ]);

    const courierIds = (rolesRes.data || []).map(r => r.user_id);
    if (courierIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, phone, coverage_areas').in('id', courierIds);
      setCouriers(profiles || []);
    }
    setOrders(ordersRes.data || []);
    setStatuses(statusRes.data || []);
    setOffices(officesRes.data || []);
    await loadLocations();
  };

  const deliveredStatusIds = useMemo(() =>
    statuses.filter(s => s.name === 'تم التسليم' || s.name === 'تسليم جزئي').map(s => s.id), [statuses]);
  const returnedStatusIds = useMemo(() =>
    statuses.filter(s => ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد'].includes(s.name)).map(s => s.id), [statuses]);

  const courierData: CourierInfo[] = useMemo(() => {
    return couriers.map(c => {
      const courierOrders = orders.filter(o => o.courier_id === c.id);
      const delivered = courierOrders.filter(o => deliveredStatusIds.includes(o.status_id));
      const returned = courierOrders.filter(o => returnedStatusIds.includes(o.status_id));
      const pending = courierOrders.length - delivered.length - returned.length;
      const totalCollection = delivered.reduce((s, o) => s + Number(o.price) + Number(o.delivery_price), 0);
      const successRate = courierOrders.length > 0 ? Math.round((delivered.length / courierOrders.length) * 100) : 0;
      const loc = courierLocations.find((l: any) => l.courier_id === c.id);
      return {
        id: c.id, name: c.full_name || 'بدون اسم', phone: c.phone || '-',
        coverageAreas: c.coverage_areas || '', totalOrders: courierOrders.length,
        delivered: delivered.length, returned: returned.length, pending, successRate, totalCollection,
        orders: courierOrders,
        location: loc ? { lat: Number(loc.latitude), lng: Number(loc.longitude), accuracy: Number(loc.accuracy), updated_at: loc.updated_at } : undefined,
      };
    }).sort((a, b) => b.pending - a.pending);
  }, [couriers, orders, deliveredStatusIds, returnedStatusIds, courierLocations]);

  const filteredCouriers = useMemo(() => {
    let data = courierData;
    if (searchTerm) data = data.filter(c => c.name.includes(searchTerm) || c.phone.includes(searchTerm));
    if (selectedCourier !== 'all') data = data.filter(c => c.id === selectedCourier);
    return data;
  }, [courierData, searchTerm, selectedCourier]);

  // Rejection data by governorate for heat map
  const rejectionData = useMemo(() => {
    const govData: Record<string, { total: number; rejected: number; rate: number }> = {};
    orders.forEach(o => {
      const gov = o.governorate || 'غير محدد';
      if (!govData[gov]) govData[gov] = { total: 0, rejected: 0, rate: 0 };
      govData[gov].total++;
      if (returnedStatusIds.includes(o.status_id)) govData[gov].rejected++;
    });
    Object.keys(govData).forEach(gov => {
      govData[gov].rate = govData[gov].total > 0 ? Math.round((govData[gov].rejected / govData[gov].total) * 100) : 0;
    });
    return Object.entries(govData).sort((a, b) => b[1].rate - a[1].rate);
  }, [orders, returnedStatusIds]);

  // Main tracking map with live courier GPS
  useEffect(() => {
    if (!mapContainer) return;
    let map: any;

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      map = L.map(mapContainer).setView([27.5, 30.8], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      // Order distribution markers
      const govCounts: Record<string, { total: number; delivered: number; pending: number; returned: number }> = {};
      const targetOrders = selectedCourier === 'all' ? orders : orders.filter(o => o.courier_id === selectedCourier);
      targetOrders.forEach(o => {
        const gov = o.governorate || 'غير محدد';
        if (!govCounts[gov]) govCounts[gov] = { total: 0, delivered: 0, pending: 0, returned: 0 };
        govCounts[gov].total++;
        if (deliveredStatusIds.includes(o.status_id)) govCounts[gov].delivered++;
        else if (returnedStatusIds.includes(o.status_id)) govCounts[gov].returned++;
        else govCounts[gov].pending++;
      });

      Object.entries(govCounts).forEach(([gov, counts]) => {
        const coords = GOVERNORATE_COORDS[gov];
        if (!coords) return;
        const color = counts.pending > 0 ? '#f59e0b' : counts.delivered > 0 ? '#22c55e' : '#ef4444';
        const radius = Math.max(8, Math.min(25, counts.total * 3));
        L.circleMarker(coords, {
          radius, fillColor: color, color: '#1e293b', weight: 2, opacity: 1, fillOpacity: 0.6,
        }).addTo(map).bindPopup(`
          <div style="text-align:right;font-family:sans-serif;min-width:130px">
            <strong>${gov}</strong><br/>📦 إجمالي: ${counts.total}<br/>✅ تسليم: ${counts.delivered}<br/>⏳ معلق: ${counts.pending}<br/>❌ مرتجع: ${counts.returned}
          </div>`);
      });

      // Live courier GPS markers
      const couriersWithLocation = selectedCourier === 'all'
        ? courierData.filter(c => c.location)
        : courierData.filter(c => c.location && c.id === selectedCourier);

      couriersWithLocation.forEach(c => {
        if (!c.location) return;
        const timeDiff = (Date.now() - new Date(c.location.updated_at).getTime()) / 60000;
        const isRecent = timeDiff < 10;
        const markerColor = isRecent ? '#3b82f6' : '#9ca3af';

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${markerColor};width:36px;height:36px;border-radius:50%;
            border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);
            display:flex;align-items:center;justify-content:center;
            font-size:16px;color:white;font-weight:bold;
          ">${c.name.charAt(0)}</div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });

        L.marker([c.location.lat, c.location.lng], { icon }).addTo(map).bindPopup(`
          <div style="text-align:right;font-family:sans-serif;min-width:150px">
            <strong>🚚 ${c.name}</strong><br/>
            📞 ${c.phone}<br/>
            📦 معلق: ${c.pending} | ✅ تسليم: ${c.delivered}<br/>
            ⏱ آخر تحديث: ${isRecent ? 'الآن' : Math.round(timeDiff) + ' دقيقة'}
            ${!isRecent ? '<br/><span style="color:#ef4444">⚠ غير متصل</span>' : ''}
          </div>`);
      });
    };

    initMap();
    return () => { if (map) map.remove(); };
  }, [mapContainer, orders, courierData, selectedCourier, deliveredStatusIds, returnedStatusIds]);

  // Rejection heat map
  useEffect(() => {
    if (!heatMapContainer) return;
    let map: any;

    const initMap = async () => {
      const L = await import('leaflet');
      await import('leaflet/dist/leaflet.css');

      map = L.map(heatMapContainer).setView([27.5, 30.8], 6);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
      }).addTo(map);

      rejectionData.forEach(([gov, data]) => {
        const coords = GOVERNORATE_COORDS[gov];
        if (!coords || data.total === 0) return;
        const intensity = data.rate / 100;
        const r = Math.round(239 * intensity + 34 * (1 - intensity));
        const g = Math.round(68 * intensity + 197 * (1 - intensity));
        const b = Math.round(68 * intensity + 94 * (1 - intensity));
        const color = `rgb(${r},${g},${b})`;
        const radius = Math.max(10, Math.min(30, data.total * 2));

        L.circleMarker(coords, {
          radius, fillColor: color, color: '#1e293b', weight: 2, opacity: 1, fillOpacity: 0.75,
        }).addTo(map).bindPopup(`
          <div style="text-align:right;font-family:sans-serif;min-width:140px">
            <strong>🔥 ${gov}</strong><br/>
            📦 إجمالي: ${data.total}<br/>
            ❌ مرفوض: ${data.rejected}<br/>
            📊 نسبة الرفض: <strong style="color:${data.rate > 50 ? '#ef4444' : '#f59e0b'}">${data.rate}%</strong>
          </div>`);
      });
    };

    initMap();
    return () => { if (map) map.remove(); };
  }, [heatMapContainer, rejectionData]);

  const totalPending = courierData.reduce((s, c) => s + c.pending, 0);
  const totalDelivered = courierData.reduce((s, c) => s + c.delivered, 0);
  const totalReturned = courierData.reduce((s, c) => s + c.returned, 0);

  const getOfficeName = (id: string) => offices.find(o => o.id === id)?.name || '-';
  const getStatusName = (id: string) => statuses.find(s => s.id === id)?.name || '-';
  const getStatusColor = (id: string) => statuses.find(s => s.id === id)?.color || '#6b7280';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          <Navigation2 className="h-6 w-6 text-primary" />
          تتبع المناديب
        </h1>
        <Badge variant="outline" className="text-xs gap-1">
          <Truck className="h-3 w-3" />
          {courierData.filter(c => c.location && (Date.now() - new Date(c.location.updated_at).getTime()) < 600000).length} متصل الآن
        </Badge>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-full p-2 bg-primary/10"><Truck className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">مناديب نشطين</p><p className="text-xl font-bold">{courierData.filter(c => c.totalOrders > 0).length}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-full p-2 bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xs text-muted-foreground">معلقة</p><p className="text-xl font-bold">{totalPending}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-full p-2 bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
            <div><p className="text-xs text-muted-foreground">تسليم</p><p className="text-xl font-bold">{totalDelivered}</p></div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="rounded-full p-2 bg-destructive/10"><XCircle className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xs text-muted-foreground">مرتجع</p><p className="text-xl font-bold">{totalReturned}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="بحث بالاسم أو الهاتف..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pr-9" />
        </div>
        <Select value={selectedCourier} onValueChange={setSelectedCourier}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="كل المناديب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المناديب</SelectItem>
            {courierData.map(c => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} {c.location ? '🟢' : '⚪'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="tracking">📍 تتبع مباشر</TabsTrigger>
          <TabsTrigger value="heatmap">🔥 خريطة الرفض</TabsTrigger>
          <TabsTrigger value="details">📋 التفاصيل</TabsTrigger>
        </TabsList>

        <TabsContent value="tracking" className="space-y-4">
          {/* Live map */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                خريطة التتبع المباشر
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div ref={el => setMapContainer(el)} className="h-[400px] sm:h-[450px] rounded-lg overflow-hidden border border-border" style={{ direction: 'ltr' }} />
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center flex-wrap">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#3b82f6] inline-block" /> مندوب متصل</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#9ca3af] inline-block" /> مندوب غير متصل</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" /> أوردرات معلقة</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" /> تم التسليم</span>
              </div>
            </CardContent>
          </Card>

          {/* Courier cards */}
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCouriers.map(c => {
              const isOnline = c.location && (Date.now() - new Date(c.location.updated_at).getTime()) < 600000;
              return (
                <Card key={c.id} className={`bg-card border-border hover:border-primary/30 transition-colors ${isOnline ? 'ring-1 ring-primary/20' : ''}`}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-full p-2 ${isOnline ? 'bg-primary/10' : 'bg-muted'}`}>
                          <User className={`h-4 w-4 ${isOnline ? 'text-primary' : 'text-muted-foreground'}`} />
                        </div>
                        <div>
                          <p className="font-bold text-sm flex items-center gap-1">
                            {c.name}
                            {isOnline ? <span className="w-2 h-2 rounded-full bg-success inline-block" /> : <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1" dir="ltr">
                            <Phone className="h-3 w-3" /> {c.phone}
                          </p>
                        </div>
                      </div>
                      <Badge variant={c.successRate >= 70 ? 'default' : c.successRate >= 40 ? 'secondary' : 'destructive'} className="text-xs">
                        {c.successRate}%
                      </Badge>
                    </div>

                    {c.location && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        آخر موقع: {isOnline ? 'الآن' : Math.round((Date.now() - new Date(c.location.updated_at).getTime()) / 60000) + ' دقيقة'}
                      </p>
                    )}
                    {!c.location && (
                      <p className="text-xs text-destructive flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> لم يفعّل الموقع
                      </p>
                    )}

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>التقدم ({c.delivered + c.returned}/{c.totalOrders})</span>
                        <span>{c.totalOrders > 0 ? Math.round(((c.delivered + c.returned) / c.totalOrders) * 100) : 0}%</span>
                      </div>
                      <Progress value={c.totalOrders > 0 ? ((c.delivered + c.returned) / c.totalOrders) * 100 : 0} className="h-2" />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="bg-warning/10 rounded p-1.5"><p className="font-bold text-warning">{c.pending}</p><p className="text-muted-foreground">معلق</p></div>
                      <div className="bg-success/10 rounded p-1.5"><p className="font-bold text-success">{c.delivered}</p><p className="text-muted-foreground">تسليم</p></div>
                      <div className="bg-destructive/10 rounded p-1.5"><p className="font-bold text-destructive">{c.returned}</p><p className="text-muted-foreground">مرتجع</p></div>
                    </div>

                    <p className="text-xs font-bold text-primary text-center">التحصيل: {c.totalCollection.toLocaleString()} ج.م</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="heatmap" className="space-y-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Flame className="h-4 w-4 text-destructive" />
                خريطة المناطق الأكثر رفضاً
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div ref={el => setHeatMapContainer(el)} className="h-[400px] sm:h-[450px] rounded-lg overflow-hidden border border-border" style={{ direction: 'ltr' }} />
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground justify-center">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#22c55e] inline-block" /> نسبة رفض منخفضة</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#f59e0b] inline-block" /> نسبة رفض متوسطة</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-[#ef4444] inline-block" /> نسبة رفض عالية</span>
              </div>
            </CardContent>
          </Card>

          {/* Rejection table */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ترتيب المناطق حسب نسبة الرفض</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-right">#</TableHead>
                      <TableHead className="text-right">المحافظة</TableHead>
                      <TableHead className="text-center">إجمالي</TableHead>
                      <TableHead className="text-center">مرفوض</TableHead>
                      <TableHead className="text-center">نسبة الرفض</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rejectionData.map(([gov, data], i) => (
                      <TableRow key={gov} className="border-border">
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="font-medium">{gov}</TableCell>
                        <TableCell className="text-center">{data.total}</TableCell>
                        <TableCell className="text-center text-destructive font-bold">{data.rejected}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={data.rate > 50 ? 'destructive' : data.rate > 25 ? 'secondary' : 'default'} className="text-xs">
                            {data.rate}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          {selectedCourier !== 'all' && filteredCouriers.length > 0 ? (
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">أوردرات {filteredCouriers[0]?.name}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-right">الباركود</TableHead>
                        <TableHead className="text-right">العميل</TableHead>
                        <TableHead className="text-right">الهاتف</TableHead>
                        <TableHead className="text-right">المحافظة</TableHead>
                        <TableHead className="text-right">المكتب</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCouriers[0]?.orders.map((o: any) => (
                        <TableRow key={o.id} className="border-border">
                          <TableCell className="font-mono text-xs">{o.barcode || o.tracking_id}</TableCell>
                          <TableCell>{o.customer_name}</TableCell>
                          <TableCell dir="ltr" className="text-xs">{o.customer_phone}</TableCell>
                          <TableCell>{o.governorate || '-'}</TableCell>
                          <TableCell>{getOfficeName(o.office_id)}</TableCell>
                          <TableCell className="text-center">
                            <Badge className="text-xs text-white" style={{ backgroundColor: getStatusColor(o.status_id) }}>
                              {getStatusName(o.status_id)}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">{Number(o.price).toLocaleString()} ج.م</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>اختر مندوب من القائمة لعرض تفاصيل أوردراته</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
