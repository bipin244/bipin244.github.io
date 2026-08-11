/**
 * Clients CRUD — invoice_clients
 */

function mapClientRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    hourlyRate: Number(row.hourly_rate) || 0,
    email: row.email || '',
    address: row.address || '',
    notes: row.notes || '',
    createdAt: row.created_at || null
  };
}

function clientToRow(data) {
  return {
    name: (data.name || '').trim(),
    hourly_rate: Number(data.hourlyRate) || 0,
    email: (data.email || '').trim(),
    address: (data.address || '').trim(),
    notes: (data.notes || '').trim()
  };
}

async function getClients() {
  assertSupabaseConfigured();
  const { data, error } = await sb
    .from('invoice_clients')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw new Error(supabaseError(error, 'Failed to load clients'));
  return (data || []).map(mapClientRow);
}

async function createClient(data) {
  assertSupabaseConfigured();
  const row = clientToRow(data);
  if (!row.name) throw new Error('Client name is required');
  if (row.hourly_rate < 0) throw new Error('Rate must be 0 or greater');
  const { data: created, error } = await sb
    .from('invoice_clients')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to add client'));
  return mapClientRow(created);
}

async function updateClient(id, data) {
  assertSupabaseConfigured();
  const row = clientToRow(data);
  if (!row.name) throw new Error('Client name is required');
  const { data: updated, error } = await sb
    .from('invoice_clients')
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to update client'));
  return mapClientRow(updated);
}

async function deleteClient(id) {
  assertSupabaseConfigured();
  const { error } = await sb.from('invoice_clients').delete().eq('id', id);
  if (error) throw new Error(supabaseError(error, 'Failed to delete client'));
}
