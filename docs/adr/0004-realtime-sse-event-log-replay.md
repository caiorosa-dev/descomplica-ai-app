# 0004. Tempo real via SSE com replay do log de eventos

- **Status:** aceito
- **Data:** 2026-10-18

## Contexto

A interface deve refletir o estado atual do processamento. A comunicação é de mão única (servidor → cliente). Recarregar a página ou abrir a run em outra aba não pode perder o histórico. Todos os eventos também precisam ficar registrados no banco.

## Decisão

- Cada evento da run é gravado em `RunEvent` com `seq` crescente por run e publicado num `EventEmitter` em memória.
- `GET /runs/:id/events` usa **Server-Sent Events**:
  1. reenvia do banco os eventos com `seq` maior que o cabeçalho `Last-Event-ID` (ou todos);
  2. passa a transmitir ao vivo, com `id: <seq>` em cada mensagem;
  3. envia heartbeat a cada 15 segundos;
  4. encerra após o evento final de uma run em estado terminal.
- Os tipos de evento são uma união discriminada Zod em `shared` (`run.status`, `stage.started`, `stage.progress`, `stage.completed`, `stage.failed`, `stage.reused`, `log`, `llm.call`).
- No cliente, `EventSource` alimenta um reducer puro que atualiza o cache do TanStack Query.

## Alternativas consideradas

- **WebSocket:** bidirecional sem necessidade; exige protocolo próprio de reconexão e replay.
- **Polling:** simples, mas com atraso perceptível e carga desnecessária durante runs longas.

## Consequências

- O log de auditoria e o estado da tela vêm da mesma fonte, sem divergência.
- Reconexão e replay são nativos do protocolo (`Last-Event-ID`).
- O `EventEmitter` em memória só funciona porque a pipeline roda no mesmo processo ([0003](0003-in-process-pipeline-with-stage-checkpoints.md)); com um worker separado, seria preciso trocar por LISTEN/NOTIFY.
- O proxy (nginx) precisa desativar buffering na rota de eventos.
