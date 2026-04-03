import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Building2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function DiaryOffices() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: offices = [], isLoading } = useQuery({
    queryKey: ['diary-offices'],
    queryFn: async () => {
      const { data, error } = await supabase.from('offices').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: diaryCounts = {} } = useQuery({
    queryKey: ['diary-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('diaries').select('office_id, is_closed, is_archived');
      if (error) throw error;
      const counts: Record<string, { open: number; closed: number; archived: number }> = {};
      data.forEach((d: any) => {
        if (!counts[d.office_id]) counts[d.office_id] = { open: 0, closed: 0, archived: 0 };
        if (d.is_archived) counts[d.office_id].archived++;
        else if (d.is_closed) counts[d.office_id].closed++;
        else counts[d.office_id].open++;
      });
      return counts;
    },
  });

  // Global search across diary orders
  const { data: searchResults = [] } = useQuery({
    queryKey: ['diary-global-search', searchTerm],
    queryFn: async () => {
      if (searchTerm.length < 2) return [];
      const { data, error } = await supabase
        .from('diary_orders')
        .select('*, orders(*), diaries(*, offices(name))')
        .or(`orders.customer_name.ilike.%${searchTerm}%,orders.barcode.ilike.%${searchTerm}%`, { referencedTable: 'orders' })
        .limit(20);
      if (error) throw error;
      return data?.filter((d: any) => d.orders) || [];
    },
    enabled: searchTerm.length >= 2,
  });

  const filteredOffices = offices.filter((o: any) =>
    !searchTerm || searchTerm.length < 2 || o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (isLoading) return <div className="p-8 text-center">جاري التحميل...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h2 className="text-xl font-bold text-foreground">المكاتب - نظام اليوميات</h2>
        <p className="text-muted-foreground mt-1">اختر مكتب لعرض اليوميات أو ابحث في كل الأوردرات</p>
      </div>

      {/* Global Search */}
      <div className="relative max-w-md">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="بحث بالباركود، اسم العميل، اسم المكتب..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Search Results */}
      {searchTerm.length >= 2 && searchResults.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">نتائج البحث ({searchResults.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الباركود</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المكتب</TableHead>
                    <TableHead className="text-right">يومية #</TableHead>
                    <TableHead className="text-right">الحالة في اليومية</TableHead>
                    <TableHead className="text-right">السعر</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchResults.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-mono text-sm">{d.orders?.barcode}</TableCell>
                      <TableCell className="text-sm">{d.orders?.customer_name}</TableCell>
                      <TableCell className="text-sm">{d.diaries?.offices?.name}</TableCell>
                      <TableCell className="text-sm">{d.diaries?.diary_number}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{d.status_inside_diary}</Badge></TableCell>
                      <TableCell className="text-sm font-medium">{d.orders?.price}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost"
                          onClick={() => navigate(`/accounting-system/offices/${d.diaries?.office_id}/diary/${d.diary_id}`)}>
                          فتح
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Office Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOffices.map((office: any) => {
          const counts = (diaryCounts as any)[office.id] || { open: 0, closed: 0, archived: 0 };
          return (
            <Card
              key={office.id}
              className="cursor-pointer hover:shadow-lg transition-shadow border-border"
              onClick={() => navigate(`/accounting-system/offices/${office.id}`)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    {office.name}
                  </div>
                  <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 text-sm">
                  <span className="text-green-600 dark:text-green-400">مفتوحة: {counts.open}</span>
                  <span className="text-muted-foreground">مقفولة: {counts.closed}</span>
                  {counts.archived > 0 && <span className="text-muted-foreground">مؤرشفة: {counts.archived}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
