import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Save, GraduationCap } from 'lucide-react';

interface Student { id: string; student_id: string; first_name: string; last_name: string; }
interface GradeRow { student_id: string; midterm: number; final: number; activity: number; }

export default function GradesTab({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: studData }, { data: gradeData }] = await Promise.all([
        supabase.from('students').select('id, student_id, first_name, last_name').eq('class_id', classId).order('student_id'),
        supabase.from('grades').select('student_id, midterm, final, activity').eq('class_id', classId),
      ]);
      setStudents(studData || []);
      const map: Record<string, GradeRow> = {};
      (studData || []).forEach(s => {
        const g = gradeData?.find(g => g.student_id === s.id);
        map[s.id] = {
          student_id: s.id,
          midterm: g?.midterm ?? 0,
          final: g?.final ?? 0,
          activity: g?.activity ?? 0,
        };
      });
      setGrades(map);
      setLoading(false);
    };
    fetch();
  }, [classId]);

  const updateGrade = (studentId: string, field: 'midterm' | 'final' | 'activity', value: string) => {
    const num = Math.max(0, Math.min(100, Number(value) || 0));
    setGrades(g => ({ ...g, [studentId]: { ...g[studentId], [field]: num } }));
  };

  const saveGrades = async () => {
    setSaving(true);
    const rows = Object.values(grades).map(g => ({
      class_id: classId,
      student_id: g.student_id,
      midterm: g.midterm,
      final: g.final,
      activity: g.activity,
    }));

    const { error } = await supabase.from('grades').upsert(rows, { onConflict: 'class_id,student_id' });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.success'));
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (students.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">{t('grades.noGrades')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('grades.title')}</h3>
        <Button onClick={saveGrades} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? t('common.loading') : t('grades.save')}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('students.studentId')}</TableHead>
                  <TableHead>{t('students.firstName')}</TableHead>
                  <TableHead>{t('students.lastName')}</TableHead>
                  <TableHead className="w-24">{t('grades.midterm')}</TableHead>
                  <TableHead className="w-24">{t('grades.final')}</TableHead>
                  <TableHead className="w-24">{t('grades.activity')}</TableHead>
                  <TableHead className="w-24">{t('grades.total')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(s => {
                  const g = grades[s.id];
                  const total = (g?.midterm || 0) + (g?.final || 0) + (g?.activity || 0);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.student_id}</TableCell>
                      <TableCell>{s.first_name}</TableCell>
                      <TableCell>{s.last_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} max={100}
                          value={g?.midterm || 0}
                          onChange={e => updateGrade(s.id, 'midterm', e.target.value)}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} max={100}
                          value={g?.final || 0}
                          onChange={e => updateGrade(s.id, 'final', e.target.value)}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={0} max={100}
                          value={g?.activity || 0}
                          onChange={e => updateGrade(s.id, 'activity', e.target.value)}
                          className="h-8 w-20"
                        />
                      </TableCell>
                      <TableCell className="font-bold">{total}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
