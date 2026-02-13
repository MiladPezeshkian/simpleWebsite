import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, BookOpen, Users, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ClassItem {
  id: string;
  name: string;
  code: string;
  term: string;
  student_count: number;
  session_count: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', term: '' });
  const [creating, setCreating] = useState(false);

  const fetchClasses = async () => {
    if (!user) return;
    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, code, term')
      .order('created_at', { ascending: false });

    if (classData) {
      const items: ClassItem[] = await Promise.all(
        classData.map(async (c) => {
          const { count: sc } = await supabase.from('students').select('*', { count: 'exact', head: true }).eq('class_id', c.id);
          const { count: sessc } = await supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('class_id', c.id);
          return { ...c, student_count: sc || 0, session_count: sessc || 0 };
        })
      );
      setClasses(items);
    }
    setLoading(false);
  };

  useEffect(() => { fetchClasses(); }, [user]);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    const { error } = await supabase.from('classes').insert({
      name: form.name,
      code: form.code,
      term: form.term,
      professor_id: user.id,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.success'));
    setShowCreate(false);
    setForm({ name: '', code: '', term: '' });
    fetchClasses();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-foreground">
              {t('dashboard.welcome')}, {profile?.name || ''}
            </h2>
            <p className="text-muted-foreground mt-1">{t('dashboard.myClasses')}</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> {t('dashboard.createClass')}
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : classes.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <BookOpen className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t('dashboard.noClasses')}</h3>
              <p className="text-muted-foreground mb-4">{t('dashboard.noClassesDesc')}</p>
              <Button onClick={() => setShowCreate(true)} className="gap-2">
                <Plus className="h-4 w-4" /> {t('dashboard.createClass')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {classes.map(c => (
              <Card
                key={c.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 border-s-4 border-s-primary"
                onClick={() => navigate(`/class/${c.id}`)}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-xl">{c.name}</CardTitle>
                  <CardDescription>{c.code} · {c.term}</CardDescription>
                </CardHeader>
                <CardContent className="flex gap-6 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" /> {c.student_count} {t('dashboard.students')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> {c.session_count} {t('dashboard.sessions')}
                  </span>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('class.create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('class.name')}</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('class.code')}</Label>
              <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('class.term')}</Label>
              <Input value={form.term} onChange={e => setForm(f => ({ ...f, term: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={creating || !form.name || !form.code || !form.term}>
              {creating ? t('common.loading') : t('class.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
