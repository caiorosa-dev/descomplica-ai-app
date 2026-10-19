import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProcessDialog, presetAvailability } from './process-dialog';
import { anthropicDefault, makeDoc, onlyOpenai, openaiDefault } from './test-fixtures';

const doc = makeDoc();

test('presetAvailability lists missing providers', () => {
  expect(presetAvailability(anthropicDefault, onlyOpenai)).toEqual({ available: false, missing: ['anthropic'] });
  expect(presetAvailability(openaiDefault, onlyOpenai)).toEqual({ available: true, missing: [] });
});

test('preset needing anthropic is disabled when anthropic is not configured', async () => {
  render(
    <TooltipProvider>
      <ProcessDialog
        document={doc}
        presets={[openaiDefault, anthropicDefault]}
        providers={onlyOpenai}
        open
        onOpenChange={() => {}}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  expect(screen.getByRole('option', { name: /anthropic-default/i })).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('option', { name: /openai-default/i })).not.toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
});

test('confirm sends the chosen preset', async () => {
  const onConfirm = vi.fn();
  render(
    <TooltipProvider>
      <ProcessDialog
        document={doc}
        presets={[openaiDefault, anthropicDefault]}
        providers={onlyOpenai}
        open
        onOpenChange={() => {}}
        onConfirm={onConfirm}
      />
    </TooltipProvider>,
  );
  await userEvent.click(screen.getByRole('combobox'));
  await userEvent.click(screen.getByRole('option', { name: /openai-default/i }));
  await userEvent.click(screen.getByRole('button', { name: /simplificar/i }));
  expect(onConfirm).toHaveBeenCalledWith(openaiDefault.id);
});
