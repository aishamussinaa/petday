import { useTranslation } from 'react-i18next';
import { healthCalendarFile } from './healthCalendar.js';

export default function CalendarDownload({ pet, record, followUp = false, labelKey = 'eventsView.addToCalendar' }) {
  const { t } = useTranslation();
  function download() {
    const { content, filename } = healthCalendarFile({ pet, record, followUp, t });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  return <button type="button" className="text-link calendar-download" onClick={download}>{t(labelKey)}</button>;
}
