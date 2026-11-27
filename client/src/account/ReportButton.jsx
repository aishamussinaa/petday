import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from './ApiContext.jsx';

export default function ReportButton({ pet, summary, transport: customTransport }) {
  const contextTransport = useApi();
  const transport = customTransport || contextTransport;
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const pending = useRef(false);
  async function download() {
    if (pending.current) return; pending.current = true; setBusy(true); setError(false);
    try {
      const { makeReport } = await import('./petReport.js');
      let data = { summary };
      if (!summary) {
        const [health, weight] = await Promise.all([transport(`/pets/${pet.id}/health`), transport(`/pets/${pet.id}/weights`)]);
        data = { records: health.records, weights: weight.records };
      }
      const bytes = await makeReport({ pet, ...data, t, language: i18n.language });
      const suffix = summary ? '-vet' + (summary.start ? '-' + summary.start + '_' + summary.end : '') : '';
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = `PetDay-${pet.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 60) || 'pet'}${suffix}.pdf`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="report-download"><button className="button secondary" disabled={busy} onClick={download}>{t(busy ? 'care.reportBusy' : summary ? 'vet.download' : 'care.report')}</button>{error && <p className="form-error" role="alert">{t('care.reportError')}</p>}</div>;
}
