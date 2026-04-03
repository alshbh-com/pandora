import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { ArrowRight, Lock, Unlock, Ban, Check, Download, Share2, Archive } from 'lucide-react';
import { format } from 'date-fns';
import FinancialSheet from '@/components/diary/FinancialSheet';
import OrangeSheet from '@/components/diary/OrangeSheet';
import CopyOrderDialog from '@/components/diary/CopyOrderDialog';
import { exportDiaryToPDF, exportDiaryToExcel, shareDiaryWhatsApp } from '@/lib/diaryExport';

export default function DiaryView() {
  const { officeId, diaryId } = useParams<{ officeId: string; diaryId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState<'financial' | 'orange'>('financial');

  const { data: diary, isLoading: diaryLoading } = useQuery({
    queryKey: ['diary', diaryId],
    queryFn: async () => {
      const { data, error } = await supabase.from('diaries').select('*').eq('id', diaryId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!diaryId,
  });

  const { data: office } = useQuery({
    queryKey: ['office', officeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('*').eq('id', officeId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  const { data: diaryOrders = [] } = useQuery({
    queryKey: ['diary-orders', diaryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diary_orders')
        .select('*, orders(*)')
        .eq('diary_id', diaryId!);
      if (error) throw error;
      return data;
    },
    enabled: !!diaryId,
  });

  const toggleLock = useMutation({
    mutationFn: async () => {
      const newVal = !diary?.lock_status_updates;
      const { error } = await supabase.from('diaries').update({ lock_status_updates: newVal }).eq('id', diaryId!);
      if (error) throw error;
      await logActivity(newVal ? 'تجميد تحديث الحالات' : 'إلغاء تجميد الحالات', { diary_id: diaryId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', diaryId] });
      toast.success('تم التحديث');
    },
  });

  const togglePrevent = useMutation({
    mutationFn: async () => {
      const newVal = !diary?.prevent_new_orders;
      const { error } = await supabase.from('diaries').update({ prevent_new_orders: newVal }).eq('id', diaryId!);
      if (error) throw error;
      await logActivity(newVal ? 'منع إضافة أوردرات' : 'السماح بإضافة أوردرات', { diary_id: diaryId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', diaryId] });
      toast.success('تم التحديث');
    },
  });

  const toggleClose = useMutation({
    mutationFn: async () => {
      const newClosed = !diary?.is_closed;
      const { error } = await supabase
        .from('diaries')
        .update({ is_closed: newClosed, closed_at: newClosed ? new Date().toISOString() : null })
        .eq('id', diaryId!);
      if (error) throw error;
      await logActivity(newClosed ? 'قفل يومية' : 'إعادة فتح يومية', { diary_id: diaryId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', diaryId] });
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success(diary?.is_closed ? 'تم إعادة فتح اليومية' : 'تم قفل اليومية');
    },
  });

  const handleCopyOrder = (orderId: string) => {
    setSelectedOrderId(orderId);
    setCopyDialogOpen(true);
  };

  if (diaryLoading) return <div className="p-8 text-center">جاري التحميل...</div>;
  if (!diary) return <div className="p-8 text-center">اليومية غير موجودة</div>;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/accounting-system/offices/${officeId}`)}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {office?.name} - يومية رقم {diary.diary_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {format(new Date(diary.diary_date), 'dd/MM/yyyy')} | {diaryOrders.length} أوردر
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Close/Reopen */}
          <Button
            size="sm"
            variant={diary.is_closed ? 'default' : 'secondary'}
            onClick={() => toggleClose.mutate()}
          >
            {diary.is_closed ? <Unlock className="h-4 w-4 ml-1" /> : <Archive className="h-4 w-4 ml-1" />}
            {diary.is_closed ? 'إعادة فتح' : 'قفل اليومية'}
          </Button>

          {/* Lock Status Updates */}
          <Button
            size="sm"
            variant={diary.lock_status_updates ? 'destructive' : 'outline'}
            onClick={() => toggleLock.mutate()}
          >
            {diary.lock_status_updates ? <Unlock className="h-4 w-4 ml-1" /> : <Lock className="h-4 w-4 ml-1" />}
            {diary.lock_status_updates ? 'إلغاء التجميد' : 'تجميد الحالات'}
          </Button>

          {/* Prevent New Orders */}
          <Button
            size="sm"
            variant={diary.prevent_new_orders ? 'secondary' : 'outline'}
            onClick={() => togglePrevent.mutate()}
          >
            {diary.prevent_new_orders ? <Check className="h-4 w-4 ml-1" /> : <Ban className="h-4 w-4 ml-1" />}
            {diary.prevent_new_orders ? 'السماح بالإضافة' : 'منع الإضافة'}
          </Button>

          {/* Export */}
          <Button size="sm" variant="outline" onClick={() => exportDiaryToPDF(diary, diaryOrders, office?.name || '', activeSheet)}>
            <Download className="h-4 w-4 ml-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => exportDiaryToExcel(diary, diaryOrders, office?.name || '')}>
            <Download className="h-4 w-4 ml-1" /> Excel
          </Button>
          <Button size="sm" variant="outline" onClick={() => shareDiaryWhatsApp(diary, diaryOrders, office?.name || '')}>
            <Share2 className="h-4 w-4 ml-1" /> واتساب
          </Button>
        </div>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant={diary.is_closed ? 'secondary' : 'default'}>
          {diary.is_closed ? 'مقفولة' : 'مفتوحة'}
        </Badge>
        {diary.is_archived && <Badge variant="outline">مؤرشفة</Badge>}
        {diary.lock_status_updates && <Badge variant="destructive">الحالات مجمدة</Badge>}
        {diary.prevent_new_orders && <Badge variant="secondary">الإضافة ممنوعة</Badge>}
      </div>

      {/* Sheets */}
      <Tabs value={activeSheet} onValueChange={(v) => setActiveSheet(v as 'financial' | 'orange')} dir="rtl">
        <TabsList>
          <TabsTrigger value="financial">الشيت المالي</TabsTrigger>
          <TabsTrigger value="orange">الشيت البرتقالي</TabsTrigger>
        </TabsList>
        <TabsContent value="financial" className="mt-4">
          <FinancialSheet diary={diary} diaryOrders={diaryOrders} onCopyOrder={handleCopyOrder} />
        </TabsContent>
        <TabsContent value="orange" className="mt-4">
          <OrangeSheet diary={diary} diaryOrders={diaryOrders} onCopyOrder={handleCopyOrder} />
        </TabsContent>
      </Tabs>

      <CopyOrderDialog
        open={copyDialogOpen}
        onOpenChange={setCopyDialogOpen}
        orderId={selectedOrderId}
        currentDiaryId={diaryId!}
        officeId={officeId!}
      />
    </div>
  );
}
