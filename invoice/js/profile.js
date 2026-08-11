/**
 * Invoice profile — your details for PDF header
 */

function mapProfileRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    businessName: row.business_name || '',
    email: row.email || '',
    phone: row.phone || '',
    address: row.address || '',
    invoicePrefix: row.invoice_prefix || 'INV',
    updatedAt: row.updated_at || null
  };
}

async function getProfile() {
  assertSupabaseConfigured();
  const { data, error } = await sb
    .from('invoice_profile')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(supabaseError(error, 'Failed to load profile'));
  return mapProfileRow(data);
}

async function saveProfile(data) {
  assertSupabaseConfigured();
  const row = {
    business_name: (data.businessName || '').trim(),
    email: (data.email || '').trim(),
    phone: (data.phone || '').trim(),
    address: (data.address || '').trim(),
    invoice_prefix: (data.invoicePrefix || 'INV').trim() || 'INV',
    updated_at: new Date().toISOString()
  };

  const existing = await getProfile();
  if (existing?.id) {
    const { data: updated, error } = await sb
      .from('invoice_profile')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(supabaseError(error, 'Failed to save profile'));
    return mapProfileRow(updated);
  }

  const { data: created, error } = await sb
    .from('invoice_profile')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(supabaseError(error, 'Failed to save profile'));
  return mapProfileRow(created);
}
