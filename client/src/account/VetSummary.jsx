import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import { shiftDay } from '../../../shared/weekly.js';
import { useApi } from './ApiContext.jsx';
import { vetSummary } from './vetSummary.js';
import ReportButton from './ReportButton.jsx';
import './vetSummary.css';

export default function VetSummary({ pet, today, onClose }) {
  const request = useApi();
  const { t, i18n } = useTranslation();
  const [preset, setPreset] = useState('all');
  const [start, setStart] = useState(() => shiftDay(today, -29));
  const [end, setEnd] = useState(today);
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setResult(null);
    Promise.all([request('/pets/' + pet.id + '/health'), request('/pets/' + pet.id + '/weights')])
      .then(([health, weight]) => { if (active) setResult({ records: health.records, weights: weight.records }); })
      .catch(() => { if (active) setResult({ error: true }); });
    return () => { active = false; };
  }, [pet.id, request, retry]);

  const valid = preset === 'all' || (start >= '1900-01-01' && end <= '2100-12-31' && end && start <= end);
  const summary = valid && result && !result.error && vetSummary({
    ...result, start: preset === 'all' ? null : start, end: preset === 'all' ? null : end,
    language: i18n.language, t
  });
  function choose(value) {
    setPreset(value);
    if (value === '30' || value === '90') {
      setStart(shiftDay(today, 1 - Number(value)));
      setEnd(today);
    }
  }

  return <Modal title={t('vet.title')} onClose={onClose}>
    <div className="vet-summary">
      <p className="vet-pet">{pet.name}</p>
      <div className="pet-form vet-fields">
        <label htmlFor="vet-period">{t('vet.period')}</label>
        <select id="vet-period" value={preset} onChange={event => choose(event.target.value)}>
          {['all', '30', '90', 'custom'].map(value => <option key={value} value={value}>{t('vet.' + value)}</option>)}
        </select>
        {preset !== 'all' && <div className="form-columns">
          <div><label htmlFor="vet-from">{t('vet.from')}</label><input id="vet-from" type="date" min="1900-01-01" max="2100-12-31" required value={start} onChange={event => { setStart(event.target.value); setPreset('custom'); }} /></div>
          <div><label htmlFor="vet-to">{t('vet.to')}</label><input id="vet-to" type="date" min="1900-01-01" max="2100-12-31" required value={end} onChange={event => { setEnd(event.target.value); setPreset('custom'); }} /></div>
        </div>}
      </div>
      {!valid && <p role="alert" className="form-error">{t('vet.invalid')}</p>}
      {!result && <p role="status">{t('account.loading')}</p>}
      {result?.error && <p role="alert">{t('vet.loadError')} <button className="text-link" onClick={() => setRetry(n => n + 1)}>{t('account.retry')}</button></p>}
      {summary && <>
        <ReportButton pet={pet} summary={summary} />
        {summary.sections.map(section => <section className="vet-section" key={section.title}>
          <h3>{section.title} <span>{section.entries.length}</span></h3>
          {section.note && <p className="vet-trend">{section.note}</p>}
          {section.entries.length ? <ul>{section.entries.map(entry => <li key={entry.id}>
            <strong>{entry.title}</strong>
            {entry.lines.map((line, i) => <p key={i}>{line}</p>)}
          </li>)}</ul> : <p className="muted">{t('vet.empty')}</p>}
        </section>)}
      </>}
    </div>
  </Modal>;
}
