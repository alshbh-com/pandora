import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, StickyNote, FileText } from 'lucide-react';
import { toast } from 'sonner';

export default function PrintSticker() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { loadAllOrders(); }, []);

  const loadAllOrders = async () => {
    const { data } = await supabase
      .from('orders')
      .select('*, offices(name)')
      .eq('is_closed', false)
      .order('created_at', { ascending: false })
      .limit(500);
    setResults(data || []);
  };

  const doSearch = async () => {
    if (!search.trim()) { loadAllOrders(); return; }
    const term = search.trim();
    const { data } = await supabase
      .from('orders')
      .select('*, offices(name)')
      .or(`barcode.ilike.%${term}%,customer_code.ilike.%${term}%,tracking_id.ilike.%${term}%,customer_phone.ilike.%${term}%,customer_name.ilike.%${term}%`)
      .order('created_at', { ascending: false })
      .limit(200);
    setResults(data || []);
    setSelected(new Set());
    if (!data?.length) toast.error('لم يتم العثور على نتائج');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === results.length) setSelected(new Set());
    else setSelected(new Set(results.map(o => o.id)));
  };

  const selectedOrders = results.filter(o => selected.has(o.id));

  const generateBarcodeStripes = (barcode: string) => {
    return barcode.split('').map((c: string) => {
      const w = (parseInt(c) || 1) + 1;
      return `<div style="width:${w}px;height:30px;background:#000;margin:0 0.5px;display:inline-block"></div>`;
    }).join('');
  };

  const printStickers = () => {
    if (selectedOrders.length === 0) { toast.error('اختر أوردرات للطباعة'); return; }
    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) return;

    const stickers = selectedOrders.map(order => {
      const total = Number(order.price) + Number(order.delivery_price);
      const barcode = order.barcode || '';
      return `
        <div class="sticker">
          <div class="header">The Pilito</div>
          <div class="date">${new Date(order.created_at).toLocaleDateString('ar-EG')}</div>
          <div class="barcode-num">${barcode}</div>
          <div class="row"><span>الكود: <b>${order.customer_code || '-'}</b></span></div>
          <div class="info">العميل: <b>${order.customer_name}</b></div>
          <div class="info">المكتب: <b>${order.offices?.name || '-'}</b></div>
          <div class="info">هاتف: <b dir="ltr">${order.customer_phone}</b></div>
          <div class="info">العنوان: <b>${order.address || '-'}</b></div>
          <div class="info">قطع: <b>${order.quantity || 1}</b> ${order.size ? `| مقاس: <b>${order.size}</b>` : ''} ${order.color ? `| لون: <b>${order.color}</b>` : ''}</div>
          <div class="total">${total} ج.م</div>
        </div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
      <style>
        @page { size: 50mm 100mm; margin: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
        .sticker { width: 50mm; height: 100mm; padding: 4mm 1.5mm 4mm 10mm; box-sizing: border-box; page-break-after: always; display: flex; flex-direction: column; direction: rtl; text-align: right; }
        .sticker:last-child { page-break-after: auto; }
        .header { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 1px; direction: ltr; }
        .date { text-align: center; font-size: 8px; margin-bottom: 3px; color: #333; }
        .barcode-num { font-family: monospace; font-size: 17px; font-weight: bold; margin-bottom: 4px; text-align: center; }
        .info { margin: 2px 0; font-size: 10px; line-height: 1.4; text-align: right; word-wrap: break-word; overflow-wrap: break-word; }
        .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; }
        .total { font-size: 15px; font-weight: bold; text-align: center; border: 1.5px solid #000; padding: 3px; margin-top: auto; }
      </style></head><body>${stickers}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const printInvoice = () => {
    if (selectedOrders.length === 0) { toast.error('اختر أوردرات للطباعة'); return; }
    const printWindow = window.open('', '_blank', 'width=800,height=1000');
    if (!printWindow) return;

    const invoicesHtml = selectedOrders.map((order, i) => {
      const total = Number(order.price) + Number(order.delivery_price);
      const barcode = order.barcode || '';
      return `
        <div class="invoice-page">
          <div class="header">The Pilito</div>
          <div class="date">${new Date().toLocaleDateString('ar-EG')} - فاتورة ${i + 1} من ${selectedOrders.length}</div>
          <table>
            <tr><th>الكود</th><td>${order.customer_code || '-'}</td></tr>
            <tr><th>الباركود</th><td style="font-family:monospace;direction:ltr">${barcode}</td></tr>
            <tr><th>اسم العميل</th><td>${order.customer_name}</td></tr>
            <tr><th>الهاتف</th><td dir="ltr">${order.customer_phone}</td></tr>
            <tr><th>المكتب</th><td>${order.offices?.name || '-'}</td></tr>
            <tr><th>العنوان</th><td>${order.address || '-'}</td></tr>
            <tr><th>المنتج</th><td>${order.product_name || '-'}</td></tr>
            <tr><th>الكمية</th><td>${order.quantity}</td></tr>
            <tr><th>السعر</th><td>${Number(order.price)} ج.م</td></tr>
            <tr><th>الشحن</th><td>${Number(order.delivery_price)} ج.م</td></tr>
          </table>
          <div class="total">الإجمالي: ${total} ج.م</div>
        </div>`;
    }).join('');

    printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
        .invoice-page { page-break-after: always; padding: 10mm 0; }
        .invoice-page:last-child { page-break-after: auto; }
        .header { text-align: center; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .date { text-align: center; margin-bottom: 20px; color: #666; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #333; padding: 10px 14px; text-align: right; font-size: 14px; }
        th { background: #f0f0f0; font-weight: bold; width: 30%; }
        .total { font-size: 22px; font-weight: bold; text-align: center; border: 3px solid #000; padding: 12px; }
      </style></head><body>${invoicesHtml}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl sm:text-2xl font-bold">الطباعة</h1>
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-lg">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالباركود / الكود / الاسم / الهاتف..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            className="pr-9 bg-secondary border-border" />
        </div>
        <Button onClick={doSearch}>بحث</Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm font-medium">تم تحديد {selected.size} أوردر</span>
        <Button size="sm" onClick={printStickers} disabled={selected.size === 0}>
          <StickyNote className="h-4 w-4 ml-1" />ملصقات صغيرة
        </Button>
        <Button size="sm" variant="outline" onClick={printInvoice} disabled={selected.size === 0}>
          <FileText className="h-4 w-4 ml-1" />فاتورة (A4)
        </Button>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="w-10"><Checkbox checked={results.length > 0 && selected.size === results.length} onCheckedChange={toggleAll} /></TableHead>
                  <TableHead className="text-right">الباركود</TableHead>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">العنوان</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">الهاتف</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">المكتب</TableHead>
                  <TableHead className="text-right">الإجمالي</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">لا توجد أوردرات</TableCell></TableRow>
                ) : results.map(order => (
                  <TableRow key={order.id} className="border-border">
                    <TableCell><Checkbox checked={selected.has(order.id)} onCheckedChange={() => toggleSelect(order.id)} /></TableCell>
                    <TableCell className="font-mono text-xs">{order.barcode || '-'}</TableCell>
                    <TableCell className="font-mono text-xs">{order.customer_code || '-'}</TableCell>
                    <TableCell className="text-sm">{order.customer_name}</TableCell>
                    <TableCell className="text-sm truncate max-w-[120px]">{order.address || '-'}</TableCell>
                    <TableCell dir="ltr" className="hidden sm:table-cell text-sm">{order.customer_phone}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{order.offices?.name || '-'}</TableCell>
                    <TableCell className="font-bold text-sm">{Number(order.price) + Number(order.delivery_price)} ج.م</TableCell>
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
