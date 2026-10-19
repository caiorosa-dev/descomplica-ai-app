import { createContext, useContext } from 'react';

export interface SourceSpan {
  start: number;
  end: number;
  page: number | null;
}

export const SourceSheetContext = createContext<{ open: (span: SourceSpan) => void } | null>(null);

export function useSourceSheet() {
  const ctx = useContext(SourceSheetContext);
  if (!ctx) throw new Error('useSourceSheet must be used inside SourceSheetProvider');
  return ctx;
}
