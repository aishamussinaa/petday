// Date-only arithmetic stays in UTC; callers supply the user's local calendar date.
export function shiftDay(day, offset) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function weeklySummary({ end, tasks = [], routines = [], meals = [], weights = [] }) {
  const start = shiftDay(end, -6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = shiftDay(start, index);
    const saved = tasks.filter(task => task.day === date);
    const scheduled = new Set(saved.map(task => task.routineId).filter(Boolean));
    // Include unvisited routine days without writing records. A deleted instance
    // still suppresses its routine, and edited instances retain their own target.
    const items = saved.filter(task => !task.deletedAt);
    for (const routine of routines) {
      if (!scheduled.has(routine.id) && routine.startDay <= date && (!routine.stopDay || routine.stopDay > date) && routine.weekdays.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) {
        items.push({ category: routine.category, targetCount: routine.targetCount, completedCount: 0 });
      }
    }
    const sum = (key, category) => items.filter(item => !category || item.category === category).reduce((total, item) => total + item[key], 0);
    const target = sum('targetCount'), done = sum('completedCount');
    return { date, target, done, walkTarget: sum('targetCount', 'walk'), walks: sum('completedCount', 'walk'), meals: meals.filter(meal => meal.day === date && !meal.deletedAt).length, allDone: target > 0 && done === target };
  });
  const total = key => days.reduce((sum, day) => sum + day[key], 0);
  const measurements = weights.filter(item => !item.deletedAt && item.date >= start && item.date <= end).sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  const first = measurements[0], last = measurements.at(-1);
  return { start, end, days, done: total('done'), target: total('target'), walks: total('walks'), walkTarget: total('walkTarget'), meals: total('meals'), completeDays: days.filter(day => day.allDone).length, plannedDays: days.filter(day => day.target > 0).length, weight: { count: measurements.length, first: first ? { date: first.date, kg: Number(first.kg) } : null, last: last ? { date: last.date, kg: Number(last.kg) } : null, change: measurements.length >= 2 ? Math.round((Number(last.kg) - Number(first.kg)) * 1000) / 1000 : null } };
}
