/**
 * Sites CRUD — Supabase `sites` table
 * Maps snake_case columns ↔ camelCase used by the UI
 */

function mapSiteRow(row) {
  if (!row) return null;
  const countFromEmbed = Array.isArray(row.devices)
    ? (row.devices[0]?.count ?? row.devices.length)
    : undefined;
  return {
    id: row.id,
    name: row.name || '',
    customer: row.customer || '',
    address: row.address || '',
    contactPerson: row.contact_person || '',
    phone: row.phone || '',
    notes: row.notes || '',
    createdAt: row.created_at || null,
    updatedAt: row.created_at || null,
    deviceCount: typeof countFromEmbed === 'number' ? countFromEmbed : (row.deviceCount || 0),
    devices: []
  };
}

function siteToRow(data) {
  return {
    name: (data.name || '').trim(),
    customer: (data.customer || '').trim(),
    address: (data.address || '').trim(),
    contact_person: (data.contactPerson || '').trim(),
    phone: (data.phone || '').trim(),
    notes: (data.notes || '').trim()
  };
}

/**
 * List all sites with device counts (newest first)
 */
async function getSites() {
  assertSupabaseConfigured();
  try {
    const { data, error } = await sb
      .from('sites')
      .select('*, devices(count)')
      .order('created_at', { ascending: false });

    if (error) throw new Error(supabaseError(error, 'Failed to load sites'));
    return (data || []).map(mapSiteRow);
  } catch (e) {
    throw new Error(e.message || 'Failed to load sites');
  }
}

/**
 * Get one site by id
 */
async function getSite(id) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await sb
      .from('sites')
      .select('*, devices(count)')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(supabaseError(error, 'Failed to load site'));
    return mapSiteRow(data);
  } catch (e) {
    throw new Error(e.message || 'Failed to load site');
  }
}

/**
 * Create a site
 */
async function createSite(data) {
  assertSupabaseConfigured();
  try {
    const row = siteToRow(data);
    if (!row.name || !row.customer) {
      throw new Error('Site name and customer are required');
    }

    const { data: created, error } = await sb
      .from('sites')
      .insert(row)
      .select('*, devices(count)')
      .single();

    if (error) throw new Error(supabaseError(error, 'Failed to create site'));
    return mapSiteRow(created);
  } catch (e) {
    throw new Error(e.message || 'Failed to create site');
  }
}

/**
 * Update a site
 */
async function updateSite(id, data) {
  assertSupabaseConfigured();
  try {
    const row = siteToRow(data);
    if (!row.name || !row.customer) {
      throw new Error('Site name and customer are required');
    }

    const { data: updated, error } = await sb
      .from('sites')
      .update(row)
      .eq('id', id)
      .select('*, devices(count)')
      .single();

    if (error) throw new Error(supabaseError(error, 'Failed to update site'));
    return mapSiteRow(updated);
  } catch (e) {
    throw new Error(e.message || 'Failed to update site');
  }
}

/**
 * Delete a site (devices removed via ON DELETE CASCADE or explicit delete)
 */
async function deleteSite(id) {
  assertSupabaseConfigured();
  try {
    // Remove devices first (safe even with CASCADE)
    const { error: devErr } = await sb.from('devices').delete().eq('site_id', id);
    if (devErr) throw new Error(supabaseError(devErr, 'Failed to delete site devices'));

    const { error } = await sb.from('sites').delete().eq('id', id);
    if (error) throw new Error(supabaseError(error, 'Failed to delete site'));
  } catch (e) {
    throw new Error(e.message || 'Failed to delete site');
  }
}

/** Compatibility aliases used by existing UI code */
const SitesService = {
  getAll: getSites,
  getById: getSite,
  create: createSite,
  update: updateSite,
  delete: deleteSite
};
