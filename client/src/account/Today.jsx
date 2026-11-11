import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { formatDate, formatTime } from '../dateUtils.js';
import { request } from './api.js';

const dateKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const localDay = value => {const [y,m,d]=value.split('-').map(Number);return new Date(y,m-1,d,12);};
const categories=['food','water','walk','care','other'];
function ErrorNotice({code}){
  const {t}=useTranslation();
  return code?<p className="form-error" role="alert">{t(`today.errors.${code}`,{defaultValue:t(`account.errors.${code}`,{defaultValue:t('account.errors.INTERNAL_ERROR')})})}</p>:null;
}
function TaskForm({task,day,onClose,onSaved}){
  const {t}=useTranslation();
  const [draft,setDraft]=useState(()=>task?{...task}:{id:crypto.randomUUID(),title:'',category:'food',time:'',notes:'',day,targetCount:1,repeat:'once',weekdays:[0,1,2,3,4,5,6]});
  const [error,setError]=useState(null),[busy,setBusy]=useState(false);
  const pending=useRef(false);
  const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  async function submit(event){
    event.preventDefault();if(pending.current)return;
    if(!draft.title.trim()){setError('TASK_TITLE');return;}
    pending.current=true;setBusy(true);setError(null);
    try{await onSaved(draft);onClose();}catch(failure){setError(failure.code);}finally{pending.current=false;setBusy(false);}
  }
  return <Modal title={t(task?'today.edit':'today.add')} onClose={()=>{if(!pending.current)onClose();}}><form className="pet-form" onSubmit={submit}>
    <p className="muted">{t(task?'today.editOneDay':'today.startsOn',{date:day})}</p>
    <label htmlFor="task-title">{t('today.title')} *</label><input id="task-title" autoFocus maxLength={120} value={draft.title} disabled={busy} onChange={e=>change('title',e.target.value)} />
    <div className="form-columns"><div><label htmlFor="task-category">{t('today.category')}</label><select id="task-category" value={draft.category} disabled={busy} onChange={e=>change('category',e.target.value)}>{categories.map(value=><option key={value} value={value}>{t(`today.categories.${value}`)}</option>)}</select></div><div><label htmlFor="task-time">{t('today.time')}</label><input id="task-time" type="time" value={draft.time} disabled={busy} onChange={e=>change('time',e.target.value)}/></div></div>
    <label htmlFor="task-notes">{t('today.notes')}</label><textarea id="task-notes" rows={3} maxLength={1000} value={draft.notes} disabled={busy} onChange={e=>change('notes',e.target.value)}/>
    <label htmlFor="task-target">{t('today.target')}</label><input id="task-target" type="number" min={Math.max(1,task?.completedCount||0)} max="20" required value={draft.targetCount} disabled={busy} onChange={e=>change('targetCount',e.target.value===''?'':Number(e.target.value))}/><p className="small muted">{t('today.targetHint')}</p>
    {!task&&<><label htmlFor="task-repeat">{t('today.repeat')}</label><select id="task-repeat" value={draft.repeat} disabled={busy} onChange={e=>change('repeat',e.target.value)}>{['once','daily','weekly'].map(value=><option key={value} value={value}>{t(`today.repeatOptions.${value}`)}</option>)}</select>{draft.repeat==='weekly'&&<fieldset className="routine-weekdays"><legend>{t('today.weekdaysLabel')}</legend>{[1,2,3,4,5,6,0].map(n=><label key={n}><input type="checkbox" checked={draft.weekdays.includes(n)} disabled={busy} onChange={e=>change('weekdays',e.target.checked?[...draft.weekdays,n]:draft.weekdays.filter(d=>d!==n))}/>{t(`today.weekdays.${n}`)}</label>)}</fieldset>}</>}
    <ErrorNotice code={error}/><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy?'account.saving':'account.save')}</button></div>
  </form></Modal>;
}
export default function Today({pet}){
  const {t,i18n}=useTranslation();
  const [day,setDay]=useState(dateKey),[items,setItems]=useState([]),[events,setEvents]=useState([]),[routines,setRoutines]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[modal,setModal]=useState(null),[busy,setBusy]=useState(false);
  const generation=useRef(0),pending=useRef(false);
  const base=`/pets/${pet.id}/tasks`;
  async function load(){
    const version=++generation.current;setLoading(true);setError(null);
    try{const result=await request(`${base}?date=${day}`);if(version===generation.current){setItems(result.tasks);setEvents(result.events);setRoutines(result.routines||[]);}}
    catch(failure){if(version===generation.current){setError(failure.code);setItems([]);setEvents([]);}}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{load();return()=>{generation.current++;};},[day,pet.id]);
  useEffect(()=>{let previous=dateKey();const tick=()=>{const now=dateKey();if(now!==previous){const old=previous;previous=now;setDay(value=>value===old?now:value);}};const timer=setInterval(tick,30000);document.addEventListener('visibilitychange',tick);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',tick);};},[]);
  const completed=items.filter(item=>item.completedAt).length;
  const timestamp=value=>`${formatDate(new Date(value),i18n.language,{day:'numeric',month:'long'})}, ${new Intl.DateTimeFormat(i18n.language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))}`;
  async function mutate(item,mode){
    if(pending.current)return;pending.current=true;setBusy(true);setError(null);
    try{
      if(mode==='stop')await request(`${base}/routines/${item.id}/stop`,{method:'POST',body:{timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}});
      else await request(`${base}/${item.id}${mode==='state'?'/state':['plus','minus'].includes(mode)?'/count':''}`,{method:mode==='delete'?'DELETE':'PATCH',body:{version:item.version,completed:!item.completedAt,delta:mode==='plus'?1:-1,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}});
      setModal(null);await load();
    }catch(failure){if(failure.code==='TASK_CHANGED'){await load();}setError(failure.code);}
    finally{pending.current=false;setBusy(false);}
  }
  function shift(offset){const next=localDay(day);next.setDate(next.getDate()+offset);const value=dateKey(next);if(value>='1900-01-01'&&value<='2100-12-31')setDay(value);}
  return <section className="today-panel" aria-label={t('today.heading',{name:pet.name})}>
    <div className="today-heading"><div><p className="eyebrow">{t('today.eyebrow')}</p><h2>{t('today.heading',{name:pet.name})}</h2></div><button className="button primary" disabled={busy} onClick={()=>setModal({type:'form'})}><Icon name="plus"/>{t('today.add')}</button></div>
    <div className="today-dates"><button className="button secondary" aria-label={t('today.previous')} disabled={busy||loading} onClick={()=>shift(-1)}>←</button><label>{t('today.date')}<input aria-label={t('today.date')} type="date" min="1900-01-01" max="2100-12-31" value={day} disabled={busy} onChange={e=>{if(e.target.validity.valid&&e.target.value)setDay(e.target.value);}}/></label><button className="button secondary" aria-label={t('today.next')} disabled={busy||loading} onClick={()=>shift(1)}>→</button><button className="button secondary" disabled={busy} onClick={()=>setDay(dateKey())}>{t('nav.today')}</button></div>
    <p className="muted">{formatDate(localDay(day),i18n.language,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
    <ErrorNotice code={error}/>{error&&<button className="button secondary" onClick={load} disabled={busy}>{t('account.retry')}</button>}
    {loading?<p role="status">{t('today.loading')}</p>:<>
      {items.length>0&&<div className="today-progress"><span role="status">{t('today.progress',{done:completed,total:items.length})}</span><progress aria-label={t('today.progressLabel')} max={items.length} value={completed}/></div>}
      {!items.length&&!error?<div className="today-empty"><Icon name="today" size={44}/><h3>{t('today.empty')}</h3><p>{t('today.emptyText')}</p><button className="button secondary" onClick={()=>setModal({type:'form'})}>{t('today.add')}</button></div>:<ul className="today-list">{items.map(item=><li className={`today-task ${item.completedAt?'is-done':''}`} key={item.id}>
        <div className="today-task-main">{item.targetCount===1&&<input type="checkbox" checked={Boolean(item.completedAt)} disabled={busy||day>dateKey()} aria-label={t('today.toggle',{title:item.title})} onChange={()=>mutate(item,'state')}/>}<span className="today-task-icon"><Icon name={item.category}/></span><div className="today-task-copy"><h3>{item.title}</h3><p className="small muted">{item.time?formatTime(item.time,i18n.language):t('today.anyTime')} · {t(`today.categories.${item.category}`)}{item.routineId&&` · ${t('today.fromRoutine')}`}</p>{item.notes&&<p className="today-note">{item.notes}</p>}{item.targetCount>1&&<div className="goal-counter"><span role="status">{t('today.goalProgress',{done:item.completedCount,total:item.targetCount})}</span><progress aria-label={t('today.goalLabel',{title:item.title})} max={item.targetCount} value={item.completedCount}/><div><button className="button secondary" disabled={busy||day>dateKey()||item.completedCount===0} aria-label={t('today.minusLabel',{title:item.title})} onClick={()=>mutate(item,'minus')}>{t('today.minus')}</button><button className="button primary" disabled={busy||day>dateKey()||item.completedCount>=item.targetCount} aria-label={t('today.plusLabel',{title:item.title})} onClick={()=>mutate(item,'plus')}>{t('today.plus')}</button></div></div>}{item.completedAt&&<p className="today-done-time">{t('today.doneAt',{time:timestamp(item.completedAt)})}</p>}</div></div>
        <div className="today-actions"><button className="button secondary" disabled={busy} onClick={()=>setModal({type:'form',task:item})}>{t('today.edit')}</button><button className="today-remove" disabled={busy} onClick={()=>setModal({type:'delete',task:item})}>{t('today.delete')}</button></div>
      </li>)}</ul>}
      {day>dateKey()&&<p className="small muted">{t('today.futureHint')}</p>}
      <details className="today-routines"><summary>{t('today.routines')} · {routines.length}</summary><p className="small muted">{t('today.routinesHint')}</p>{routines.map(routine=><article key={routine.id}><h3>{routine.title}</h3><p>{t('today.routineTarget',{total:routine.targetCount})} · {routine.weekdays.length===7?t('today.repeatOptions.daily'):routine.weekdays.map(n=>t(`today.weekdays.${n}`)).join(', ')}</p><p className="small muted">{t('today.startsOn',{date:routine.startDay})}</p><button className="button secondary" disabled={busy} onClick={()=>setModal({type:'stop',task:routine})}>{t('today.stop')}</button></article>)}</details>
      <details className="today-history"><summary>{t('today.history')}</summary>{!events.length?<p className="muted">{t('today.noHistory')}</p>:<ol>{events.map(event=><li key={event.id}><span>{t(`today.events.${event.action}`,{title:event.title})}{event.completedCount!=null&&event.targetCount>1?` · ${event.completedCount}/${event.targetCount}`:''}</span><time dateTime={event.createdAt}>{timestamp(event.createdAt)}</time></li>)}</ol>}<p className="small muted">{t('today.historyHint')}</p></details>
    </>}
    {modal?.type==='form'&&<TaskForm task={modal.task} day={day} onClose={()=>setModal(null)} onSaved={async draft=>{const repeating=!modal.task&&draft.repeat!=='once';await request(modal.task?`${base}/${modal.task.id}`:repeating?`${base}/routines`:base,{method:modal.task?'PUT':'POST',body:{...draft,weekdays:draft.repeat==='daily'?[0,1,2,3,4,5,6]:draft.weekdays}});await load();}}/>}
    {modal?.type==='stop'&&<Modal title={t('today.stop')} onClose={()=>{if(!busy)setModal(null);}}><p className="delete-explanation">{t('today.stopConfirm',{title:modal.task.title})}</p><ErrorNotice code={error}/><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>mutate(modal.task,'stop')}>{t('today.stop')}</button></div></Modal>}
    {modal?.type==='delete'&&<Modal title={t('today.delete')} onClose={()=>{if(!busy)setModal(null);}}><p className="delete-explanation">{t('today.deleteConfirm',{title:modal.task.title})}</p><ErrorNotice code={error}/><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>mutate(modal.task,'delete')}>{t('today.delete')}</button></div></Modal>}
  </section>;
}
