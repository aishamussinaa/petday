import { useTranslation } from 'react-i18next';
import { formatDate } from '../dateUtils.js';
import { localDay } from './careOverview.js';

function WalkWeek({ week, previous }) {
  const { t, i18n } = useTranslation();
  const date = value => formatDate(localDay(value), i18n.language, { day: 'numeric', month: 'short', year: 'numeric' });
  const percent = week.walkTarget ? Math.round(week.walks / week.walkTarget * 100) : null;
  return <article className="walk-week">
    <h5>{t(previous ? 'weekly.priorWeek' : 'weekly.selectedWeek')}</h5>
    <p className="muted">{t('weekly.period', { start: date(week.start), end: date(week.end) })}</p>
    <strong data-testid={previous ? 'previous-week-walks' : 'week-walks'}>{week.walks} / {week.walkTarget}</strong>
    {percent !== null && <progress aria-hidden="true" value={week.walks} max={week.walkTarget} />}
    <p>{percent === null ? t('weekly.noPlan') : t('weekly.percent', { value: percent })}</p>
  </article>;
}

export default function WalkComparison({ current, previous, previousError, petName, onRetry }) {
  const { t, i18n } = useTranslation();
  const difference = previous && current.walks - previous.walks;
  return <section className="walk-comparison" aria-labelledby="walk-comparison-title">
    <h4 id="walk-comparison-title">{t('weekly.walkComparison', { name: petName })}</h4>
    <p className="muted">{t('weekly.walkHint')}</p>
    <div className="walk-weeks">
      <WalkWeek week={current} />
      {previous && <WalkWeek week={previous} previous />}
    </div>
    {current.walkTarget > 0 && previous?.walkTarget > 0 && <p className="walk-difference">
      {t('weekly.walkDifference', { value: new Intl.NumberFormat(i18n.language, { signDisplay: 'exceptZero' }).format(difference) })}
    </p>}
    {previousError && <p role="alert">{t('weekly.previousError')} <button className="text-link" onClick={onRetry}>{t('account.retry')}</button></p>}
    {!previous && !previousError && <p className="muted">{t('weekly.previousUnavailable')}</p>}
  </section>;
}
