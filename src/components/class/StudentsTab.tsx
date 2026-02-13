import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Upload, Search, Trash2, Users, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface Student {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
}

interface PreviewRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export default function StudentsTab({ classId }: { classId: string }) {
  const { t } = useTranslation();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewData, setPreviewData] = useState<PreviewRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    const { data } = await supabase
      .from('students')
      .select('id, student_id, first_name, last_name, email')
      .eq('class_id', classId)
      .order('student_id');
    setStudents(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchStudents(); }, [classId]);

  const parseExcel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target?.result, { type: 'binary' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      const rows: PreviewRow[] = json.map((r) => ({
        studentId: String(r.studentId || r['Student ID'] || r['student_id'] || ''),
        firstName: String(r.firstName || r['First Name'] || r['first_name'] || ''),
        lastName: String(r.lastName || r['Last Name'] || r['last_name'] || ''),
        email: r.email || r.Email || '',
      })).filter(r => r.studentId && r.firstName && r.lastName);

      if (rows.length === 0) {
        toast.error(t('common.error'));
        return;
      }
      setPreviewData(rows);
      setShowPreview(true);
    };
    reader.readAsBinaryString(file);
  };

  const handleFile = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    if (!file.name.match(/\.(xlsx?|csv)$/i)) {
      toast.error('Please upload an Excel file (.xlsx, .xls, .csv)');
      return;
    }
    parseExcel(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    handleFile(e.dataTransfer.files);
  };

  const confirmImport = async () => {
    setImporting(true);
    const rows = previewData.map(r => ({
      class_id: classId,
      student_id: r.studentId,
      first_name: r.firstName,
      last_name: r.lastName,
      email: r.email || null,
    }));

    const { error } = await supabase.from('students').upsert(rows, { onConflict: 'class_id,student_id' });
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${previewData.length} ${t('students.imported')}`);
    setShowPreview(false);
    setPreviewData([]);
    fetchStudents();
  };

  const removeStudent = async (id: string) => {
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.success'));
    fetchStudents();
  };

  const filtered = students.filter(s =>
    `${s.student_id} ${s.first_name} ${s.last_name} ${s.email || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
            onDragOver={e => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-medium text-foreground">{t('students.dragDrop')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('students.uploadDesc')}</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFile(e.target.files)} />
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="ps-10"
                placeholder={t('students.search')}
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> {students.length}
            </span>
          </div>

          {students.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet className="mx-auto h-12 w-12 mb-3" />
              <p>{t('students.noStudents')}</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('students.studentId')}</TableHead>
                    <TableHead>{t('students.firstName')}</TableHead>
                    <TableHead>{t('students.lastName')}</TableHead>
                    <TableHead>{t('students.email')}</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono">{s.student_id}</TableCell>
                      <TableCell>{s.first_name}</TableCell>
                      <TableCell>{s.last_name}</TableCell>
                      <TableCell className="text-muted-foreground">{s.email || '—'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeStudent(s.id)} className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{t('students.preview')} ({previewData.length} {t('dashboard.students')})</DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('students.studentId')}</TableHead>
                <TableHead>{t('students.firstName')}</TableHead>
                <TableHead>{t('students.lastName')}</TableHead>
                <TableHead>{t('students.email')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewData.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono">{r.studentId}</TableCell>
                  <TableCell>{r.firstName}</TableCell>
                  <TableCell>{r.lastName}</TableCell>
                  <TableCell>{r.email || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>{t('common.cancel')}</Button>
            <Button onClick={confirmImport} disabled={importing}>
              {importing ? t('common.loading') : t('students.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
