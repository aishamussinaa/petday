import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../components/Modal.jsx';
import Icon from '../components/Icon.jsx';
import { request } from './api.js';

export const species = ['cat', 'dog', 'bird', 'rabbit', 'rodent', 'fish', 'reptile', 'other'];
const blank = { name: '', species: 'cat', breed: '', sex: 'unknown', birthDate: '', birthApproximate: false, features: '', allergies: '', notes: '' };
const dateString = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function ErrorMessage({ error }) {
  const { t } = useTranslation();
  return error ? <p className="form-error" role="alert">{t(`account.errors.${error}`, { defaultValue: t('account.errors.INTERNAL_ERROR') })}</p> : null;
}

export default function PetForm({ pet, onClose, onSaved }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(() => pet ? { ...pet, birthDate: pet.birthDate || '' } : { ...blank });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dimensions, setDimensions] = useState(null);
  const [photoAction, setPhotoAction] = useState('keep');
  const [crop, setCrop] = useState({ x: .5, y: .5, zoom: 1 });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const fileInput = useRef(null);
  const selection = useRef(0);
  useEffect(() => { if (!file) { setPreview(null); return; } const url = URL.createObjectURL(file); setPreview(url); return () => URL.revokeObjectURL(url); }, [file]);
  const fieldError = key => error?.fields?.[key];
  function change(key, value) {
    setDraft(previous => ({ ...previous, [key]: value, ...(key === 'birthDate' && !value ? { birthApproximate: false } : {}) }));
    setError(previous => previous ? { ...previous, fields: { ...previous.fields, [key]: undefined } } : null);
  }
  async function choosePhoto(event) {
    const chosen = event.target.files?.[0];
    const requestId = ++selection.current;
    event.target.value = '';
    if (!chosen) return;
    const fail = code => setError({ fields: { photo: code } });
    if (chosen.size > 5 * 1024 * 1024) return fail('PHOTO_TOO_LARGE');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)) return fail('PHOTO_FORMAT');
    const url = URL.createObjectURL(chosen);
    try {
      const image = new Image(); image.src = url; await image.decode();
      if (requestId !== selection.current) return;
      if (image.naturalWidth > 8192 || image.naturalHeight > 8192 || image.naturalWidth * image.naturalHeight > 25000000) return fail('PHOTO_DIMENSIONS');
      setDimensions({ width: image.naturalWidth, height: image.naturalHeight });
      setFile(chosen); setCrop({ x: .5, y: .5, zoom: 1 }); setPhotoAction('replace'); setError(null);
    } catch { if (requestId === selection.current) fail('PHOTO_DAMAGED'); }
    finally { URL.revokeObjectURL(url); }
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const fields = {};
    if (!draft.name.trim()) fields.name = 'NAME_REQUIRED';
    if (draft.birthDate && (draft.birthDate > dateString() || draft.birthDate < '1900-01-01')) fields.birthDate = 'INVALID_BIRTH_DATE';
    if (Object.keys(fields).length) { setError({ fields }); document.getElementById(`pet-${Object.keys(fields)[0]}`)?.focus(); return; }
    submitting.current = true; setSaving(true); setError(null);
    const data = new FormData();
    data.append('data', JSON.stringify({ ...draft, photoAction, crop, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }));
    if (file && photoAction === 'replace') data.append('photo', file);
    try { const result = await request(pet ? `/pets/${pet.id}` : '/pets', { method: pet ? 'PUT' : 'POST', body: data }); onSaved(result.pet); }
    catch (failure) { setError(failure); requestAnimationFrame(() => document.getElementById(`pet-${Object.keys(failure.fields || {})[0]}`)?.focus()); }
    finally { submitting.current = false; setSaving(false); }
  }
  const attributes = key => ({ id: `pet-${key}`, disabled: saving, 'aria-invalid': Boolean(fieldError(key)), 'aria-describedby': fieldError(key) ? `error-${key}` : undefined });
  const errorFor = key => <div id={`error-${key}`}><ErrorMessage error={fieldError(key)} /></div>;
  const source = photoAction === 'remove' ? null : preview || pet?.photoUrl;
  const side = dimensions ? Math.min(dimensions.width, dimensions.height) / crop.zoom : 1;
  return <Modal title={t(pet ? 'account.editPet' : 'account.addPet')} onClose={() => { if (!submitting.current) onClose(); }}>
    <form className="pet-form" onSubmit={submit} noValidate aria-busy={saving}>
      <p className="muted">{t('account.requiredHint')}</p>
      <label htmlFor="pet-name">{t('account.name')} *</label><input {...attributes('name')} autoFocus value={draft.name} maxLength={80} onChange={e => change('name', e.target.value)} autoComplete="off" />{errorFor('name')}
      <div className="form-columns"><div><label htmlFor="pet-species">{t('account.species')} *</label><select {...attributes('species')} value={draft.species} onChange={e => change('species', e.target.value)}>{species.map(value => <option key={value} value={value}>{t(`account.speciesOptions.${value}`)}</option>)}</select>{errorFor('species')}</div><div><label htmlFor="pet-sex">{t('account.sex')}</label><select {...attributes('sex')} value={draft.sex} onChange={e => change('sex', e.target.value)}>{['unknown', 'female', 'male'].map(value => <option key={value} value={value}>{t(`account.sexOptions.${value}`)}</option>)}</select>{errorFor('sex')}</div></div>
      <label htmlFor="pet-breed">{t('account.breed')}</label><input {...attributes('breed')} value={draft.breed} maxLength={120} onChange={e => change('breed', e.target.value)} />{errorFor('breed')}
      <label htmlFor="pet-birthDate">{t('birthDate')}</label><input {...attributes('birthDate')} type="date" min="1900-01-01" max={dateString()} value={draft.birthDate} onChange={e => change('birthDate', e.target.value)} />{errorFor('birthDate')}
      <label className="account-checkbox"><input type="checkbox" checked={draft.birthApproximate} disabled={saving || !draft.birthDate} onChange={e => change('birthApproximate', e.target.checked)} />{t('account.approximateDate')}</label>
      <fieldset className="photo-editor" disabled={saving}><legend>{t('account.photo')}</legend><p id="photo-hint" className="small muted">{t('account.photoHint')}</p>
        {source ? <div className="crop-preview" role="img" aria-label={t('account.photoPreview')} style={preview ? { backgroundImage: `url("${preview}")`, backgroundSize: `${dimensions.width / side * 100}% ${dimensions.height / side * 100}%`, backgroundPosition: `${crop.x * 100}% ${crop.y * 100}%` } : { backgroundImage: `url("${source}")` }} /> : <div className="photo-placeholder" aria-label={t('account.noPhoto')}><Icon name="paw" size={64} /></div>}
        <input ref={fileInput} id="pet-photo" type="file" accept="image/jpeg,image/png,image/webp" aria-describedby="photo-hint error-photo" onChange={choosePhoto} />
        <label className="sr-only" htmlFor="pet-photo">{t('account.choosePhoto')}</label>
        {preview && <div className="crop-controls">{['zoom', 'x', 'y'].map(key => <label key={key} htmlFor={`crop-${key}`}>{t(`account.crop.${key}`)}<input id={`crop-${key}`} type="range" min={key === 'zoom' ? 1 : 0} max={key === 'zoom' ? 3 : 1} step="0.01" value={crop[key]} onChange={e => setCrop({ ...crop, [key]: Number(e.target.value) })} /></label>)}</div>}
        {source && <button className="button secondary" type="button" onClick={() => { selection.current++; setFile(null); setPhotoAction('remove'); }}>{t('account.removePhoto')}</button>}
        {errorFor('photo')}
      </fieldset>
      {['features', 'allergies', 'notes'].map(key => <div className="long-field" key={key}><label htmlFor={`pet-${key}`}>{t(`account.${key}`)}</label><textarea {...attributes(key)} rows={3} maxLength={key === 'notes' ? 4000 : 2000} value={draft[key]} onChange={e => change(key, e.target.value)} />{errorFor(key)}</div>)}
      <ErrorMessage error={error?.code === 'VALIDATION_ERROR' ? null : error?.code} />
      <div className="modal-actions"><button disabled={saving} type="button" className="button secondary" onClick={onClose}>{t('cancel')}</button><button disabled={saving} className="button primary" type="submit">{t(saving ? 'account.saving' : 'account.save')}</button></div>
    </form>
  </Modal>;
}
