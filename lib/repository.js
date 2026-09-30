// Persistence boundary. In demo mode this uses deterministic seed data.
// A managed database adapter can replace these functions without changing routes.
const seedClients=[];
export async function listClients(){return seedClients}
export async function getDashboard(){const clients=await listClients();return {activeClients:clients.length,mrr:0,scansToday:0,approvals:0}}
export async function addClient(input){return {id:crypto.randomUUID(),...input,status:"pending",createdAt:new Date().toISOString()}}
