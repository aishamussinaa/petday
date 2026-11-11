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
  const [draft,setDraft]=useState(()=>task?{...task}:{id:crypto.randomUUID(),title:'',category:'food',time:'',notes:'',day});
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
    <p className="muted">{t('today.oneDay',{date:day})}</p>
    <label htmlFor="task-title">{t('today.title')} *</label><input id="task-title" autoFocus maxLength={120} value={draft.title} disabled={busy} onChange={e=>change('title',e.target.value)} />
    <div className="form-columns"><div><label htmlFor="task-category">{t('today.category')}</label><select id="task-category" value={draft.category} disabled={busy} onChange={e=>change('category',e.target.value)}>{categories.map(value=><option key={value} value={value}>{t(`today.categories.${value}`)}</option>)}</select></div><div><label htmlFor="task-time">{t('today.time')}</label><input id="task-time" type="time" value={draft.time} disabled={busy} onChange={e=>change('time',e.target.value)}/></div></div>
    <label htmlFor="task-notes">{t('today.notes')}</label><textarea id="task-notes" rows={3} maxLength={1000} value={draft.notes} disabled={busy} onChange={e=>change('notes',e.target.value)}/>
    <ErrorNotice code={error}/><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>{t('cancel')}</button><button className="button primary" disabled={busy}>{t(busy?'account.saving':'account.save')}</button></div>
  </form></Modal>;
}
export default function Today({pet}){
  const {t,i18n}=useTranslation();
  const [day,setDay]=useState(dateKey),[items,setItems]=useState([]),[events,setEvents]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(null),[modal,setModal]=useState(null),[busy,setBusy]=useState(false);
  const generation=useRef(0),pending=useRef(false);
  const base=`/pets/${pet.id}/tasks`;
  async function load(){
    const version=++generation.current;setLoading(true);setError(null);
    try{const result=await request(`${base}?date=${day}`);if(version===generation.current){setItems(result.tasks);setEvents(result.events);}}
    catch(failure){if(version===generation.current){setError(failure.code);setItems([]);setEvents([]);}}
    finally{if(version===generation.current)setLoading(false);}
  }
  useEffect(()=>{load();return()=>{generation.current++;};},[day,pet.id]);
  const completed=items.filter(item=>item.completedAt).length;
  const timestamp=value=>`${formatDate(new Date(value),i18n.language,{day:'numeric',month:'long'})}, ${new Intl.DateTimeFormat(i18n.language,{hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value))}`;
  async function mutate(item,mode){
    if(pending.current)return;pending.current=true;setBusy(true);setError(null);
    try{
      await request(`${base}/${item.id}${mode==='state'?'/state':''}`,{method:mode==='state'?'PATCH':'DELETE',body:{version:item.version,completed:!item.completedAt,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone}});
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
        <div className="today-task-main"><input type="checkbox" checked={Boolean(item.completedAt)} disabled={busy||day>dateKey()} aria-label={t('today.toggle',{title:item.title})} onChange={()=>mutate(item,'state')}/><span className="today-task-icon"><Icon name={item.category}/></span><div className="today-task-copy"><h3>{item.title}</h3><p className="small muted">{item.time?formatTime(item.time,i18n.language):t('today.anyTime')} · {t(`today.categories.${item.category}`)}</p>{item.notes&&<p className="today-note">{item.notes}</p>}{item.completedAt&&<p className="today-done-time">{t('today.doneAt',{time:timestamp(item.completedAt)})}</p>}</div></div>
        <div className="today-actions"><button className="button secondary" disabled={busy} onClick={()=>setModal({type:'form',task:item})}>{t('today.edit')}</button><button className="today-remove" disabled={busy} onClick={()=>setModal({type:'delete',task:item})}>{t('today.delete')}</button></div>
      </li>)}</ul>}
      {day>dateKey()&&<p className="small muted">{t('today.futureHint')}</p>}
      <details className="today-history"><summary>{t('today.history')}</summary>{!events.length?<p className="muted">{t('today.noHistory')}</p>:<ol>{events.map(event=><li key={event.id}><span>{t(`today.events.${event.action}`,{title:event.title})}</span><time dateTime={event.createdAt}>{timestamp(event.createdAt)}</time></li>)}</ol>}<p className="small muted">{t('today.historyHint')}</p></details>
    </>}
    {modal?.type==='form'&&<TaskForm task={modal.task} day={day} onClose={()=>setModal(null)} onSaved={async draft=>{await request(modal.task?`${base}/${modal.task.id}`:base,{method:modal.task?'PUT':'POST',body:draft});await load();}}/>}
    {modal?.type==='delete'&&<Modal title={t('today.delete')} onClose={()=>{if(!busy)setModal(null);}}><p className="delete-explanation">{t('today.deleteConfirm',{title:modal.task.title})}</p><ErrorNotice code={error}/><div className="modal-actions"><button className="button secondary" disabled={busy} onClick={()=>setModal(null)}>{t('cancel')}</button><button className="button danger" disabled={busy} onClick={()=>mutate(modal.task,'delete')}>{t('today.delete')}</button></div></Modal>}
  </section>;
}
