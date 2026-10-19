import { MODEL_CATALOG, type ProvidersDto } from '@app/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ApiError } from '@/lib/api-client';
import { PresetEditor } from './preset-editor';

const providers: ProvidersDto = {
  providers: [
    { id: 'openai', configured: true },
    { id: 'anthropic', configured: true },
  ],
  models: [...MODEL_CATALOG],
};

test('API validation issue appears under the field', async () => {
  const onSave = vi.fn().mockRejectedValue(
    new ApiError(400, 'VALIDATION_ERROR', 'Os dados enviados são inválidos.', {
      issues: [
        {
          path: ['config', 'models', 'extraction', 'model'],
          message: 'Modelo inválido para este slot',
          code: 'custom',
        },
      ],
    }),
  );
  render(
    <TooltipProvider>
      <PresetEditor preset={null} providers={providers} onSave={onSave} />
    </TooltipProvider>,
  );
  await userEvent.type(screen.getByLabelText('Slug'), 'meu-preset');
  await userEvent.type(screen.getByLabelText('Nome'), 'Meu preset');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ slug: 'meu-preset', name: 'Meu preset' }));
  const field = screen.getByLabelText('Modelo de extração').closest('[data-slot="field"]') as HTMLElement;
  expect(await within(field).findByText('Modelo inválido para este slot')).toBeInTheDocument();
});

test('slug issues show under the slug input', async () => {
  const onSave = vi.fn().mockRejectedValue(
    new ApiError(400, 'VALIDATION_ERROR', 'x', {
      issues: [{ path: ['slug'], message: 'Já existe um preset com o slug "a".' }],
    }),
  );
  render(
    <TooltipProvider>
      <PresetEditor preset={null} providers={providers} onSave={onSave} />
    </TooltipProvider>,
  );
  await userEvent.type(screen.getByLabelText('Slug'), 'a');
  await userEvent.type(screen.getByLabelText('Nome'), 'A');
  await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));
  expect(await screen.findByText('Já existe um preset com o slug "a".')).toBeInTheDocument();
});
