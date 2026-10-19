import { RunDto } from '@app/shared';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api-client';
import { formatDateTime } from '@/lib/format';
import { useDocuments, usePresets } from '../documents/queries';
import { useRun } from '../runs/queries';

/** Pick a document and two of its completed runs; `from` preselects a run (and its document). */
export function RunPicker({ from }: { from?: string }) {
  const navigate = useNavigate();
  const documents = useDocuments();
  const presets = usePresets();
  const fromRun = useRun(from ?? '');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [a, setA] = useState<string | undefined>(from);
  const [b, setB] = useState<string | undefined>();
  useEffect(() => {
    if (from && fromRun.data) setDocumentId(fromRun.data.documentId);
  }, [from, fromRun.data]);
  const runs = useQuery({
    queryKey: ['runs', documentId],
    queryFn: () => api.get(`/runs?documentId=${documentId}`, z.array(RunDto)),
    enabled: Boolean(documentId),
  });
  const completed = (runs.data ?? []).filter((r) => r.status === 'completed');
  const presetName = (id: string | null) => presets.data?.find((p) => p.id === id)?.name ?? 'Preset removido';
  const runOptions = completed.map((r) => ({
    value: r.id,
    label: `${presetName(r.presetId)} · ${formatDateTime(r.createdAt)}${r.label ? ` · ${r.label}` : ''}`,
  }));

  const runSelect = (
    id: string,
    label: string,
    value: string | undefined,
    onChange: (v: string) => void,
    exclude?: string,
  ) => (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} disabled={!documentId}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Escolha uma execução concluída" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {runOptions.map((o) => (
              <SelectItem key={o.value} value={o.value} disabled={o.value === exclude}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Escolha duas execuções</CardTitle>
        <CardDescription>Compare duas execuções concluídas do mesmo documento.</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="compare-document">Documento</FieldLabel>
            <Select
              value={documentId}
              onValueChange={(v) => {
                setDocumentId(v);
                setA(undefined);
                setB(undefined);
              }}
            >
              <SelectTrigger id="compare-document" className="w-full">
                <SelectValue placeholder="Escolha um documento" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {(documents.data ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.filename}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            {documentId && completed.length < 2 && (
              <FieldDescription>Este documento ainda não tem duas execuções concluídas.</FieldDescription>
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {runSelect('compare-a', 'Execução A', a, setA, b)}
            {runSelect('compare-b', 'Execução B', b, setB, a)}
          </div>
        </FieldGroup>
      </CardContent>
      <CardFooter>
        <Button
          disabled={!a || !b}
          onClick={() => a && b && navigate({ to: '/compare', search: { runs: `${a},${b}` } })}
        >
          Comparar
        </Button>
      </CardFooter>
    </Card>
  );
}
