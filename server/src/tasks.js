import { Router } from 'express';
import { database } from './db.js';
import { session, requireUser, csrf } from './auth.js';
import { ApiError, validDate, todayInZone } from './validation.js';

export const tasks = Router({ mergeParams: true });
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const publicTask = task => ({ ...task, day: task.day.toISOString().slice(0,10) });
function day(value) {
  if (!validDate(value, '2100-12-31')) throw new ApiError(400,'TASK_DATE');
  return new Date(`${value}T00:00:00Z`);
}
function fields(body) {
  if (!body || typeof body !== 'object') throw new ApiError(400,'INVALID_INPUT');
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.trim().length > 120) throw new ApiError(400,'TASK_TITLE');
  if (!['food','water','walk','care','other'].includes(body.category)) throw new ApiError(400,'TASK_CATEGORY');
  if (typeof body.time !== 'string' || (body.time !== '' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time))) throw new ApiError(400,'TASK_TIME');
  if (typeof body.notes !== 'string' || body.notes.length > 1000) throw new ApiError(400,'TASK_NOTES');
  return { title:body.title.trim(), category:body.category, time:body.time, notes:body.notes.trim() };
}
tasks.use(session, requireUser, async (req,_res,next) => {
  if (!uuid(req.params.petId) || !await database().pet.findFirst({where:{id:req.params.petId,userId:req.session.user.id},select:{id:true}})) throw new ApiError(404,'PET_NOT_FOUND');
  next();
});
tasks.get('/', async (req,res) => {
  const selected = day(req.query.date);
  const where = {petId:req.params.petId,day:selected};
  const [items,events] = await database().$transaction([
    database().careTask.findMany({where:{...where,deletedAt:null},orderBy:[{time:'asc'},{createdAt:'asc'}]}),
    database().careEvent.findMany({where:{task:where},orderBy:[{createdAt:'desc'},{version:'desc'}],take:100}),
  ]);
  items.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  res.json({tasks:items.map(publicTask),events});
});
tasks.post('/',csrf,async(req,res)=>{
  const data=fields(req.body), selected=day(req.body.day);
  if (!uuid(req.body.id)) throw new ApiError(400,'INVALID_INPUT');
  try {
    const task=await database().careTask.create({data:{...data,id:req.body.id,petId:req.params.petId,day:selected,events:{create:{action:'created',title:data.title,version:1}}}});
    res.status(201).json({task:publicTask(task)});
  } catch(error) {
    if(error.code!=='P2002') throw error;
    // Retrying a lost response must not create a duplicate task.
    const existing=await database().careTask.findFirst({where:{id:req.body.id,petId:req.params.petId,deletedAt:null}});
    if(!existing || existing.day.getTime()!==selected.getTime() || Object.entries(data).some(([key,value])=>existing[key]!==value)) throw new ApiError(409,'TASK_CHANGED');
    res.json({task:publicTask(existing)});
  }
});
async function mutate(req,res,mode){
  if(!uuid(req.params.id)) throw new ApiError(404,'TASK_NOT_FOUND');
  if(!Number.isInteger(req.body?.version) || req.body.version<1) throw new ApiError(400,'INVALID_INPUT');
  const result=await database().$transaction(async tx=>{
    const task=await tx.careTask.findFirst({where:{id:req.params.id,petId:req.params.petId,deletedAt:null}});
    if(!task) throw new ApiError(404,'TASK_NOT_FOUND');
    let update,action;
    if(mode==='state'){
      if(typeof req.body.completed!=='boolean') throw new ApiError(400,'INVALID_INPUT');
      if(req.body.completed && task.day.toISOString().slice(0,10)>todayInZone(req.body.timeZone)) throw new ApiError(400,'TASK_FUTURE');
      // An identical replay of the current state is harmless and doesn't rewrite time/history.
      if(Boolean(task.completedAt)===req.body.completed && req.body.version===task.version) return task;
      update={completedAt:req.body.completed?new Date():null}; action=req.body.completed?'completed':'reopened';
    } else if(mode==='delete'){ update={deletedAt:new Date()}; action='deleted'; }
    else { update=fields(req.body); action='edited'; }
    const changed=await tx.careTask.updateMany({where:{id:task.id,version:req.body.version,deletedAt:null},data:{...update,version:{increment:1}}});
    if(changed.count!==1) throw new ApiError(409,'TASK_CHANGED');
    const updated=await tx.careTask.findUnique({where:{id:task.id}});
    await tx.careEvent.create({data:{taskId:task.id,action,title:updated.title,version:updated.version}});
    return updated;
  });
  res.json({task:publicTask(result)});
}
tasks.patch('/:id/state',csrf,(req,res)=>mutate(req,res,'state'));
tasks.put('/:id',csrf,(req,res)=>mutate(req,res,'edit'));
tasks.delete('/:id',csrf,(req,res)=>mutate(req,res,'delete'));
