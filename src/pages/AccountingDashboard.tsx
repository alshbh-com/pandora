import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { TrendingUp, TrendingDown, DollarSign, ArrowUpDown, Plus, Trash2, Calendar } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

const EXPENSE_CATEGORIES = ['إيجار', 'مرتبات', 'إنترنت', 'وقود', 'صيانة', 'طباعة', 'تعبئة وتغليف', 'أخرى'];

export default function AccountingDashboard() {
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [officeFilter, setOfficeFilter] = useState('all');

  // Expense form
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ expense_name: '', amount: '', category: 'أخرى', notes: '', expense_date: format(new Date(), 'yyyy-MM-dd'), office_id: '' });

  // Cash flow form
  const [addCashFlowOpen, setAddCashFlowOpen] = useState(false);
  const [cashFlowForm, setCashFlowForm] = useState({ type: 'inside', amount: '', reason: '', notes: '', entry_date: format(new Date(), 'yyyy-MM-dd'), office_id: '' });

  // === DATA QUERIES ===

  const { data: offices = [] } = useQuery({
    queryKey: ['offices-list'],
    queryFn: async () => {
      const { data } = await supabase.from('offices').select('id, name').order('name');
      return data || [];
    },
  });

  // LAYER 1: Main business accounting (from orders table directly)
  const { data: mainOrders = [] } = useQuery({
    queryKey: ['accounting-main-orders', dateFrom, dateTo, officeFilter],
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('*, order_statuses(name)')
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo + 'T23:59:59');
      if (officeFilter !== 'all') q = q.eq('office_id', officeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // LAYER 2: Diary-based accounting (from diary_orders)
  const { data: diaryOrdersData = [] } = useQuery({
    queryKey: ['accounting-diary-orders', dateFrom, dateTo, officeFilter],
    queryFn: async () => {
      let q = supabase
        .from('diary_orders')
        .select('*, orders(*), diaries(*)');
      const { data, error } = await q;
      if (error) throw error;
      // Filter by date range and office
      return (data || []).filter((d: any) => {
        const diaryDate = d.diaries?.diary_date;
        if (diaryDate && (diaryDate < dateFrom || diaryDate > dateTo)) return false;
        if (officeFilter !== 'all' && d.orders?.office_id !== officeFilter) return false;
        return true;
      });
    },
  });

  // Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', dateFrom, dateTo, officeFilter],
    queryFn: async () => {
      let q = supabase.from('expenses').select('*')
        .gte('expense_date', dateFrom)
        .lte('expense_date', dateTo)
        .order('expense_date', { ascending: false });
      if (officeFilter !== 'all') q = q.eq('office_id', officeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Cash flow
  const { data: cashFlowEntries = [] } = useQuery({
    queryKey: ['cash-flow', dateFrom, dateTo, officeFilter],
    queryFn: async () => {
      let q = supabase.from('cash_flow_entries').select('*')
        .gte('entry_date', dateFrom)
        .lte('entry_date', dateTo)
        .order('entry_date', { ascending: false });
      if (officeFilter !== 'all') q = q.eq('office_id', officeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // === MUTATIONS ===

  const addExpense = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('expenses').insert({
        expense_name: expenseForm.expense_name,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        notes: expenseForm.notes,
        expense_date: expenseForm.expense_date,
        office_id: expenseForm.office_id || null,
      });
      if (error) throw error;
      await logActivity('إضافة مصروف', { name: expenseForm.expense_name, amount: expenseForm.amount });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('تم إضافة المصروف');
      setAddExpenseOpen(false);
      setExpenseForm({ expense_name: '', amount: '', category: 'أخرى', notes: '', expense_date: format(new Date(), 'yyyy-MM-dd'), office_id: '' });
    },
    onError: () => toast.error('فشل الإضافة'),
  });

  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('expenses').delete().eq('id', id);
      if (error) throw error;
      await logActivity('حذف مصروف', { expense_id: id });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('تم الحذف'); },
  });

  const addCashFlow = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('cash_flow_entries').insert({
        type: cashFlowForm.type,
        amount: parseFloat(cashFlowForm.amount),
        reason: cashFlowForm.reason,
        notes: cashFlowForm.notes,
        entry_date: cashFlowForm.entry_date,
        office_id: cashFlowForm.office_id || null,
      });
      if (error) throw error;
      await logActivity('إضافة حركة مالية', { type: cashFlowForm.type, amount: cashFlowForm.amount });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cash-flow'] });
      toast.success('تم الإضافة');
      setAddCashFlowOpen(false);
      setCashFlowForm({ type: 'inside', amount: '', reason: '', notes: '', entry_date: format(new Date(), 'yyyy-MM-dd'), office_id: '' });
    },
  });

  const deleteCashFlow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('cash_flow_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['cash-flow'] }); toast.success('تم الحذف'); },
  });

  // === CALCULATIONS ===

  // Layer 1 - Main business
  const deliveredStatuses = ['تم التسليم', 'تسليم جزئي'];
  const returnStatuses = ['مرتجع', 'رفض ولم يدفع شحن', 'رفض دون شحن'];

  const layer1Delivered = mainOrders.filter((o: any) => deliveredStatuses.includes(o.order_statuses?.name));
  const layer1Returns = mainOrders.filter((o: any) => returnStatuses.includes(o.order_statuses?.name));

  const layer1TotalDelivered = layer1Delivered.reduce((s: number, o: any) => s + (o.price || 0), 0);
  const layer1TotalShipping = layer1Delivered.reduce((s: number, o: any) => s + (o.delivery_price || 0), 0);
  const layer1TotalReturns = layer1Returns.reduce((s: number, o: any) => s + (o.price || 0), 0);
  const layer1PaidShipping = mainOrders.filter((o: any) => ['رفض ودفع شحن', 'استلم ودفع نص الشحن'].includes(o.order_statuses?.name))
    .reduce((s: number, o: any) => s + (o.shipping_paid || o.delivery_price || 0), 0);

  const totalExpenses = expenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const totalShippingRevenue = layer1TotalShipping + layer1PaidShipping;
  const grossProfit = totalShippingRevenue;
  const netProfit = grossProfit - totalExpenses;

  // Revenue by office
  const revenueByOffice: Record<string, { delivered: number; shipping: number; returns: number }> = {};
  mainOrders.forEach((o: any) => {
    const offId = o.office_id || 'no-office';
    if (!revenueByOffice[offId]) revenueByOffice[offId] = { delivered: 0, shipping: 0, returns: 0 };
    if (deliveredStatuses.includes(o.order_statuses?.name)) {
      revenueByOffice[offId].delivered += o.price || 0;
      revenueByOffice[offId].shipping += o.delivery_price || 0;
    }
    if (returnStatuses.includes(o.order_statuses?.name)) {
      revenueByOffice[offId].returns += o.price || 0;
    }
  });

  // Cash flow
  const cashIn = cashFlowEntries.filter((e: any) => e.type === 'inside').reduce((s: number, e: any) => s + (e.amount || 0), 0);
  const cashOut = cashFlowEntries.filter((e: any) => e.type === 'outside').reduce((s: number, e: any) => s + (e.amount || 0), 0);

  // Daily summary
  const dailySummary: Record<string, { delivered: number; shipping: number; returns: number; expenses: number }> = {};
  mainOrders.forEach((o: any) => {
    const day = format(new Date(o.created_at), 'yyyy-MM-dd');
    if (!dailySummary[day]) dailySummary[day] = { delivered: 0, shipping: 0, returns: 0, expenses: 0 };
    if (deliveredStatuses.includes(o.order_statuses?.name)) {
      dailySummary[day].delivered += o.price || 0;
      dailySummary[day].shipping += o.delivery_price || 0;
    }
    if (returnStatuses.includes(o.order_statuses?.name)) dailySummary[day].returns += o.price || 0;
  });
  expenses.forEach((e: any) => {
    const day = e.expense_date;
    if (!dailySummary[day]) dailySummary[day] = { delivered: 0, shipping: 0, returns: 0, expenses: 0 };
    dailySummary[day].expenses += e.amount || 0;
  });

  const sortedDays = Object.keys(dailySummary).sort((a, b) => b.localeCompare(a));

  const getOfficeName = (id: string) => offices.find((o: any) => o.id === id)?.name || 'بدون مكتب';

  return (
    <div className="space-y-6" dir="rtl">
      <h2 className="text-xl font-bold text-foreground">الحسابات</h2>

      {/* Global Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-muted-foreground">من</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">إلى</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">المكتب</label>
          <Select value={officeFilter} onValueChange={setOfficeFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المكاتب</SelectItem>
              {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { setDateFrom(format(startOfMonth(new Date()), 'yyyy-MM-dd')); setDateTo(format(endOfMonth(new Date()), 'yyyy-MM-dd')); setOfficeFilter('all'); }}>
          إعادة تعيين
        </Button>
      </div>

      <Tabs defaultValue="profits" dir="rtl">
        <TabsList className="flex-wrap">
          <TabsTrigger value="profits">أرباح الشركة</TabsTrigger>
          <TabsTrigger value="pnl">الأرباح والخسائر</TabsTrigger>
          <TabsTrigger value="expenses">المصاريف</TabsTrigger>
          <TabsTrigger value="cashflow">الداخل والخارج</TabsTrigger>
          <TabsTrigger value="summary">ملخص يومي/شهري</TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: Company Profits ===== */}
        <TabsContent value="profits" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4 text-green-500" /> إجمالي التسليمات</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-green-600">{layer1TotalDelivered.toLocaleString()}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-500" /> إجمالي المرتجعات</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-red-600">{layer1TotalReturns.toLocaleString()}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4 text-blue-500" /> إيرادات الشحن</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold text-blue-600">{totalShippingRevenue.toLocaleString()}</p></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground flex items-center gap-2"><ArrowUpDown className="h-4 w-4 text-primary" /> صافي الإيرادات</CardTitle></CardHeader>
              <CardContent><p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netProfit.toLocaleString()}</p></CardContent>
            </Card>
          </div>

          {/* Revenue by Office */}
          <Card>
            <CardHeader><CardTitle className="text-base">الإيرادات حسب المكتب</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">تسليمات</TableHead>
                    <TableHead className="text-right">شحن</TableHead>
                    <TableHead className="text-right">مرتجعات</TableHead>
                    <TableHead className="text-right">صافي</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(revenueByOffice).map(([offId, data]) => (
                    <TableRow key={offId}>
                      <TableCell className="font-medium">{getOfficeName(offId)}</TableCell>
                      <TableCell className="text-green-600">{data.delivered.toLocaleString()}</TableCell>
                      <TableCell className="text-blue-600">{data.shipping.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">{data.returns.toLocaleString()}</TableCell>
                      <TableCell className="font-bold">{(data.shipping).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 2: P&L ===== */}
        <TabsContent value="pnl" className="mt-4">
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <span>إيرادات الشحن (تسليمات + رفض مدفوع)</span>
                <span className="text-xl font-bold text-green-600">{totalShippingRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <span>إجمالي المصاريف</span>
                <span className="text-xl font-bold text-red-600">{totalExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                <span>خسائر المرتجعات</span>
                <span className="text-xl font-bold text-orange-600">{layer1TotalReturns.toLocaleString()}</span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <span className="font-bold">إجمالي الربح</span>
                  <span className="text-xl font-bold text-blue-600">{grossProfit.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-bold text-lg">صافي الربح</span>
                  <span className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{netProfit.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 3: Expenses ===== */}
        <TabsContent value="expenses" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">المصاريف</h3>
              <p className="text-sm text-muted-foreground">إجمالي: {totalExpenses.toLocaleString()}</p>
            </div>
            <Button size="sm" onClick={() => setAddExpenseOpen(true)}>
              <Plus className="h-4 w-4 ml-1" /> إضافة مصروف
            </Button>
          </div>

          {/* Expense by category summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {EXPENSE_CATEGORIES.map(cat => {
              const catTotal = expenses.filter((e: any) => e.category === cat).reduce((s: number, e: any) => s + (e.amount || 0), 0);
              if (catTotal === 0) return null;
              return (
                <div key={cat} className="bg-muted/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">{cat}</p>
                  <p className="text-lg font-bold">{catTotal.toLocaleString()}</p>
                </div>
              );
            })}
          </div>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">التصنيف</TableHead>
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right w-12">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد مصاريف</TableCell></TableRow>
                ) : expenses.map((exp: any) => (
                  <TableRow key={exp.id}>
                    <TableCell className="font-medium">{exp.expense_name}</TableCell>
                    <TableCell>{exp.category}</TableCell>
                    <TableCell className="text-muted-foreground">{exp.office_id ? getOfficeName(exp.office_id) : '-'}</TableCell>
                    <TableCell className="font-medium">{exp.amount}</TableCell>
                    <TableCell>{format(new Date(exp.expense_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{exp.notes}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('حذف؟')) deleteExpense.mutate(exp.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== TAB 4: Cash Flow ===== */}
        <TabsContent value="cashflow" className="mt-4 space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex gap-4">
              <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">الداخل</p>
                <p className="text-lg font-bold text-green-600">{cashIn.toLocaleString()}</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">الخارج</p>
                <p className="text-lg font-bold text-red-600">{cashOut.toLocaleString()}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3 text-center min-w-[120px]">
                <p className="text-xs text-muted-foreground">الصافي</p>
                <p className={`text-lg font-bold ${cashIn - cashOut >= 0 ? 'text-green-600' : 'text-red-600'}`}>{(cashIn - cashOut).toLocaleString()}</p>
              </div>
            </div>
            <Button size="sm" onClick={() => setAddCashFlowOpen(true)}>
              <Plus className="h-4 w-4 ml-1" /> إضافة حركة
            </Button>
          </div>

          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">السبب</TableHead>
                  <TableHead className="text-right">المكتب</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">ملاحظات</TableHead>
                  <TableHead className="text-right w-12">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlowEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">لا توجد حركات</TableCell></TableRow>
                ) : cashFlowEntries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${entry.type === 'inside' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                        {entry.type === 'inside' ? 'داخل' : 'خارج'}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{entry.amount}</TableCell>
                    <TableCell>{entry.reason}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.office_id ? getOfficeName(entry.office_id) : '-'}</TableCell>
                    <TableCell>{format(new Date(entry.entry_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{entry.notes}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('حذف؟')) deleteCashFlow.mutate(entry.id); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ===== TAB 5: Daily/Monthly Summary ===== */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          <h3 className="font-semibold">ملخص يومي</h3>
          <div className="border rounded-lg overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">التاريخ</TableHead>
                  <TableHead className="text-right">تسليمات</TableHead>
                  <TableHead className="text-right">شحن</TableHead>
                  <TableHead className="text-right">مرتجعات</TableHead>
                  <TableHead className="text-right">مصاريف</TableHead>
                  <TableHead className="text-right">الصافي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedDays.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد بيانات</TableCell></TableRow>
                ) : sortedDays.map(day => {
                  const d = dailySummary[day];
                  const dayNet = d.shipping - d.expenses;
                  return (
                    <TableRow key={day}>
                      <TableCell className="font-medium">{format(new Date(day), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="text-green-600">{d.delivered.toLocaleString()}</TableCell>
                      <TableCell className="text-blue-600">{d.shipping.toLocaleString()}</TableCell>
                      <TableCell className="text-red-600">{d.returns.toLocaleString()}</TableCell>
                      <TableCell className="text-orange-600">{d.expenses.toLocaleString()}</TableCell>
                      <TableCell className={`font-bold ${dayNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{dayNet.toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* === DIALOGS === */}

      {/* Add Expense */}
      <Dialog open={addExpenseOpen} onOpenChange={setAddExpenseOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة مصروف</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">اسم المصروف</label>
              <Input value={expenseForm.expense_name} onChange={(e) => setExpenseForm(p => ({ ...p, expense_name: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">التصنيف</label>
              <Select value={expenseForm.category} onValueChange={(v) => setExpenseForm(p => ({ ...p, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المكتب (اختياري)</label>
              <Select value={expenseForm.office_id || 'none'} onValueChange={(v) => setExpenseForm(p => ({ ...p, office_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="بدون مكتب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مكتب</SelectItem>
                  {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={expenseForm.amount} onChange={(e) => setExpenseForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={expenseForm.expense_date} onChange={(e) => setExpenseForm(p => ({ ...p, expense_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddExpenseOpen(false)}>إلغاء</Button>
            <Button onClick={() => addExpense.mutate()} disabled={!expenseForm.expense_name || !expenseForm.amount}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Cash Flow */}
      <Dialog open={addCashFlowOpen} onOpenChange={setAddCashFlowOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة حركة مالية</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">النوع</label>
              <Select value={cashFlowForm.type} onValueChange={(v) => setCashFlowForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inside">داخل (وارد)</SelectItem>
                  <SelectItem value="outside">خارج (صادر)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={cashFlowForm.amount} onChange={(e) => setCashFlowForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">السبب</label>
              <Input value={cashFlowForm.reason} onChange={(e) => setCashFlowForm(p => ({ ...p, reason: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">المكتب (اختياري)</label>
              <Select value={cashFlowForm.office_id || 'none'} onValueChange={(v) => setCashFlowForm(p => ({ ...p, office_id: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="بدون مكتب" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون مكتب</SelectItem>
                  {offices.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={cashFlowForm.entry_date} onChange={(e) => setCashFlowForm(p => ({ ...p, entry_date: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Textarea value={cashFlowForm.notes} onChange={(e) => setCashFlowForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddCashFlowOpen(false)}>إلغاء</Button>
            <Button onClick={() => addCashFlow.mutate()} disabled={!cashFlowForm.amount || !cashFlowForm.reason}>إضافة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
