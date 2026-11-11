import { createContext, useContext, useState } from 'react';
import { createDemo } from './demo.js';

const DemoContext = createContext(null);
export function DemoProvider({ children }) {
  const [demo] = useState(() => createDemo());
  const [tasks, setTasks] = useState(demo.tasks);
  const [selected, setSelected] = useState('tommy');
  return <DemoContext.Provider value={{ demo, tasks, setTasks, selected, setSelected }}>{children}</DemoContext.Provider>;
}
export const useDemo = () => useContext(DemoContext);
