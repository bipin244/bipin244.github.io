/**
 * Devices CRUD — Supabase `devices` table
 * Device types (categories) live in `device_types` — see categories.js
 */

function getDeviceCategories() {
  if (typeof AppStore !== 'undefined') {
    return AppStore.getCategories();
  }
  return [];
}

/** Ordered type names for pickers / selects */
function getDeviceTypeNames() {
  return getDeviceCategories().map(c => c.name);
}

function deviceTypeIcon(type) {
  const match = getDeviceCategories().find(c => c.name === type);
  return match?.icon || 'bi-cpu';
}

function deviceTypeBadgeHtml(type) {
  const t = type || 'Other';
  return `<i class="bi ${deviceTypeIcon(t)}" aria-hidden="true"></i> ${escapeHtml(t)}`;
}

function mapDeviceRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    deviceType: row.device_type || '',
    model: row.model || '',
    serialNumber: row.serial_number || '',
    installationDate: row.installation_date || '',
    remarks: row.remarks || '',
    createdAt: row.created_at || null,
    siteName: row.sites?.name || null
  };
}

function deviceToRow(data) {
  return {
    site_id: data.siteId,
    device_type: (data.deviceType || '').trim(),
    model: (data.model || '').trim(),
    serial_number: (data.serialNumber || '').trim(),
    installation_date: data.installationDate || todayISO(),
    remarks: (data.remarks || '').trim()
  };
}

/**
 * Devices for one site (ordered by type)
 */
async function getDevices(siteId) {
  assertSupabaseConfigured();
  try {
    const { data, error } = await sb
      .from('devices')
      .select('*')
      .eq('site_id', siteId)
      .order('device_type', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(supabaseError(error, 'Failed to load devices'));
    return (data || []).map(mapDeviceRow);
  } catch (e) {
    throw new Error(e.message || 'Failed to load devices');
  }
}

/**
 * Add a device
 */
async function addDevice(data) {
  assertSupabaseConfigured();
  try {
    const row = deviceToRow(data);
    if (!row.site_id) throw new Error('Site is required');
    if (!row.device_type || !row.serial_number) {
      throw new Error('Device type and serial number are required');
    }

    const { data: created, error } = await sb
      .from('devices')
      .insert(row)
      .select('*')
      .single();

    if (error) throw new Error(supabaseError(error, 'Failed to add device'));
    return mapDeviceRow(created);
  } catch (e) {
    throw new Error(e.message || 'Failed to add device');
  }
}

/**
 * Update a device
 */
async function updateDevice(id, data) {
  assertSupabaseConfigured();
  try {
    const row = {
      device_type: (data.deviceType || '').trim(),
      model: (data.model || '').trim(),
      serial_number: (data.serialNumber || '').trim(),
      installation_date: data.installationDate || todayISO(),
      remarks: (data.remarks || '').trim()
    };
    if (!row.device_type || !row.serial_number) {
      throw new Error('Device type and serial number are required');
    }

    const { data: updated, error } = await sb
      .from('devices')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw new Error(supabaseError(error, 'Failed to update device'));
    return mapDeviceRow(updated);
  } catch (e) {
    throw new Error(e.message || 'Failed to update device');
  }
}

/**
 * Delete a device
 */
async function deleteDevice(id) {
  assertSupabaseConfigured();
  try {
    const { error } = await sb.from('devices').delete().eq('id', id);
    if (error) throw new Error(supabaseError(error, 'Failed to delete device'));
  } catch (e) {
    throw new Error(e.message || 'Failed to delete device');
  }
}

/**
 * Search devices by serial number (partial match)
 */
async function searchBySerial(serial) {
  assertSupabaseConfigured();
  const q = (serial || '').trim();
  if (!q) return [];

  try {
    const { data, error } = await sb
      .from('devices')
      .select('*, sites(name)')
      .ilike('serial_number', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(supabaseError(error, 'Search failed'));
    return (data || []).map(mapDeviceRow);
  } catch (e) {
    throw new Error(e.message || 'Search failed');
  }
}

/** Compatibility helpers for UI */
const DevicesService = {
  getBySite: getDevices,
  create: addDevice,
  update: updateDevice,
  delete: deleteDevice,
  searchBySerial,
  build(data) {
    return {
      deviceType: (data.deviceType || '').trim(),
      model: (data.model || '').trim(),
      serialNumber: (data.serialNumber || '').trim(),
      installationDate: data.installationDate || todayISO(),
      remarks: (data.remarks || '').trim()
    };
  }
};
