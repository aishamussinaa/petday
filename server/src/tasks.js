import { Router } from 'express';
import { randomUUID } from 'node:crypto';
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
  const targetCount=body.targetCount??1;
  if(!Number.isInteger(targetCount)||targetCount<1||targetCount>20) throw new ApiError(400,'TASK_TARGET');
  return { title:body.title.trim(), category:body.category, time:body.time, notes:body.notes.trim(), targetCount };
}
const lockPet=(tx,id)=>tx.$queryRaw`SELECT id FROM "Pet" WHERE id = ${id}::uuid FOR UPDATE`;
tasks.use(session, requireUser, async (req,_res,next) => {
  if (!uuid(req.params.petId) || !await database().pet.findFirst({where:{id:req.params.petId,userId:req.session.user.id},select:{id:true}})) throw new ApiError(404,'PET_NOT_FOUND');
  next();
});
tasks.get('/', async (req,res) => {
  const selected = day(req.query.date);
  const where = {petId:req.params.petId,day:selected};
  // Lazy materialization works even if the app was closed overnight. A unique
  // routine/date pair includes deleted instances so they cannot reappear.
  await database().$transaction(async tx=>{
    await lockPet(tx,req.params.petId);
    const routines=await tx.careRoutine.findMany({where:{petId:req.params.petId,startDay:{lte:selected},OR:[{stopDay:null},{stopDay:{gt:selected}}]}});
    for(const routine of routines){
      if(!routine.weekdays.includes(selected.getUTCDay()))continue;
      await tx.careTask.createMany({data:[{id:randomUUID(),petId:req.params.petId,day:selected,routineId:routine.id,title:routine.title,category:routine.category,time:routine.time,notes:routine.notes,targetCount:routine.targetCount}],skipDuplicates:true});
    }
  });
  const [items,events] = await database().$transaction([
    database().careTask.findMany({where:{...where,deletedAt:null},orderBy:[{time:'asc'},{createdAt:'asc'}]}),
    database().careEvent.findMany({where:{task:where},orderBy:[{createdAt:'desc'},{version:'desc'}],take:100}),
  ]);
  items.sort((a,b)=>(a.time||'99:99').localeCompare(b.time||'99:99'));
  const routines=await database().careRoutine.findMany({where:{petId:req.params.petId,stopDay:null},orderBy:{createdAt:'asc'}});
  res.json({tasks:items.map(publicTask),events,routines:routines.map(r=>({...r,startDay:r.startDay.toISOString().slice(0,10)}))});
});
tasks.post('/routines',csrf,async(req,res)=>{
  const data=fields(req.body),startDay=day(req.body.day);
  const weekdays=req.body.weekdays;
  if(!uuid(req.body.id)||!Array.isArray(weekdays)||weekdays.length<1||weekdays.length>7||weekdays.some(n=>!Number.isInteger(n)||n<0||n>6)||new Set(weekdays).size!==weekdays.length)throw new ApiError(400,'TASK_WEEKDAYS');
  const sorted=[...weekdays].sort((a,b)=>a-b);
  try{
    const routine=await database().careRoutine.create({data:{...data,id:req.body.id,petId:req.params.petId,startDay,weekdays:sorted}});
    res.status(201).json({id:routine.id});
  }catch(error){
    if(error.code!=='P2002')throw error;
    const existing=await database().careRoutine.findFirst({where:{id:req.body.id,petId:req.params.petId,stopDay:null}});
    if(!existing||existing.startDay.getTime()!==startDay.getTime()||JSON.stringify(existing.weekdays)!==JSON.stringify(sorted)||Object.entries(data).some(([k,v])=>existing[k]!==v))throw new ApiError(409,'TASK_CHANGED');
    res.json({id:existing.id});
  }
});
tasks.post('/routines/:id/stop',csrf,async(req,res)=>{
  if(!uuid(req.params.id))throw new ApiError(404,'TASK_NOT_FOUND');
  const stopDay=day(todayInZone(req.body?.timeZone));stopDay.setUTCDate(stopDay.getUTCDate()+1);
  await database().$transaction(async tx=>{
    await lockPet(tx,req.params.petId);
    const routine=await tx.careRoutine.findFirst({where:{id:req.params.id,petId:req.params.petId}});
    if(!routine)throw new ApiError(404,'TASK_NOT_FOUND');
    if(routine.stopDay)return;
    await tx.careRoutine.update({where:{id:routine.id},data:{stopDay}});
    const future=await tx.careTask.findMany({where:{routineId:routine.id,day:{gte:stopDay},completedCount:0,deletedAt:null}});
    for(const task of future){
      const changed=await tx.careTask.updateMany({where:{id:task.id,version:task.version,completedCount:0,deletedAt:null},data:{deletedAt:new Date(),version:{increment:1}}});
      if(changed.count)await tx.careEvent.create({data:{taskId:task.id,action:'deleted',title:task.title,version:task.version+1}});
    }
  });
  res.json({stopped:true});
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
    if(mode==='state'||mode==='count'){
      if(mode==='state'&&(typeof req.body.completed!=='boolean'||task.targetCount!==1)) throw new ApiError(400,'INVALID_INPUT');
      if(mode==='count'&&![1,-1].includes(req.body.delta))throw new ApiError(400,'INVALID_INPUT');
      const count=mode==='state'?(req.body.completed?1:0):task.completedCount+req.body.delta;
      if(count<0||count>task.targetCount)throw new ApiError(400,'TASK_COUNT');
      if(count>task.completedCount && task.day.toISOString().slice(0,10)>todayInZone(req.body.timeZone)) throw new ApiError(400,'TASK_FUTURE');
      // An identical replay of the current state is harmless and doesn't rewrite time/history.
      if(task.completedCount===count && req.body.version===task.version) return task;
      update={completedCount:count,completedAt:count===task.targetCount?new Date():null}; action=mode==='state'?(req.body.completed?'completed':'reopened'):(req.body.delta===1?'progressed':'reduced');
    } else if(mode==='delete'){ update={deletedAt:new Date()}; action='deleted'; }
    else { update=fields(req.body); if(update.targetCount<task.completedCount)throw new ApiError(400,'TASK_TARGET_BELOW_COUNT'); update.completedAt=update.targetCount===task.completedCount?(task.completedAt||new Date()):null; action='edited'; }
    const changed=await tx.careTask.updateMany({where:{id:task.id,version:req.body.version,deletedAt:null},data:{...update,version:{increment:1}}});
    if(changed.count!==1) throw new ApiError(409,'TASK_CHANGED');
    const updated=await tx.careTask.findUnique({where:{id:task.id}});
    await tx.careEvent.create({data:{taskId:task.id,action,title:updated.title,version:updated.version,completedCount:updated.completedCount,targetCount:updated.targetCount}});
    return updated;
  });
  res.json({task:publicTask(result)});
}
tasks.patch('/:id/state',csrf,(req,res)=>mutate(req,res,'state'));
tasks.patch('/:id/count',csrf,(req,res)=>mutate(req,res,'count'));
tasks.put('/:id',csrf,(req,res)=>mutate(req,res,'edit'));
tasks.delete('/:id',csrf,(req,res)=>mutate(req,res,'delete'));
