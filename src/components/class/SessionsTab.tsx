import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Calendar, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

interface Session { id: string; date: string; }
interface Student { id: string; student_id: string; first_name: string; last_name: string; }
interface AttendanceRecord { student_id: string; status: 'present' | 'absent' | 'late'; }

export default function SessionsTab({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [attendance, setAttendance] = useState<Record<string, 'present' | 'absent' | 'late'>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const [{ data: sessData }, { data: studData }] = await Promise.all([
      supabase.from('sessions').select('id, date').eq('class_id', classId).order('date', { ascending: false }),
      supabase.from('students').select('id, student_id, first_name, last_name').eq('class_id', classId).order('student_id'),
    ]);
    setSessions(sessData || []);
    setStudents(studData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [classId]);

  const createSession = async () => {
    const { error } = await supabase.from('sessions').insert({ class_id: classId, date: new Date().toISOString().split('T')[0] });
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.success'));
    fetchData();
  };

  const openAttendance = async (session: Session) => {
    setSelectedSession(session);
    const { data } = await supabase.from('attendance').select('student_id, status').eq('session_id', session.id);
    const map: Record<string, 'present' | 'absent' | 'late'> = {};
    students.forEach(s => { map[s.id] = 'absent'; });
    data?.forEach(a => { map[a.student_id] = a.status as 'present' | 'absent' | 'late'; });
    setAttendance(map);
  };

  const saveAttendance = async () => {
    if (!selectedSession) return;
    setSaving(true);
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      session_id: selectedSession.id,
      student_id,
      status,
    }));
    
    // Delete existing then insert
    await supabase.from('attendance').delete().eq('session_id', selectedSession.id);
    const { error } = await supabase.from('attendance').insert(records);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.success'));
    setSelectedSession(null);
  };

  const statusColor = (s: string) => {
    if (s === 'present') return 'bg-accent text-accent-foreground';
    if (s === 'late') return 'bg-secondary text-secondary-foreground';
    return 'bg-destructive/10 text-destructive';
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t('sessions.title')}</h3>
        <Button onClick={createSession} className="gap-2" disabled={students.length === 0}>
          <Plus className="h-4 w-4" /> {t('sessions.newSession')}
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{t('sessions.noSessions')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map(s => (
            <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openAttendance(s)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{format(new Date(s.date), 'PPP')}</p>
                    <p className="text-xs text-muted-foreground">{t('sessions.markAttendance')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Attendance Dialog */}
      <Dialog open={!!selectedSession} onOpenChange={() => setSelectedSession(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('sessions.attendance')} — {selectedSession && format(new Date(selectedSession.date), 'PPP')}</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('students.studentId')}</TableHead>
                <TableHead>{t('students.firstName')}</TableHead>
                <TableHead>{t('students.lastName')}</TableHead>
                <TableHead>{t('sessions.attendance')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono">{s.student_id}</TableCell>
                  <TableCell>{s.first_name}</TableCell>
                  <TableCell>{s.last_name}</TableCell>
                  <TableCell>
                    <RadioGroup
                      value={attendance[s.id] || 'absent'}
                      onValueChange={v => setAttendance(a => ({ ...a, [s.id]: v as any }))}
                      className="flex gap-3"
                    >
                      {(['present', 'absent', 'late'] as const).map(status => (
                        <div key={status} className="flex items-center gap-1">
                          <RadioGroupItem value={status} id={`${s.id}-${status}`} />
                          <Label htmlFor={`${s.id}-${status}`} className="text-xs">
                            <Badge variant="outline" className={statusColor(status)}>
                              {t(`sessions.${status}`)}
                            </Badge>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSession(null)}>{t('common.cancel')}</Button>
            <Button onClick={saveAttendance} disabled={saving}>
              {saving ? t('common.loading') : t('sessions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
