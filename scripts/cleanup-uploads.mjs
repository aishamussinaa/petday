import { cleanup } from '../server/src/photos.js';
import { disconnect } from '../server/src/db.js';
try { await cleanup(); console.log('Проверены неиспользуемые фото старше одного часа и завершённые сессии.'); }
catch { console.error('Очистка не выполнена: проверьте подключение базы и каталог загрузок.'); process.exitCode = 1; }
finally { await disconnect(); }
