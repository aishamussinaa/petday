import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { request } from './api.js';

export default function ReportButton({ pet, transport = request }) {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const pending = useRef(false);
  async function download() {
    if (pending.current) return; pending.current = true; setBusy(true); setError(false);
    try {
      const [health, weight, { makeReport }] = await Promise.all([transport(`/pets/${pet.id}/health`), transport(`/pets/${pet.id}/weights`), import('./petReport.js')]);
      const bytes = await makeReport({ pet, records: health.records, weights: weight.records, t, language: i18n.language });
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const link = document.createElement('a'); link.href = url; link.download = `PetDay-${pet.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').slice(0, 60) || 'pet'}.pdf`; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch { setError(true); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="report-download"><button className="button secondary" disabled={busy} onClick={download}>{t(busy ? 'care.reportBusy' : 'care.report')}</button>{error && <p className="form-error" role="alert">{t('care.reportError')}</p>}</div>;
}
