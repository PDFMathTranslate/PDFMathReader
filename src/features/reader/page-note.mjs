export function pageNote(p, engine = 'pdf_inspector') {
  const detail = p.blocks.find((b) => b.error)?.error || p.message;
  if (p.status === 'error' || p.blocks.some((b) => b.status === 'error'))
    return { kind: 'error', label: 'Translation failed', detail: detail || 'Translation failed.' };
  if (
    p.status === 'detecting' ||
    p.status === 'queued' ||
    p.blocks.some((b) => ['queued', 'translating'].includes(b.status))
  )
    return {
      kind: 'progress',
      label:
        p.status === 'queued'
          ? 'Queued…'
          : engine === 'pdf_inspector' && p.status === 'detecting'
            ? 'Detecting layout…'
            : 'Translating…',
      detail,
    };
  if (detail) return { kind: 'warning', label: 'Check this page', detail };
  return null;
}
