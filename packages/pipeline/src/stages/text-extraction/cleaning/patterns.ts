import type { BoilerplatePatternSet } from '@app/shared';

/** Named, versioned boilerplate expressions (spec §6.1, rule 4). A line matching any expression is removed. */
export const BOILERPLATE_PATTERN_SETS: Record<BoilerplatePatternSet, RegExp[]> = {
  'stj-e-signature': [
    /assinado eletronicamente/i,
    /c[óo]digo de controle/i,
    /site certificado/i,
    /^documento:?\s*\d+.*p[áa]gina\s*\d+\s*de\s*\d+/i,
  ],
  'dje-header': [/^edi[çc][ãa]o\s*n[ºo°]?\s*\d+\/\d{4}/i, /^di[áa]rio da justi[çc]a eletr[ôo]nico/i],
};
