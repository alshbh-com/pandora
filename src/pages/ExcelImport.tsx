import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Download, Loader2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { useQuery } from '@tanstack/react-query';

interface ParsedOrder {
  customer_name: string;
  customer_phone: string;
  customer_code?: string;
  product_name?: string;
  quantity: number;
  price: number;
  delivery_price: number;
  governorate?: string;
  address?: string;
  color?: string;
  size?: string;
  notes?: string;
}

const SYSTEM_FIELDS: { key: keyof ParsedOrder; label: string; required: boolean }[] = [
  { key: 'customer_name', label: 'اسم العميل', required: true },
  { key: 'customer_phone', label: 'رقم الهاتف', required: true },
  { key: 'customer_code', label: 'كود العميل', required: false },
  { key: 'product_name', label: 'المنتج', required: false },
  { key: 'quantity', label: 'الكمية', required: false },
  { key: 'price', label: 'السعر', required: true },
  { key: 'delivery_price', label: 'سعر التوصيل', required: false },
  { key: 'governorate', label: 'المحافظة', required: false },
  { key: 'address', label: 'العنوان', required: false },
  { key: 'color', label: 'اللون', required: false },
  { key: 'size', label: 'المقاس', required: false },
  { key: 'notes', label: 'ملاحظات', required: false },
];

// Auto-detect hints for common column names
const AUTO_MAP_HINTS: Record<string, keyof ParsedOrder> = {
  'اسم العميل': 'customer_name', 'customer_name': 'customer_name', 'الاسم': 'customer_name', 'اسم': 'customer_name', 'name': 'customer_name', 'العميل': 'customer_name', 'اسم المستلم': 'customer_name', 'المستلم': 'customer_name',
  'رقم الهاتف': 'customer_phone', 'الهاتف': 'customer_phone', 'الموبايل': 'customer_phone', 'customer_phone': 'customer_phone', 'phone': 'customer_phone', 'موبايل': 'customer_phone', 'رقم': 'customer_phone', 'تليفون': 'customer_phone', 'mobile': 'customer_phone', 'موبايل المستلم': 'customer_phone',
  'كود العميل': 'customer_code', 'الكود': 'customer_code', 'customer_code': 'customer_code', 'code': 'customer_code', 'كود': 'customer_code', 'البوليصة': 'customer_code', 'بوليصة': 'customer_code',
  'المنتج': 'product_name', 'اسم المنتج': 'product_name', 'product_name': 'product_name', 'product': 'product_name', 'منتج': 'product_name',
  'الكمية': 'quantity', 'quantity': 'quantity', 'كمية': 'quantity', 'qty': 'quantity', 'كميه': 'quantity',
  'السعر': 'price', 'price': 'price', 'سعر': 'price', 'المبلغ': 'price', 'الاجمالي': 'price', 'total': 'price', 'amount': 'price', 'المطلوب سداده': 'price', 'المطلوب': 'price',
  'سعر التوصيل': 'delivery_price', 'الشحن': 'delivery_price', 'delivery_price': 'delivery_price', 'shipping': 'delivery_price', 'توصيل': 'delivery_price', 'شحن': 'delivery_price',
  'المحافظة': 'governorate', 'محافظة': 'governorate', 'مدينة': 'governorate', 'المدينة': 'governorate', 'city': 'governorate', 'governorate': 'governorate',
  'العنوان': 'address', 'address': 'address', 'عنوان': 'address', 'المنطقة': 'address', 'area': 'address',
  'اللون': 'color', 'color': 'color', 'لون': 'color',
  'المقاس': 'size', 'size': 'size', 'مقاس': 'size',
  'ملاحظات': 'notes', 'notes': 'notes', 'ملاحظة': 'notes', 'note': 'notes',
};

export default function ExcelImport() {
  const [selectedOffice, setSelectedOffice] = useState('');
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [excelColumns, setExcelColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({}); // excelCol -> systemField
  const [parsedOrders, setParsedOrders] = useState<ParsedOrder[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [globalShipping, setGlobalShipping] = useState<string>('');
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: offices = [] } = useQuery({
    queryKey: ['offices-for-import'],
    queryFn: async () => {
      const { data } = await supabase.from('offices').select('id, name').order('name');
      return data || [];
    },
  });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setParsedOrders([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        if (raw.length === 0) {
          toast.error('الملف فارغ');
          return;
        }

        const cols = Object.keys(raw[0]);
        setExcelColumns(cols);
        setRawData(raw);

        // Auto-map columns
        const autoMap: Record<string, string> = {};
        const usedFields = new Set<string>();
        for (const col of cols) {
          const hint = AUTO_MAP_HINTS[col.trim()];
          if (hint && !usedFields.has(hint)) {
            autoMap[col] = hint;
            usedFields.add(hint);
          }
        }
        setColumnMapping(autoMap);
        setStep('map');
        toast.success(`تم قراءة ${raw.length} صف و ${cols.length} عمود من الملف`);
      } catch {
        toast.error('خطأ في قراءة الملف');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleMappingChange = (excelCol: string, systemField: string) => {
    setColumnMapping(prev => {
      const updated = { ...prev };
      if (systemField === '_skip') {
        delete updated[excelCol];
      } else {
        // Remove any other column mapped to the same system field
        for (const key of Object.keys(updated)) {
          if (updated[key] === systemField && key !== excelCol) {
            delete updated[key];
          }
        }
        updated[excelCol] = systemField;
      }
      return updated;
    });
  };

  const applyMapping = () => {
    const orders: ParsedOrder[] = rawData.map((row) => {
      const order: Partial<ParsedOrder> = {};
      for (const [excelCol, systemField] of Object.entries(columnMapping)) {
        const val = row[excelCol];
        const key = systemField as keyof ParsedOrder;
        if (key === 'quantity') order[key] = parseInt(String(val)) || 1;
        else if (key === 'price' || key === 'delivery_price') {
          const cleaned = String(val).replace(/,/g, '');
          order[key] = parseFloat(cleaned) || 0;
        }
        else (order as any)[key] = String(val).trim();
      }
      // Concatenate governorate + address
      const gov = order.governorate || '';
      const addr = order.address || '';
      const fullAddress = gov && addr ? `${gov} - ${addr}` : gov || addr;

      return {
        customer_name: order.customer_name || '',
        customer_phone: order.customer_phone || '',
        customer_code: order.customer_code || '',
        product_name: order.product_name || 'بدون منتج',
        quantity: order.quantity || 1,
        price: order.price || 0,
        delivery_price: (order.delivery_price && order.delivery_price > 0) ? order.delivery_price : (globalShipping ? parseFloat(globalShipping) : 0),
        governorate: gov,
        address: fullAddress,
        color: order.color || '',
        size: order.size || '',
        notes: order.notes || '',
      };
    });

    const valid = orders.filter(o => o.customer_name && o.customer_phone && o.price > 0);
    const skipped = orders.length - valid.length;
    setParsedOrders(valid);
    setStep('preview');

    if (skipped > 0) {
      toast.warning(`تم تجاهل ${skipped} صف بدون اسم أو رقم أو سعر`);
    }
    toast.success(`تم تجهيز ${valid.length} أوردر صالح للاستيراد`);
  };

  const handleImport = async () => {
    if (!selectedOffice) { toast.error('اختر المكتب أولاً'); return; }
    if (parsedOrders.length === 0) { toast.error('لا توجد أوردرات للاستيراد'); return; }

    setImporting(true);
    setProgress(0);
    let success = 0;
    let failed = 0;
    const batchSize = 20;

    for (let i = 0; i < parsedOrders.length; i += batchSize) {
      const batch = parsedOrders.slice(i, i + batchSize).map((o) => ({
        customer_name: o.customer_name || 'بدون اسم',
        customer_phone: o.customer_phone || '',
        customer_code: o.customer_code || null,
        product_name: o.product_name || 'بدون منتج',
        quantity: o.quantity,
        price: o.price,
        delivery_price: o.delivery_price,
        address: o.address || '',
        color: o.color || '',
        size: o.size || '',
        notes: o.notes || '',
        office_id: selectedOffice,
      }));

      const { data, error } = await supabase.from('orders').insert(batch).select('id');
      if (error) failed += batch.length;
      else success += data.length;
      setProgress(Math.round(((i + batchSize) / parsedOrders.length) * 100));
    }

    setResult({ success, failed });
    setImporting(false);
    setProgress(100);
    if (failed === 0) toast.success(`تم استيراد ${success} أوردر بنجاح`);
    else toast.error(`نجح ${success} وفشل ${failed}`);
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['اسم العميل', 'رقم الهاتف', 'كود العميل', 'المنتج', 'الكمية', 'السعر', 'سعر التوصيل', 'العنوان', 'اللون', 'المقاس', 'ملاحظات'],
      ['أحمد محمد', '01012345678', 'C001', 'تيشيرت', 2, 250, 50, 'القاهرة - المعادي', 'أسود', 'L', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Orders');
    XLSX.writeFile(wb, 'نموذج_استيراد_الأوردرات.xlsx');
  };

  const resetImport = () => {
    setStep('upload');
    setRawData([]);
    setExcelColumns([]);
    setColumnMapping({});
    setParsedOrders([]);
    setFileName('');
    setResult(null);
    setGlobalShipping('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const mappedRequiredFields = SYSTEM_FIELDS.filter(f => f.required).every(f =>
    Object.values(columnMapping).includes(f.key)
  );

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">استيراد أوردرات من Excel</h1>
        <div className="flex gap-2">
          {step !== 'upload' && (
            <Button variant="outline" size="sm" onClick={resetImport}>
              ملف جديد
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4 ml-1" />
            تحميل النموذج
          </Button>
        </div>
      </div>

      {/* Step 1: Upload */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">إعدادات الاستيراد</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">اختر المكتب</label>
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="bg-secondary border-border">
                  <SelectValue placeholder="اختر المكتب..." />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">سعر الشحن (لكل الأوردرات)</label>
              <input
                type="number"
                value={globalShipping}
                onChange={(e) => setGlobalShipping(e.target.value)}
                placeholder="مثلاً 70"
                className="flex h-10 w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">ملف Excel</label>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} className="hidden" />
              <Button
                variant="outline"
                className="w-full border-dashed border-2 border-border h-10"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4 ml-1" />
                {fileName || 'اختر ملف Excel'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Column Mapping */}
      {step === 'map' && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              ربط الأعمدة - حدد كل عمود في الملف يقابل إيه في النظام
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              الحقول المطلوبة: اسم العميل، رقم الهاتف، السعر. باقي الحقول اختيارية.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {excelColumns.map((col) => (
                <div key={col} className="flex items-center gap-2 p-2 rounded-md bg-secondary/50">
                  <span className="text-sm font-medium min-w-[80px] truncate flex-1" title={col}>
                    {col}
                  </span>
                  <span className="text-muted-foreground text-xs">←</span>
                  <Select
                    value={columnMapping[col] || '_skip'}
                    onValueChange={(val) => handleMappingChange(col, val)}
                  >
                    <SelectTrigger className="w-[160px] h-8 text-xs bg-background">
                      <SelectValue placeholder="تجاهل" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_skip">⏭ تجاهل</SelectItem>
                      {SYSTEM_FIELDS.map((f) => {
                        const isMapped = Object.entries(columnMapping).some(
                          ([k, v]) => v === f.key && k !== col
                        );
                        return (
                          <SelectItem key={f.key} value={f.key} disabled={isMapped}>
                            {f.label} {f.required ? '⭐' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Sample data preview */}
            {rawData.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">عينة من أول صف:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                  {excelColumns.map((col) => (
                    <div key={col} className="flex gap-1">
                      <span className="text-muted-foreground">{col}:</span>
                      <span className="font-medium truncate">{String(rawData[0][col] || '-')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={applyMapping} disabled={!mappedRequiredFields} className="w-full mt-2">
              {mappedRequiredFields
                ? `تطبيق الربط ومعاينة ${rawData.length} صف`
                : 'حدد الحقول المطلوبة (اسم، رقم، سعر) أولاً'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Preview & Import */}
      {step === 'preview' && parsedOrders.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              معاينة البيانات ({parsedOrders.length} أوردر)
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep('map')}>
                تعديل الربط
              </Button>
              <Button onClick={handleImport} disabled={importing || !selectedOffice} size="sm">
                {importing ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : <Upload className="h-4 w-4 ml-1" />}
                {importing ? 'جاري...' : `استيراد ${parsedOrders.length}`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {importing && (
              <div className="px-4 pb-3">
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1 text-center">{progress}%</p>
              </div>
            )}

            {result && (
              <div className="px-4 pb-3 flex gap-3">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle2 className="h-3 w-3 ml-1" />
                  نجح: {result.success}
                </Badge>
                {result.failed > 0 && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 ml-1" />
                    فشل: {result.failed}
                  </Badge>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">الهاتف</TableHead>
                    <TableHead className="text-right">الكود</TableHead>
                    <TableHead className="text-right">المنتج</TableHead>
                    <TableHead className="text-right">الكمية</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right">التوصيل</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedOrders.slice(0, 50).map((o, i) => (
                    <TableRow key={i} className="border-border">
                      <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{o.customer_name || '-'}</TableCell>
                      <TableCell className="text-sm" dir="ltr">{o.customer_phone || '-'}</TableCell>
                      <TableCell className="text-sm">{o.customer_code || '-'}</TableCell>
                      <TableCell className="text-sm">{o.product_name}</TableCell>
                      <TableCell className="text-sm">{o.quantity}</TableCell>
                      <TableCell className="text-sm font-bold">{o.price}</TableCell>
                      <TableCell className="text-sm">{o.delivery_price}</TableCell>
                      <TableCell className="text-sm" title={o.address}>{o.address || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {parsedOrders.length > 50 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  يتم عرض أول 50 أوردر فقط... الباقي ({parsedOrders.length - 50}) سيتم استيرادهم أيضاً
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'upload' && !fileName && (
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center space-y-3">
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">ارفع ملف Excel لاستيراد الأوردرات</p>
              <p className="text-sm text-muted-foreground mt-1">
                بعد رفع الملف هتقدر تربط كل عمود بالحقل المناسب في النظام
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                يدعم أي ملف Excel بأي أسماء أعمدة
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
