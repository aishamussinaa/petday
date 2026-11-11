import { addDays, dateOnly } from '../dateUtils.js';
export const categories = ['food', 'water', 'walk', 'care', 'other'];
export function createDemo(now = new Date()) {
  const today = dateOnly(now);
  const pets = [
    { id: 'tommy', name: 'Томми', image: '/images/poodle.jpg', species: 'dog', breed: 'toyPoodle', birth: null, vetDate: addDays(today, 6), visitDate: addDays(today, -24), note: 'tommyNote' },
    { id: 'uma', name: 'Ума', image: '/images/uma.jpg', species: 'cat', breed: 'unknown', birth: null, vetDate: addDays(today, 12), visitDate: addDays(today, -14), note: 'umaNote' },
  ];
  const task = (id, titleKey, category, time, done = false) => ({ id, titleKey, category, time, done, completedAt: done ? new Date(today.getFullYear(), today.getMonth(), today.getDate(), ...time.split(':').map(Number)).toISOString() : null });
  return { pets, tasks: {
    tommy: [task('t1', 'breakfast', 'food', '08:00', true), task('t2', 'morningWalk', 'walk', '08:30', true), task('t3', 'freshWater', 'water', '11:00'), task('t4', 'brushing', 'care', '14:00'), task('t5', 'eveningWalk', 'walk', '17:30'), task('t6', 'dinner', 'food', '19:00')],
    uma: [task('l1', 'breakfast', 'food', '08:30', true), task('l2', 'freshWater', 'water', '12:00'), task('l3', 'brushing', 'care', '16:00'), task('l4', 'dinner', 'food', '19:30')],
  } };
}
