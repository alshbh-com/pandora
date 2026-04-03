import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLogger';
import { Plus, Lock, Unlock, Trash2, ArrowRight, Calendar, FileText, Archive } from 'lucide-react';
import { format } from 'date-fns';

export default function OfficeDiaries() {
  const { officeId } = useParams<{ officeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: office } = useQuery({
    queryKey: ['office', officeId],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('*').eq('id', officeId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  const { data: diaries = [], isLoading } = useQuery({
    queryKey: ['diaries', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .select('*')
        .eq('office_id', officeId!)
        .order('diary_number', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!officeId,
  });

  const { data: orderCounts = {} } = useQuery({
    queryKey: ['diary-order-counts', officeId, diaries.map((d: any) => d.id).join(',')],
    queryFn: async () => {
      const diaryIds = diaries.map((d: any) => d.id);
      if (diaryIds.length === 0) return {};
      const { data, error } = await supabase
        .from('diary_orders')
        .select('diary_id')
        .in('diary_id', diaryIds);
      if (error) throw error;
      const counts: Record<string, number> = {};
      data.forEach((d: any) => { counts[d.diary_id] = (counts[d.diary_id] || 0) + 1; });
      return counts;
    },
    enabled: diaries.length > 0,
  });

  const createDiary = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('diaries')
        .insert({ office_id: officeId!, diary_date: new Date().toISOString().split('T')[0] })
        .select()
        .single();
      if (error) throw error;
      await logActivity('إنشاء يومية', { diary_id: data.id, office_id: officeId });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم إنشاء يومية جديدة');
    },
    onError: () => toast.error('فشل إنشاء اليومية'),
  });

  const toggleClose = useMutation({
    mutationFn: async (diary: any) => {
      const newClosed = !diary.is_closed;
      const { error } = await supabase
        .from('diaries')
        .update({ is_closed: newClosed, closed_at: newClosed ? new Date().toISOString() : null })
        .eq('id', diary.id);
      if (error) throw error;
      await logActivity(newClosed ? 'قفل يومية' : 'إعادة فتح يومية', { diary_id: diary.id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم تحديث حالة اليومية');
    },
  });

  const deleteDiary = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('diaries').delete().eq('id', id);
      if (error) throw error;
      await logActivity('حذف يومية', { diary_id: id });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diaries', officeId] });
      toast.success('تم حذف اليومية');
    },
  });

  const filterDiaries = (list: any[]) => {
    return list.filter((d: any) => {
      if (dateFilter && d.diary_date !== dateFilter) return false;
      if (statusFilter === 'locked' && !d.lock_status_updates) return false;
      if (statusFilter === 'prevented' && !d.prevent_new_orders) return false;
      return true;
    });
  };

  const allFiltered = filterDiaries(diaries);
  const openDiaries = filterDiaries(diaries.filter((d: any) => !d.is_closed && !d.is_archived));
  const closedDiaries = filterDiaries(diaries.filter((d: any) => d.is_closed && !d.is_archived));
  const archivedDiaries = filterDiaries(diaries.filter((d: any) => d.is_archived));

  const renderDiaryCard = (diary: any) => (
    <Card key={diary.id} className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            يومية رقم {diary.diary_number}
            <span className="text-sm text-muted-foreground font-normal">
              ({(orderCounts as any)[diary.id] || 0} أوردر)
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {diary.lock_status_updates && <Badge variant="destructive" className="text-xs">مجمدة</Badge>}
            {diary.prevent_new_orders && <Badge variant="secondary" className="text-xs">ممنوع الإضافة</Badge>}
            <Badge variant={diary.is_closed ? 'secondary' : diary.is_archived ? 'outline' : 'default'} className="text-xs">
              {diary.is_archived ? 'مؤرشفة' : diary.is_closed ? 'مقفولة' : 'مفتوحة'}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            {format(new Date(diary.diary_date), 'dd/MM/yyyy')}
            {diary.closed_at && (
              <span className="mr-2">| قفلت: {format(new Date(diary.closed_at), 'dd/MM/yyyy')}</span>
            )}
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={() => navigate(`/accounting-system/offices/${officeId}/diary/${diary.id}`)}>
              فتح
            </Button>
            <Button size="sm" variant="ghost" onClick={() => toggleClose.mutate(diary)} title={diary.is_closed ? 'إعادة فتح' : 'قفل'}>
              {diary.is_closed ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
              if (confirm('هل أنت متأكد من حذف هذه اليومية وجميع بياناتها؟')) deleteDiary.mutate(diary.id);
            }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/accounting-system')}>
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">يوميات {office?.name || '...'}</h1>
            <p className="text-muted-foreground text-sm">إجمالي اليوميات: {diaries.length} (مفتوحة: {openDiaries.length} | مقفولة: {closedDiaries.length})</p>
          </div>
        </div>
        <Button onClick={() => createDiary.mutate()} disabled={createDiary.isPending}>
          <Plus className="h-4 w-4 ml-1" />
          يومية جديدة
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="كل الحالات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="locked">مجمدة فقط</SelectItem>
            <SelectItem value="prevented">ممنوع الإضافة</SelectItem>
          </SelectContent>
        </Select>
        {(dateFilter || statusFilter !== 'all') && (
          <Button variant="ghost" size="sm" onClick={() => { setDateFilter(''); setStatusFilter('all'); }}>
            مسح الفلاتر
          </Button>
        )}
      </div>

      <Tabs defaultValue="all" dir="rtl">
        <TabsList>
          <TabsTrigger value="all">الكل ({allFiltered.length})</TabsTrigger>
          <TabsTrigger value="open">المفتوحة ({openDiaries.length})</TabsTrigger>
          <TabsTrigger value="closed">المقفولة ({closedDiaries.length})</TabsTrigger>
          <TabsTrigger value="archived">المؤرشفة ({archivedDiaries.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all" className="space-y-3 mt-4">
          {allFiltered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات</p>
          ) : allFiltered.map(renderDiaryCard)}
        </TabsContent>
        <TabsContent value="open" className="space-y-3 mt-4">
          {openDiaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات مفتوحة</p>
          ) : openDiaries.map(renderDiaryCard)}
        </TabsContent>
        <TabsContent value="closed" className="space-y-3 mt-4">
          {closedDiaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات مقفولة</p>
          ) : closedDiaries.map(renderDiaryCard)}
        </TabsContent>
        <TabsContent value="archived" className="space-y-3 mt-4">
          {archivedDiaries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد يوميات مؤرشفة</p>
          ) : archivedDiaries.map(renderDiaryCard)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
