'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { FormDialog } from '@/components/shared/form-dialog';
import { Button } from '@/components/ui/button';
import { api, downloadFile, getErrorMessage } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ImportResult {
  created: number;
  failed: number;
  errors: Array<{ row: number; message: string }>;
  credentials: Array<{ email: string; temporaryPassword: string }>;
}

/**
 * CSV import.
 * The browser reads the file locally and posts its text as JSON, so no
 * multipart upload or temp file handling is needed for student data.
 */
export const ImportStudentsDialog = ({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setFileName(null);
    setCsv('');
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > 5 * 1024 * 1024) {
      setError('The file is larger than 5 MB. Split it into smaller batches.');
      return;
    }
    const text = await file.text();
    setFileName(file.name);
    setCsv(text);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!csv) {
      setError('Choose a CSV file first');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await api.post<ImportResult>('/students/import', { csv });
      setResult(data);
      onImported();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) reset();
      }}
      title="Import students"
      description="Upload a CSV to enrol many students at once. Each row creates a login account."
      submitLabel={result ? 'Import another file' : 'Import students'}
      submitting={submitting}
      onSubmit={submit}
    >
      <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-surface-subtle/60 px-3 py-2.5">
        <div>
          <p className="text-[12.5px] font-medium text-ink">Need the format?</p>
          <p className="text-[11px] text-muted-foreground">Download the template with all required columns.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void downloadFile('/students/import-template', 'student-import-template.csv')}
        >
          <Download className="h-3.5 w-3.5" /> Template
        </Button>
      </div>

      <label
        htmlFor="csv-file"
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line-strong bg-surface-subtle/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary-soft/30',
        )}
      >
        <FileSpreadsheet className="mb-2 h-6 w-6 text-primary" strokeWidth={1.6} />
        <span className="text-[12.5px] font-medium text-ink">
          {fileName ?? 'Choose a CSV file'}
        </span>
        <span className="mt-0.5 text-[11px] text-muted-foreground">
          Required: name, email, enrollmentNumber, departmentCode, courseCode, semesterNumber, sectionName, admissionYear
        </span>
        <input
          ref={inputRef}
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </label>

      {error ? (
        <p className="rounded-lg border border-danger/20 bg-danger-soft px-3 py-2 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="space-y-2.5">
          <div className="flex gap-2">
            <div className="flex-1 rounded-xl bg-success-soft px-3 py-2 text-center">
              <p className="font-display text-lg font-semibold text-success">{result.created}</p>
              <p className="text-[10.5px] text-success/80">Imported</p>
            </div>
            <div className="flex-1 rounded-xl bg-danger-soft px-3 py-2 text-center">
              <p className="font-display text-lg font-semibold text-danger">{result.failed}</p>
              <p className="text-[10.5px] text-danger/80">Failed</p>
            </div>
          </div>

          {result.errors.length > 0 ? (
            <div className="max-h-32 overflow-y-auto rounded-xl border border-line">
              <ul className="divide-y divide-line">
                {result.errors.map((row) => (
                  <li key={`${row.row}-${row.message}`} className="px-3 py-1.5 text-[11.5px] text-ink-soft">
                    <span className="font-medium text-danger">Row {row.row}:</span> {row.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.credentials.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-xl border border-line bg-surface-subtle/60 p-2.5">
              <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-ink">
                <Upload className="h-3 w-3" /> Temporary passwords (shown once)
              </p>
              <ul className="space-y-1 font-mono text-[11px] text-ink-soft">
                {result.credentials.map((credential) => (
                  <li key={credential.email}>
                    {credential.email} — {credential.temporaryPassword}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </FormDialog>
  );
};
