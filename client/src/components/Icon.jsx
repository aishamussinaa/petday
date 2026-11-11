const paths = {
  paw: <><path d="M8.5 14.5C10 12 10.3 10 12 10s2 2 3.5 4.5c3 4.5-.8 5.5-3.5 4-2.7 1.5-6.5.5-3.5-4Z"/><ellipse cx="5" cy="10" rx="1.7" ry="2.5"/><ellipse cx="9" cy="5.5" rx="1.7" ry="2.5"/><ellipse cx="15" cy="5.5" rx="1.7" ry="2.5"/><ellipse cx="19" cy="10" rx="1.7" ry="2.5"/></>,
  today: <><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5 3 3 5-5"/></>,
  pets: <><path d="m5 11-2-8 7 4m4 0 7-4-2 8"/><path d="M20 13c0 5-3 8-8 8s-8-3-8-8 3-7 8-7 8 2 8 7Z"/><path d="M8 13h.01M16 13h.01m-6 3 2 2 2-2"/></>,
  food: <><path d="M3 12h18a9 9 0 0 1-18 0Zm1 9h16M8 3v4m4-5v5m4-4v4"/></>,
  health: <><rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V3h8v3m-4 5v6m-3-3h6"/></>,
  water: <path d="M12 3S5 11 5 15a7 7 0 0 0 14 0c0-4-7-12-7-12Zm-3 12c0 2 1 3 3 3"/>,
  walk: <><path d="M4 21h5l3-8 3 3v5M8 6l-3 6h5l3-5 3 4h4"/><circle cx="14" cy="3" r="2"/></>,
  care: <><path d="m14 3 7 7-9 9-7-7 9-9Zm-9 9-3 3 7 7 3-3M7 14l-3 3m6 0-3 3M16 5l-5 5"/></>,
  other: <path d="m12 3 2.5 5.5 6 1-4.5 4.3 1 6.2-5-3-5 3 1-6.2L3.5 9.5l6-1L12 3Z"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5"/>,
  check: <path d="m5 12 4 4L19 6"/>,
  close: <path d="m6 6 12 12M6 18 18 6"/>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9M12 8v13"/><path d="M12 8S4 8 6 4s6 4 6 4Zm0 0s8 0 6-4-6 4-6 4Z"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1"/></>,
  code: <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>,
};
export default function Icon({ name, size = 22, ...props }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.paw}</svg>;
}
