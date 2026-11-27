import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApi } from '../account/ApiContext.jsx';

export default function WalkTour({ pet, day, tasks, task, disabled, onRecord, onReport }) {
  const { t } = useTranslation();
  const request = useApi();
  const [week, setWeek] = useState(null);
  const [retry, setRetry] = useState(0);
  const [before, setBefore] = useState(null);
  const pending = useRef(false);

  useEffect(() => {
    let active = true;
    request(`/pets/${pet.id}/tasks/weekly?end=${day}`)
      .then(data => { if (active) setWeek({ tasks, data }); })
      .catch(() => { if (active) setWeek({ tasks, error: true }); });
    return () => { active = false; };
  }, [request, pet.id, day, tasks, retry]);

  const current = week?.tasks === tasks ? week : null;
  const report = current?.data;
  const finished = task.completedCount >= task.targetCount;
  const recorded = before && task.version === before.version + 1 && task.completedCount === before.daily + 1;

  async function record() {
    if (disabled || pending.current || !report || finished || recorded) return;
    pending.current = true;
    try {
      const snapshot = { daily: task.completedCount, weekly: report.walks, version: task.version };
      if (await onRecord(task)) setBefore(snapshot);
    } finally {
      pending.current = false;
    }
  }

  return <details className="walk-tour" open>
    <summary>{t('walkTour.title', { name: pet.name })}</summary>
    <p>{t('walkTour.hint')}</p>
    <div role="status" aria-live="polite" aria-atomic="true">
      <dl className="walk-tour-counts">
        <div><dt>{t('walkTour.daily')}</dt><dd>{recorded && <span>{before.daily} → </span>}{task.completedCount} / {task.targetCount}</dd></div>
        <div><dt>{t('walkTour.weekly')}</dt><dd>{report ? <>{recorded && <span>{before.weekly} → </span>}{report.walks} / {report.walkTarget}</> : '…'}</dd></div>
      </dl>
      {recorded && report && <p>{t('walkTour.saved')}</p>}
    </div>
    {current?.error && <p role="alert">{t('weekly.error')} <button className="text-link" onClick={() => setRetry(value => value + 1)}>{t('account.retry')}</button></p>}
    <div className="walk-tour-actions">
      <button className="button primary" disabled={disabled || !report || finished || Boolean(recorded)} onClick={record}>{t(finished ? 'walkTour.complete' : recorded ? 'walkTour.logged' : 'walkTour.record')}</button>
      <button className="button secondary" onClick={onReport}>{t('walkTour.report')}</button>
    </div>
  </details>;
}
