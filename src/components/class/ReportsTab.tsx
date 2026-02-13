import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Users, TrendingUp, Award } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ReportsTab({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalStudents: 0, avgAttendance: 0, avgGrade: 0 });
  const [attendanceData, setAttendanceData] = useState<{ date: string; present: number; absent: number; late: number }[]>([]);
  const [gradeData, setGradeData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: studData }, { data: sessData }, { data: gradeDataRaw }] = await Promise.all([
        supabase.from('students').select('id').eq('class_id', classId),
        supabase.from('sessions').select('id, date').eq('class_id', classId).order('date'),
        supabase.from('grades').select('midterm, final, activity').eq('class_id', classId),
      ]);

      const totalStudents = studData?.length || 0;

      // Attendance per session
      const attData: typeof attendanceData = [];
      let totalPresent = 0, totalRecords = 0;
      for (const sess of (sessData || [])) {
        const { data: att } = await supabase.from('attendance').select('status').eq('session_id', sess.id);
        const p = att?.filter(a => a.status === 'present').length || 0;
        const l = att?.filter(a => a.status === 'late').length || 0;
        const ab = att?.filter(a => a.status === 'absent').length || 0;
        attData.push({ date: sess.date, present: p, absent: ab, late: l });
        totalPresent += p + l;
        totalRecords += (att?.length || 0);
      }
      setAttendanceData(attData);

      // Grade distribution
      const grades = (gradeDataRaw || []).map(g => (Number(g.midterm) || 0) + (Number(g.final) || 0) + (Number(g.activity) || 0));
      const avgGrade = grades.length ? grades.reduce((a, b) => a + b, 0) / grades.length : 0;
      const distribution = [
        { name: 'A (90-100)', value: grades.filter(g => g >= 90).length },
        { name: 'B (80-89)', value: grades.filter(g => g >= 80 && g < 90).length },
        { name: 'C (70-79)', value: grades.filter(g => g >= 70 && g < 80).length },
        { name: 'D (60-69)', value: grades.filter(g => g >= 60 && g < 70).length },
        { name: 'F (<60)', value: grades.filter(g => g < 60).length },
      ];
      setGradeData(distribution);

      setStats({
        totalStudents,
        avgAttendance: totalRecords ? Math.round((totalPresent / totalRecords) * 100) : 0,
        avgGrade: Math.round(avgGrade),
      });
      setLoading(false);
    };
    fetch();
  }, [classId]);

  const exportToExcel = async () => {
    const [{ data: studData }, { data: sessData }, { data: gradeDataRaw }] = await Promise.all([
      supabase.from('students').select('*').eq('class_id', classId).order('student_id'),
      supabase.from('sessions').select('id, date').eq('class_id', classId).order('date'),
      supabase.from('grades').select('*').eq('class_id', classId),
    ]);

    const rows: Record<string, any>[] = [];
    for (const s of (studData || [])) {
      const row: Record<string, any> = {
        'Student ID': s.student_id,
        'First Name': s.first_name,
        'Last Name': s.last_name,
        'Email': s.email || '',
      };
      for (const sess of (sessData || [])) {
        const { data: att } = await supabase.from('attendance').select('status').eq('session_id', sess.id).eq('student_id', s.id).single();
        row[sess.date] = att?.status || 'absent';
      }
      const grade = gradeDataRaw?.find(g => g.student_id === s.id);
      row['Midterm'] = grade?.midterm ?? 0;
      row['Final'] = grade?.final ?? 0;
      row['Activity'] = grade?.activity ?? 0;
      row['Total'] = (Number(grade?.midterm) || 0) + (Number(grade?.final) || 0) + (Number(grade?.activity) || 0);
      rows.push(row);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Class Report');
    XLSX.writeFile(wb, 'class-report.xlsx');
  };

  const COLORS = ['hsl(160,50%,40%)', 'hsl(215,72%,35%)', 'hsl(42,87%,55%)', 'hsl(30,90%,50%)', 'hsl(0,72%,51%)'];

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { icon: Users, label: t('reports.totalStudents'), value: stats.totalStudents, color: 'text-primary' },
          { icon: TrendingUp, label: t('reports.avgAttendance'), value: `${stats.avgAttendance}%`, color: 'text-accent' },
          { icon: Award, label: t('reports.avgGrade'), value: stats.avgGrade, color: 'text-secondary' },
        ].map((s, i) => (
          <Card key={i}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-muted ${s.color}`}>
                <s.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">{t('reports.attendanceTrend')}</CardTitle></CardHeader>
          <CardContent>
            {attendanceData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={attendanceData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="present" fill="hsl(160,50%,40%)" name={t('sessions.present')} />
                  <Bar dataKey="late" fill="hsl(42,87%,55%)" name={t('sessions.late')} />
                  <Bar dataKey="absent" fill="hsl(0,72%,51%)" name={t('sessions.absent')} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-8 text-muted-foreground">{t('sessions.noSessions')}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">{t('reports.gradeDistribution')}</CardTitle></CardHeader>
          <CardContent>
            {gradeData.some(g => g.value > 0) ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={gradeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {gradeData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-center py-8 text-muted-foreground">{t('grades.noGrades')}</p>}
          </CardContent>
        </Card>
      </div>

      <Button onClick={exportToExcel} className="gap-2">
        <Download className="h-4 w-4" /> {t('reports.export')}
      </Button>
    </div>
  );
}
