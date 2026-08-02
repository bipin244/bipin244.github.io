/**
 * Device categories (types) CRUD — Supabase `device_types` table
 */

/** Curated Bootstrap Icons for the category icon picker */
const CATEGORY_ICON_OPTIONS = [
  'bi-camera-video',
  'bi-hdd-rack',
  'bi-film',
  'bi-device-hdd',
  'bi-ethernet',
  'bi-wifi',
  'bi-lightning-charge',
  'bi-plug',
  'bi-bezier2',
  'bi-box',
  'bi-cpu',
  'bi-display',
  'bi-speaker',
  'bi-mic',
  'bi-battery-charging',
  'bi-usb-symbol',
  'bi-broadcast',
  'bi-shield-check',
  'bi-gear',
  'bi-upc-scan',
  'bi-router',
  'bi-hdd-network',
  'bi-modem',
  'bi-sd-card'
];

function mapCategoryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || '',
    icon: row.icon || 'bi-cpu',
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : 0,
    createdAt: row.created_at || null
  };
}

/**
 * List all categories ordered by sort_order, then name
 */
async function getCategories() {
  assertSupabaseConfigured();
  try {
    const { data, error } = await sb
      .from('device_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      if (isMissingDeviceTypesTable(error)) {
        const err = new Error(
          'Table device_types is missing. Run scanner/supabase/migration_device_types.sql in the Supabase SQL Editor.'
        );
        err.code = 'DEVICE_TYPES_MISSING';
        throw err;
      }
      throw new Error(supabaseError(error, 'Failed to load categories'));
    }
    return (data || []).map(mapCategoryRow);
  } catch (e) {
    if (e.code === 'DEVICE_TYPES_MISSING') throw e;
    throw new Error(e.message || 'Failed to load categories');
  }
}

function isMissingDeviceTypesTable(error) {
  const msg = (error?.message || error?.details || '').toLowerCase();
  return msg.includes('device_types') && (
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

/**
 * Create a category
 */
async function createCategory(data) {
  assertSupabaseConfigured();
  try {
    const name = (data.name || '').trim();
    if (!name) throw new Error('Category name is required');

    const icon = (data.icon || 'bi-cpu').trim() || 'bi-cpu';
    let sortOrder = data.sortOrder;
    if (typeof sortOrder !== 'number') {
      const existing = typeof AppStore !== 'undefined' ? AppStore.getCategories() : [];
      const max = existing.reduce((m, c) => Math.max(m, c.sortOrder || 0), 0);
      sortOrder = max + 1;
    }

    const { data: created, error } = await sb
      .from('device_types')
      .insert({ name, icon, sort_order: sortOrder })
      .select('*')
      .single();

    if (error) {
      if (isMissingDeviceTypesTable(error)) {
        throw new Error(
          'Table device_types is missing. Run scanner/supabase/migration_device_types.sql in the Supabase SQL Editor.'
        );
      }
      if (error.code === '23505') throw new Error('A category with that name already exists');
      throw new Error(supabaseError(error, 'Failed to add category'));
    }
    return mapCategoryRow(created);
  } catch (e) {
    throw new Error(e.message || 'Failed to add category');
  }
}

/**
 * Update a category. When name changes, also rename matching devices.device_type.
 */
async function updateCategory(id, data) {
  assertSupabaseConfigured();
  try {
    const name = (data.name || '').trim();
    if (!name) throw new Error('Category name is required');

    const icon = (data.icon || 'bi-cpu').trim() || 'bi-cpu';
    const existing = typeof AppStore !== 'undefined'
      ? AppStore.getCategories().find(c => c.id === id)
      : null;
    const oldName = existing?.name;

    const { data: updated, error } = await sb
      .from('device_types')
      .update({ name, icon })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') throw new Error('A category with that name already exists');
      throw new Error(supabaseError(error, 'Failed to update category'));
    }

    if (oldName && oldName !== name) {
      const { error: renameErr } = await sb
        .from('devices')
        .update({ device_type: name })
        .eq('device_type', oldName);
      if (renameErr) {
        console.warn('Category renamed but device labels not updated:', renameErr);
      }
    }

    return mapCategoryRow(updated);
  } catch (e) {
    throw new Error(e.message || 'Failed to update category');
  }
}

/**
 * Delete a category. Blocks if any device still uses this type name.
 */
async function deleteCategory(id) {
  assertSupabaseConfigured();
  try {
    const existing = typeof AppStore !== 'undefined'
      ? AppStore.getCategories().find(c => c.id === id)
      : null;

    if (existing?.name) {
      const { count, error: countErr } = await sb
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('device_type', existing.name);
      if (countErr) throw new Error(supabaseError(countErr, 'Failed to check devices'));
      if (count > 0) {
        throw new Error(
          `Cannot delete "${existing.name}" — ${count} device${count === 1 ? '' : 's'} still use it. Reassign or delete those devices first.`
        );
      }
    }

    const { error } = await sb.from('device_types').delete().eq('id', id);
    if (error) throw new Error(supabaseError(error, 'Failed to delete category'));
  } catch (e) {
    throw new Error(e.message || 'Failed to delete category');
  }
}

/** Compatibility helpers for UI */
const CategoriesService = {
  list: getCategories,
  create: createCategory,
  update: updateCategory,
  delete: deleteCategory
};
