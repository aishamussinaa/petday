import { createContext, useContext } from 'react';
import { request } from './api.js';

// Real accounts use the network by default. Demo components receive a separate,
// in-memory implementation; it never falls back to the account API.
export const ApiContext = createContext(request);
export const useApi = () => useContext(ApiContext);
