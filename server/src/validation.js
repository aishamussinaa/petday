export class ApiError extends Error {
  constructor(status, code, fields) { super(code); this.status = status; this.code = code; this.fields = fields; }
}

export function validDate(value, today) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '1900-01-01' && value <= today;
}
export function todayInZone(zone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type).value).join('-');
  } catch { throw new ApiError(400, 'INVALID_TIMEZONE'); }
}
export function validatePet(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError(400, 'INVALID_INPUT');
  const errors = {};
  const result = {};
  for (const [key, max] of Object.entries({ name: 80, breed: 120, features: 2000, allergies: 2000, notes: 4000 })) {
    if (typeof input[key] !== 'string' || input[key].trim().length > max || (key === 'name' && !input[key].trim())) errors[key] = key === 'name' ? 'NAME_REQUIRED' : 'TEXT_TOO_LONG';
    else result[key] = input[key].trim();
  }
  if (!['cat', 'dog', 'bird', 'rabbit', 'rodent', 'fish', 'reptile', 'other'].includes(input.species)) errors.species = 'SPECIES_REQUIRED';
  else result.species = input.species;
  if (!['unknown', 'female', 'male'].includes(input.sex)) errors.sex = 'INVALID_INPUT';
  else result.sex = input.sex;
  const birth = input.birthDate;
  if (birth !== null && birth !== '' && !validDate(birth, todayInZone(input.timeZone))) errors.birthDate = 'INVALID_BIRTH_DATE';
  else result.birthDate = birth ? new Date(`${birth}T00:00:00Z`) : null;
  if (typeof input.birthApproximate !== 'boolean') errors.birthApproximate = 'INVALID_INPUT';
  result.birthApproximate = Boolean(birth && input.birthApproximate);
  if (!['keep', 'replace', 'remove'].includes(input.photoAction)) errors.photo = 'INVALID_PHOTO';
  if (Object.keys(errors).length) throw new ApiError(400, 'VALIDATION_ERROR', errors);
  return result;
}
export function credentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = body?.password;
  const fields = {};
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'INVALID_EMAIL';
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) fields.password = 'INVALID_PASSWORD';
  if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_ERROR', fields);
  return { email, password };
}
