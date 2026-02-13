import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import StudentsTab from '@/components/class/StudentsTab';
import SessionsTab from '@/components/class/SessionsTab';
import GradesTab from '@/components/class/GradesTab';
import ReportsTab from '@/components/class/ReportsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, Home } from 'lucide-react';

interface ClassInfo {
  id: string;
  name: string;
  code: string;
  term: string;
}

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from('classes').select('id, name, code, term').eq('id', id).single()
      .then(({ data }) => { setClassInfo(data); setLoading(false); });
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!classInfo) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
          <Link to="/dashboard" className="hover:text-primary flex items-center gap-1">
            <Home className="h-4 w-4" /> {t('nav.dashboard')}
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{classInfo.name}</span>
        </nav>

        <div className="mb-6">
          <h2 className="text-3xl font-bold">{classInfo.name}</h2>
          <p className="text-muted-foreground">{classInfo.code} · {classInfo.term}</p>
        </div>

        <Tabs defaultValue="students">
          <TabsList className="mb-6">
            <TabsTrigger value="students">{t('students.title')}</TabsTrigger>
            <TabsTrigger value="sessions">{t('sessions.title')}</TabsTrigger>
            <TabsTrigger value="grades">{t('grades.title')}</TabsTrigger>
            <TabsTrigger value="reports">{t('reports.title')}</TabsTrigger>
          </TabsList>

          <TabsContent value="students">
            <StudentsTab classId={classInfo.id} />
          </TabsContent>
          <TabsContent value="sessions">
            <SessionsTab classId={classInfo.id} />
          </TabsContent>
          <TabsContent value="grades">
            <GradesTab classId={classInfo.id} />
          </TabsContent>
          <TabsContent value="reports">
            <ReportsTab classId={classInfo.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
