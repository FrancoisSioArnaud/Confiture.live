import { httpJson } from './httpClient.js';
export const jamsApi = { list:()=>httpJson('/jams/'), get:(jamId)=>httpJson(`/jams/${jamId}/`), pushTransaction:(jamId,body)=>httpJson(`/jams/${jamId}/transactions/`,{method:'POST',body:JSON.stringify(body)}), acquireLease:(jamId,body)=>httpJson(`/jams/${jamId}/lease/`,{method:'POST',body:JSON.stringify(body)}) };
