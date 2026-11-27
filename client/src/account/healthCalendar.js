import { shiftDay } from '../../../shared/weekly.js';

function escapeText(text) {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/[,;]/g, char => '\\' + char);
}

const encoder = new TextEncoder();
function foldLine(line) {
  let result = '', bytes = 0;
  for (const char of line) {
    const size = encoder.encode(char).length;
    // A continuation starts with one space, which counts toward the 75-byte limit.
    if (bytes + size > 75) { result += '\r\n '; bytes = 1; }
    result += char;
    bytes += size;
  }
  return result;
}

export function healthCalendarFile({ pet, record, followUp = false, t, now = new Date() }) {
  const date = followUp ? record.nextDate : record.date;
  const kind = t('medical.' + record.kind);
  const label = followUp ? t(record.kind === 'visit' ? 'medical.nextVisit' : 'medical.nextVaccine') : kind;
  const title = [pet.name, followUp && label, record.title].filter(Boolean).join(' · ');
  const details = [label, record.vet && t('medical.vet') + ': ' + record.vet, record.notes].filter(Boolean);
  const uid = [pet.id, record.id, followUp ? 'followup' : 'event'].map(encodeURIComponent).join('.') + '@petday';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PetDay//Health calendar//EN',
    'BEGIN:VEVENT', 'UID:' + uid,
    'DTSTAMP:' + now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z'),
    'SEQUENCE:' + Math.max(0, (record.version || 1) - 1),
    'DTSTART;VALUE=DATE:' + date.replaceAll('-', ''),
    'DTEND;VALUE=DATE:' + shiftDay(date, 1).replaceAll('-', ''),
    'SUMMARY:' + escapeText(title),
    'DESCRIPTION:' + escapeText(details.join('\n')),
  ];
  if (record.clinic) lines.push('LOCATION:' + escapeText(record.clinic));
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return {
    content: lines.map(foldLine).join('\r\n') + '\r\n',
    filename: 'PetDay-' + record.kind + (followUp ? '-followup-' : '-') + date + '.ics',
  };
}
