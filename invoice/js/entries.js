/**
 * Entries CRUD — invoice_entries
 */

function mapEntryRow(row) {
  if (!row) return null;
  const status = row.payment_status === 'paid' ? 'paid' : 'pending';
  return {
    id: row.id,
    clientId: row.client_id,
    workDate: row.work_date || '',
    hours: Number(row.hours) || 0,
    rateSnapshot: Number(row.rate_snapshot) || 0,
    description: row.description || '',
    paymentStatus: status,
    createdAt: row.created_at || null,
    clientName: row.invoice_clients?.name || null
  };
}

function entryToRow(data) {
  const status = data.paymentStatus === 'paid' ? 'paid' : 'pending';
  return {
    client_id: data.clientId,
    work_date: data.workDate || todayISO(),
    hours: Number(data.hours) || 0,
    rate_snapshot: Number(data.rateSnapshot) || 0,
    description: (data.description || '').trim(),
    payment_status: status
  };
}

async function getEntries(filters = {}) {
  assertSupabaseConfigured();
  let q = sb
    .from('invoice_entries')
    .select('*, invoice_clients(name)')
    .order('work_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.clientId) q = q.eq('client_id', filters.clientId);
  if (filters.from) q = q.gte('work_date', filters.from);
  if (filters.to) q = q.lte('work_date', filters.to);

  const { data, error } = await q;
  if (error) throw new Error(supabaseError(error, 'Failed to load entries'));
  return (data || []).map(mapEntryRow);
}

async function createEntry(data) {
  assertSupabaseConfigured();
  const row = entryToRow(data);
  if (!row.client_id) throw new Error('Client is required');
  if (!row.work_date) throw new Error('Date is required');
  if (!(row.hours > 0)) throw new Error('Hours must be greater than 0');
  if (row.rate_snapshot < 0) throw new Error('Rate must be 0 or greater');

  const { data: created, error } = await sb
    .from('invoice_entries')
    .insert(row)
    .select('*, invoice_clients(name)')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to add entry'));
  return mapEntryRow(created);
}

async function updateEntry(id, data) {
  assertSupabaseConfigured();
  const row = entryToRow(data);
  if (!row.client_id) throw new Error('Client is required');
  if (!(row.hours > 0)) throw new Error('Hours must be greater than 0');

  const { data: updated, error } = await sb
    .from('invoice_entries')
    .update(row)
    .eq('id', id)
    .select('*, invoice_clients(name)')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to update entry'));
  return mapEntryRow(updated);
}

async function updateEntryStatus(id, paymentStatus) {
  assertSupabaseConfigured();
  const status = paymentStatus === 'paid' ? 'paid' : 'pending';
  const { data: updated, error } = await sb
    .from('invoice_entries')
    .update({ payment_status: status })
    .eq('id', id)
    .select('*, invoice_clients(name)')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to update status'));
  return mapEntryRow(updated);
}

async function deleteEntry(id) {
  assertSupabaseConfigured();
  const { error } = await sb.from('invoice_entries').delete().eq('id', id);
  if (error) throw new Error(supabaseError(error, 'Failed to delete entry'));
}
