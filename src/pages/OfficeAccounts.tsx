import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Pencil, Trash2, Download, Printer, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

// Status filter names we care about
const FILTER_STATUS_NAMES = [
  'تم التسليم',
  'رفض ولم يدفع شحن',
  'رفض ودفع شحن',
  'تسليم جزئي',
  'الشحن على الراسل',
];

export default function OfficeAccounts() {
  const { isOwner } = useAuth();
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedOffice, setSelectedOffice] = useState('all');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [period, setPeriod] = useState('all');
  const [payments, setPayments] = useState<any[]>([]);
  const [officeOrders, setOfficeOrders] = useState<any[]>([]);

  // Status filters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);

  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [advanceOffice, setAdvanceOffice] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceNotes, setAdvanceNotes] = useState('');
  const [advanceType, setAdvanceType] = useState('advance');

  const [editItem, setEditItem] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    supabase.from('offices').select('id, name').order('name').then(({ data }) => setOffices(data || []));
    supabase.from('order_statuses').select('*').order('sort_order').then(({ data }) => setStatuses(data || []));
  }, []);

  useEffect(() => { loadAccounts(); }, [selectedOffice, period, offices, statuses]);

  useEffect(() => {
    if (selectedOffice !== 'all') loadOfficeOrders();
    else setOfficeOrders([]);
  }, [selectedOffice]);

  const loadOfficeOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('id, barcode, status_id, partial_amount, price, delivery_price, is_settled, customer_code, customer_name')
      .eq('office_id', selectedOffice)
      .eq('is_closed', false)
      .order('created_at', { ascending: false });
    setOfficeOrders(data || []);
  };

  const toggleSettled = async (orderId: string, settled: boolean) => {
    await supabase.from('orders').update({ is_settled: settled } as any).eq('id', orderId);
    setOfficeOrders(prev => prev.map(o => o.id === orderId ? { ...o, is_settled: settled } : o));
    toast.success(settled ? 'تم تحديد كخالص' : 'تم إلغاء التحديد');
  };

  const getDateFilter = () => {
    const now = new Date();
    if (period === 'daily') return now.toISOString().split('T')[0];
    if (period === 'monthly') return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    if (period === 'yearly') return new Date(now.getFullYear(), 0, 1).toISOString();
    return null;
  };

  const loadPayments = async () => {
    const { data } = await supabase.from('office_payments').select('*').order('created_at', { ascending: false });
    setPayments(data || []);
  };

  const loadAccounts = async () => {
    if (offices.length === 0 || statuses.length === 0) return;
    await loadPayments();

    const officeList = selectedOffice === 'all' ? offices : offices.filter(o => o.id === selectedOffice);
    const dateFilter = getDateFilter();

    const deliveredStatus = statuses.find(s => s.name === 'تم التسليم');
    const postponedStatus = statuses.find(s => s.name === 'مؤجل');
    const partialStatus = statuses.find(s => s.name === 'تسليم جزئي');
    const returnStatusIds = statuses
      .filter(s => ['رفض ولم يدفع شحن', 'رفض ودفع شحن', 'تهرب', 'ملغي', 'لم يرد', 'لايرد'].includes(s.name))
      .map(s => s.id);

    const { data: allPayments } = await supabase.from('office_payments').select('*');

    const result = await Promise.all(officeList.map(async (office) => {
      let query = supabase
        .from('orders')
        .select('price, delivery_price, status_id, partial_amount')
        .eq('office_id', office.id)
        .eq('is_closed', false);

      if (dateFilter) query = query.gte('created_at', dateFilter);
      const { data: orders } = await query;
      if (!orders) return null;

      const officePayments = (allPayments || []).filter(p => p.office_id === office.id);
      const advancePaid = officePayments.filter(p => p.type === 'advance').reduce((sum, p) => sum + Number(p.amount), 0);
      const commission = officePayments.filter(p => p.type === 'commission').reduce((sum, p) => sum + Number(p.amount), 0);
      const shippingDiscount = officePayments.filter(p => p.type === 'shipping_discount').reduce((sum, p) => sum + Number(p.amount), 0);
      const partialManual = officePayments.filter(p => p.type === 'partial_delivery').reduce((sum, p) => sum + Number(p.amount), 0);

      const deliveredTotal = orders.filter(o => o.status_id === deliveredStatus?.id).reduce((sum, o) => sum + Number(o.price), 0);
      const returnedTotal = orders.filter(o => returnStatusIds.includes(o.status_id)).reduce((sum, o) => sum + Number(o.price), 0);
      const postponedTotal = orders.filter(o => o.status_id === postponedStatus?.id).reduce((sum, o) => sum + Number(o.price), 0);
      const partialCourierCollected = orders.filter(o => o.status_id === partialStatus?.id).reduce((sum, o) => sum + Number(o.partial_amount || 0), 0);

      const settlement = (deliveredTotal + partialManual) - (advancePaid + returnedTotal + shippingDiscount + commission);
      const settlementWithPostponed = settlement + postponedTotal;

      return {
        id: office.id,
        name: office.name,
        orderCount: orders.length,
        deliveredTotal,
        returnedTotal,
        postponedTotal,
        partialManual,
        partialCourierCollected,
        shippingDiscount,
        settlement,
        settlementWithPostponed,
        advancePaid,
        commission,
      };
    }));

    setAccounts(result.filter(Boolean));
  };

  const saveAdvance = async () => {
    if (!advanceOffice || !advanceAmount) { toast.error('اختر مكتب وأدخل المبلغ'); return; }

    const defaultNote =
      advanceType === 'advance' ? 'دفعة' :
      advanceType === 'commission' ? 'عمولة' :
      advanceType === 'partial_delivery' ? 'تسليم جزئي (يدوي)' :
      'خصم شحن';

    const { error } = await supabase.from('office_payments').insert({
      office_id: advanceOffice,
      amount: parseFloat(advanceAmount),
      type: advanceType,
      notes: advanceNotes || defaultNote,
    });

    if (error) { toast.error('حدث خطأ: ' + error.message); return; }

    logActivity('إضافة عملية مالية لمكتب', {
      office_id: advanceOffice,
      type: advanceType,
      amount: parseFloat(advanceAmount),
    });

    toast.success('تم الحفظ بنجاح');
    setAdvanceOpen(false);
    setAdvanceAmount('');
    setAdvanceNotes('');
    setAdvanceOffice('');
    setAdvanceType('advance');
    loadAccounts();
  };

  const updatePayment = async () => {
    if (!editItem) return;

    const { error } = await supabase
      .from('office_payments')
      .update({ amount: parseFloat(editAmount), notes: editNotes })
      .eq('id', editItem.id);

    if (error) { toast.error(error.message); return; }

    logActivity('تعديل معاملة مكتب', { payment_id: editItem.id });
    toast.success('تم التحديث');
    setEditItem(null);
    loadAccounts();
  };

  const deletePayment = async (id: string) => {
    if (!confirm('حذف هذا السجل؟')) return;
    await supabase.from('office_payments').delete().eq('id', id);
    logActivity('حذف معاملة مكتب', { payment_id: id });
    toast.success('تم الحذف');
    loadAccounts();
  };

  const officePaymentsList = payments.filter(p => selectedOffice === 'all' || p.office_id === selectedOffice);
  const selectedAccount = selectedOffice !== 'all' ? accounts.find(a => a.id === selectedOffice) : null;

  // Filter statuses available for the checkbox filter
  const filterableStatuses = statuses.filter(s => FILTER_STATUS_NAMES.includes(s.name));

  const toggleStatusFilter = (statusId: string) => {
    setSelectedStatuses(prev =>
      prev.includes(statusId) ? prev.filter(id => id !== statusId) : [...prev, statusId]
    );
  };

  // Filtered orders based on selected statuses
  const filteredOrders = selectedStatuses.length > 0
    ? officeOrders.filter(o => selectedStatuses.includes(o.status_id))
    : officeOrders;

  // Calculate summary per status group for filtered orders
  const getStatusSummary = () => {
    const statusesToShow = selectedStatuses.length > 0
      ? filterableStatuses.filter(s => selectedStatuses.includes(s.id))
      : filterableStatuses;

    return statusesToShow.map(status => {
      const orders = officeOrders.filter(o => o.status_id === status.id);
      const total = orders.reduce((sum, o) => sum + Number(o.price || 0), 0);
      const shipping = orders.reduce((sum, o) => sum + Number(o.delivery_price || 0), 0);
      const net = total - shipping;
      return {
        statusName: status.name,
        statusColor: status.color,
        count: orders.length,
        total,
        shipping,
        net,
      };
    }).filter(s => s.count > 0);
  };

  const statusSummary = selectedOffice !== 'all' ? getStatusSummary() : [];
  const summaryTotalAll = statusSummary.reduce((sum, s) => sum + s.total, 0);
  const summaryShippingAll = statusSummary.reduce((sum, s) => sum + s.shipping, 0);
  const summaryNetAll = statusSummary.reduce((sum, s) => sum + s.net, 0);

  const officeName = offices.find(o => o.id === selectedOffice)?.name || '';

  // Export filtered data to Excel
  const exportToExcel = () => {
    if (filteredOrders.length === 0) { toast.error('لا توجد بيانات للتصدير'); return; }
    const statusName = (sid: string) => statuses.find(s => s.id === sid)?.name || '-';

    const data = filteredOrders.map((o, i) => ({
      '#': i + 1,
      'الباركود': o.barcode || '-',
      'الكود': o.customer_code || '-',
      'الاسم': o.customer_name || '-',
      'السعر': Number(o.price || 0),
      'الشحن': Number(o.delivery_price || 0),
      'الصافي': Number(o.price || 0) - Number(o.delivery_price || 0),
      'الحالة': statusName(o.status_id),
    }));

    // Add summary rows
    data.push({
      '#': '' as any,
      'الباركود': '',
      'الكود': '',
      'الاسم': 'الإجمالي',
      'السعر': filteredOrders.reduce((s, o) => s + Number(o.price || 0), 0),
      'الشحن': filteredOrders.reduce((s, o) => s + Number(o.delivery_price || 0), 0),
      'الصافي': filteredOrders.reduce((s, o) => s + Number(o.price || 0) - Number(o.delivery_price || 0), 0),
      'الحالة': '',
    });

    // Add status breakdown
    if (statusSummary.length > 0) {
      data.push({ '#': '' as any, 'الباركود': '', 'الكود': '', 'الاسم': '--- ملخص الحالات ---', 'السعر': '' as any, 'الشحن': '' as any, 'الصافي': '' as any, 'الحالة': '' });
      statusSummary.forEach(s => {
        data.push({
          '#': '' as any,
          'الباركود': '',
          'الكود': '',
          'الاسم': `${s.statusName} (${s.count})`,
          'السعر': s.total,
          'الشحن': s.shipping,
          'الصافي': s.net,
          'الحالة': '',
        });
      });
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'حسابات');
    XLSX.writeFile(wb, `حسابات-${officeName}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('تم التصدير بنجاح');
  };

  // Print filtered data
  const printSheet = () => {
    if (filteredOrders.length === 0) { toast.error('لا توجد بيانات للطباعة'); return; }
    const statusName = (sid: string) => statuses.find(s => s.id === sid)?.name || '-';
    const w = window.open('', '_blank');
    if (!w) return;

    const orderRows = filteredOrders.map((o, i) => `<tr>
      <td>${i + 1}</td>
      <td>${o.barcode || '-'}</td>
      <td>${o.customer_code || '-'}</td>
      <td>${o.customer_name || '-'}</td>
      <td>${Number(o.price || 0)}</td>
      <td>${Number(o.delivery_price || 0)}</td>
      <td>${Number(o.price || 0) - Number(o.delivery_price || 0)}</td>
      <td>${statusName(o.status_id)}</td>
    </tr>`).join('');

    const totalPrice = filteredOrders.reduce((s, o) => s + Number(o.price || 0), 0);
    const totalShipping = filteredOrders.reduce((s, o) => s + Number(o.delivery_price || 0), 0);
    const totalNet = totalPrice - totalShipping;

    const summaryRows = statusSummary.map(s => `<tr>
      <td style="background:${s.statusColor}20; font-weight:bold;">${s.statusName}</td>
      <td>${s.count}</td>
      <td>${s.total}</td>
      <td>${s.shipping}</td>
      <td style="font-weight:bold;">${s.net}</td>
    </tr>`).join('');

    w.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
    <title>حسابات ${officeName}</title>
    <style>
      @page { size: A4; margin: 8mm; }
      body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; font-size: 11px; margin: 0; padding: 10px; }
      .header { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 5px; }
      .sub-header { text-align: center; font-size: 12px; color: #666; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
      th, td { border: 1px solid #333; padding: 4px 6px; text-align: right; font-size: 10px; }
      th { background: #f0f0f0; font-weight: bold; }
      .total-row { background: #e8f4e8; font-weight: bold; }
      .summary-title { font-size: 14px; font-weight: bold; margin: 10px 0 5px; }
    </style></head><body>
    <div class="header">The Pilito - حسابات ${officeName}</div>
    <div class="sub-header">${format(new Date(), 'dd/MM/yyyy')}</div>
    
    <table>
      <thead><tr><th>#</th><th>الباركود</th><th>الكود</th><th>الاسم</th><th>الإجمالي</th><th>العمولة (شحن)</th><th>الصافي</th><th>الحالة</th></tr></thead>
      <tbody>
        ${orderRows}
        <tr class="total-row">
          <td colspan="4">الإجمالي (${filteredOrders.length} أوردر)</td>
          <td>${totalPrice}</td>
          <td>${totalShipping}</td>
          <td>${totalNet}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    ${statusSummary.length > 0 ? `
    <div class="summary-title">ملخص حسب الحالة</div>
    <table>
      <thead><tr><th>الحالة</th><th>العدد</th><th>الإجمالي</th><th>العمولة (شحن)</th><th>الصافي</th></tr></thead>
      <tbody>
        ${summaryRows}
        <tr class="total-row">
          <td>المجموع</td>
          <td>${statusSummary.reduce((s, x) => s + x.count, 0)}</td>
          <td>${summaryTotalAll}</td>
          <td>${summaryShippingAll}</td>
          <td>${summaryNetAll}</td>
        </tr>
      </tbody>
    </table>` : ''}
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  const paymentTypeLabel = (type: string) => {
    if (type === 'advance') return 'دفعة';
    if (type === 'commission') return 'عمولة';
    if (type === 'shipping_discount') return 'خصم شحن';
    if (type === 'partial_delivery') return 'تسليم جزئي (يدوي)';
    return type;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">حسابات المكاتب</h1>
        <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 ml-1" />إضافة دفعة / عمولة / خصم شحن / تسليم جزئي</Button></DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle>إضافة عملية مالية</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>المكتب</Label>
                <Select value={advanceOffice} onValueChange={setAdvanceOffice}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
                  <SelectContent>{offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>النوع</Label>
                <Select value={advanceType} onValueChange={setAdvanceType}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advance">دفعة</SelectItem>
                    <SelectItem value="commission">عمولة</SelectItem>
                    <SelectItem value="shipping_discount">خصم الشحن</SelectItem>
                    <SelectItem value="partial_delivery">تسليم جزئي (يدوي)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>المبلغ</Label><Input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} className="bg-secondary border-border" /></div>
              <div><Label>ملاحظات</Label><Input value={advanceNotes} onChange={e => setAdvanceNotes(e.target.value)} className="bg-secondary border-border" /></div>
              <Button onClick={saveAdvance} className="w-full">حفظ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Select value={selectedOffice} onValueChange={setSelectedOffice}>
          <SelectTrigger className="w-44 bg-secondary border-border"><SelectValue placeholder="اختر مكتب" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المكاتب</SelectItem>
            {offices.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Tabs value={period} onValueChange={setPeriod} className="w-auto">
          <TabsList className="bg-secondary">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="daily">يومي</TabsTrigger>
            <TabsTrigger value="monthly">شهري</TabsTrigger>
            <TabsTrigger value="yearly">سنوي</TabsTrigger>
          </TabsList>
        </Tabs>
        {selectedOffice !== 'all' && (
          <>
            <Button size="sm" variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="h-4 w-4 ml-1" />Excel
            </Button>
            <Button size="sm" variant="outline" onClick={printSheet}>
              <Printer className="h-4 w-4 ml-1" />طباعة
            </Button>
          </>
        )}
      </div>

      {/* Status filter checkboxes */}
      {selectedOffice !== 'all' && filterableStatuses.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            <p className="text-sm font-semibold mb-2">فلتر حسب الحالة:</p>
            <div className="flex flex-wrap gap-3">
              {filterableStatuses.map(s => (
                <label key={s.id} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <Checkbox
                    checked={selectedStatuses.includes(s.id)}
                    onCheckedChange={() => toggleStatusFilter(s.id)}
                  />
                  <Badge style={{ backgroundColor: s.color }} className="text-xs">{s.name}</Badge>
                </label>
              ))}
              {selectedStatuses.length > 0 && (
                <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setSelectedStatuses([])}>
                  إلغاء الفلتر
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedAccount && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">المستحق</p>
              <p className="text-2xl font-bold text-primary">{selectedAccount.settlement} ج.م</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">المستحق بالمؤجل</p>
              <p className="text-2xl font-bold text-primary">{selectedAccount.settlementWithPostponed} ج.م</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status summary table */}
      {selectedOffice !== 'all' && statusSummary.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">ملخص حسب الحالة</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">العدد</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">العمولة (شحن)</TableHead>
                    <TableHead className="text-right">الصافي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusSummary.map((s, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell>
                        <Badge style={{ backgroundColor: s.statusColor }} className="text-xs">{s.statusName}</Badge>
                      </TableCell>
                      <TableCell className="text-sm font-bold">{s.count}</TableCell>
                      <TableCell className="text-sm font-bold">{s.total} ج.م</TableCell>
                      <TableCell className="text-sm font-bold">{s.shipping} ج.م</TableCell>
                      <TableCell className="text-sm font-bold text-primary">{s.net} ج.م</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell className="font-bold">المجموع</TableCell>
                    <TableCell className="font-bold">{statusSummary.reduce((s, x) => s + x.count, 0)}</TableCell>
                    <TableCell className="font-bold">{summaryTotalAll} ج.م</TableCell>
                    <TableCell className="font-bold">{summaryShippingAll} ج.م</TableCell>
                    <TableCell className="font-bold text-primary">{summaryNetAll} ج.م</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right">عدد</TableHead>
                  <TableHead className="text-right">تسليم</TableHead>
                  <TableHead className="text-right">مرتجع</TableHead>
                  <TableHead className="text-right">مؤجل</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">تسليم جزئي (يدوي)</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">تحصيل جزئي مندوب</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">خصم شحن</TableHead>
                  <TableHead className="text-right">المدفوع</TableHead>
                  <TableHead className="text-right">العمولة</TableHead>
                  <TableHead className="text-right">المستحق</TableHead>
                  <TableHead className="text-right">بالمؤجل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">لا توجد بيانات</TableCell></TableRow>
                ) : accounts.map(a => (
                  <TableRow key={a.id} className="border-border">
                    <TableCell className="font-medium text-sm">{a.name}</TableCell>
                    <TableCell className="text-sm">{a.orderCount}</TableCell>
                    <TableCell className="font-bold text-sm">{a.deliveredTotal} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.returnedTotal} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.postponedTotal} ج.م</TableCell>
                    <TableCell className="font-bold text-sm hidden sm:table-cell">{a.partialManual} ج.م</TableCell>
                    <TableCell className="font-bold text-sm hidden sm:table-cell">{a.partialCourierCollected} ج.م</TableCell>
                    <TableCell className="text-sm hidden sm:table-cell">{a.shippingDiscount} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.advancePaid} ج.م</TableCell>
                    <TableCell className="text-sm font-bold">{a.commission} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.settlement} ج.م</TableCell>
                    <TableCell className="font-bold text-sm">{a.settlementWithPostponed} ج.م</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedOffice !== 'all' && filteredOrders.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">أوردرات المكتب ({filteredOrders.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">الباركود</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">العمولة (شحن)</TableHead>
                    <TableHead className="text-right">الصافي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">خالص</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((o) => {
                    const status = statuses.find(s => s.id === o.status_id);
                    const price = Number(o.price || 0);
                    const shipping = Number(o.delivery_price || 0);
                    const net = price - shipping;
                    return (
                      <TableRow key={o.id} className="border-border">
                        <TableCell className="font-mono text-xs">{o.barcode || '-'}</TableCell>
                        <TableCell className="font-mono text-xs">{o.customer_code || '-'}</TableCell>
                        <TableCell className="text-sm">{o.customer_name || '-'}</TableCell>
                        <TableCell className="text-sm font-bold">{price} ج.م</TableCell>
                        <TableCell className="text-sm">{shipping} ج.م</TableCell>
                        <TableCell className="text-sm font-bold text-primary">{net} ج.م</TableCell>
                        <TableCell>
                          {status ? <Badge style={{ backgroundColor: status.color }} className="text-xs">{status.name}</Badge> : '-'}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant={o.is_settled ? 'default' : 'outline'} className={`text-xs h-6 px-2 ${o.is_settled ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`} onClick={() => toggleSettled(o.id, !o.is_settled)}>
                            {o.is_settled ? '✓ خالص' : 'خالص'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-border bg-muted/50">
                    <TableCell colSpan={3} className="font-bold">الإجمالي ({filteredOrders.length})</TableCell>
                    <TableCell className="font-bold">{filteredOrders.reduce((s, o) => s + Number(o.price || 0), 0)} ج.م</TableCell>
                    <TableCell className="font-bold">{filteredOrders.reduce((s, o) => s + Number(o.delivery_price || 0), 0)} ج.م</TableCell>
                    <TableCell className="font-bold text-primary">{filteredOrders.reduce((s, o) => s + Number(o.price || 0) - Number(o.delivery_price || 0), 0)} ج.م</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {officePaymentsList.length > 0 && (
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <h3 className="font-semibold mb-3">سجل الدفعات والعمولات</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officePaymentsList.map(p => (
                    <TableRow key={p.id} className="border-border">
                      <TableCell className="text-sm">{offices.find(o => o.id === p.office_id)?.name || '-'}</TableCell>
                      <TableCell className="text-sm">{paymentTypeLabel(p.type)}</TableCell>
                      <TableCell className="font-bold text-sm">{p.amount} ج.م</TableCell>
                      <TableCell className="text-sm">{p.notes || '-'}</TableCell>
                      <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString('ar-EG')}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditItem(p); setEditAmount(String(p.amount)); setEditNotes(p.notes || ''); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isOwner && (
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deletePayment(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editItem} onOpenChange={v => { if (!v) setEditItem(null); }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle>تعديل السجل</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>المبلغ</Label><Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="bg-secondary border-border" /></div>
            <div><Label>ملاحظات</Label><Input value={editNotes} onChange={e => setEditNotes(e.target.value)} className="bg-secondary border-border" /></div>
            <Button onClick={updatePayment} className="w-full">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="bg-card border-border p-4">
        <h3 className="font-semibold mb-2">معادلة صافي الحساب:</h3>
        <p className="text-sm text-muted-foreground">المستحق = (التسليمات + تسليم جزئي يدوي) - (المدفوع + المرتجع + خصم الشحن + العمولة)</p>
        <p className="text-sm text-muted-foreground">المستحق بالمؤجل = المستحق + المؤجل</p>
        <p className="text-sm text-muted-foreground mt-1">الصافي = الإجمالي - العمولة (الشحن)</p>
      </Card>
    </div>
  );
}
