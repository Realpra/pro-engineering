// Re-links the premium/rebate approval chain to the live estimate (PENDING #15,
// confirmed built-but-disconnected since Session 59, 24 Sep 2026).
// premium_approval_requests.status has always correctly run pending ->
// approved_by_admin/approved_by_super_admin/rejected -- but nothing ever wrote
// the approved requested_pct back into boq_generated, so an approved premium
// never reached the client-facing estimate. Project owner's confirmed real
// mechanism (1 Oct 2026): per-line-item BOQ correction happens first and can
// happen at any stage (already live); the role holding premium/rebate
// authority then applies ONE en-bloc percentage on top of the already-
// corrected total. This function is that application step, called from both
// Admin's and Superadmin's approve actions so either one's approval actually
// takes effect, not just the request row.
//
// Recomputes using the exact same formula generateBOQ itself uses
// (app/admin/estimate/[bookingRef]/actions.ts, "Compute totals"):
//   platformFee = round2((subtotal_labour + subtotal_material) * pct/100)
//   gstAmount   = round2(platformFee * 0.18)
//   totalAmount = round2(subtotal_labour + subtotal_material + subtotal_risk_flags
//                         + platformFee + bocw_cess_amount + gstAmount)
// bocw_cess_amount is untouched -- it depends only on subtotal_labour, not premium.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function applyApprovedPremium(supabase: any, boqId: string | null, bookingRef: string, approvedPct: number): Promise<{ error?: string }> {
  function round2(n: number): number {
    return Math.round(n * 100) / 100
  }

  const query = supabase
    .from('boq_generated')
    .select('id, subtotal_labour, subtotal_material, subtotal_risk_flags, bocw_cess_amount')
  const { data: boq, error: fetchErr } = boqId
    ? await query.eq('id', boqId).maybeSingle()
    : await query.eq('booking_ref', bookingRef).order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (fetchErr) return { error: fetchErr.message }
  if (!boq) return { error: `No boq_generated row found for ${boqId ?? bookingRef} -- premium approved but not applied.` }

  const subtotalLabour = Number(boq.subtotal_labour) || 0
  const subtotalMaterial = Number(boq.subtotal_material) || 0
  const subtotalRiskFlags = Number(boq.subtotal_risk_flags) || 0
  const bocwCessAmount = Number(boq.bocw_cess_amount) || 0

  const platformFee = round2((subtotalLabour + subtotalMaterial) * (approvedPct / 100))
  const gstAmount = round2(platformFee * 0.18)
  const totalAmount = round2(subtotalLabour + subtotalMaterial + subtotalRiskFlags + platformFee + bocwCessAmount + gstAmount)

  const { error: updateErr } = await supabase
    .from('boq_generated')
    .update({
      platform_premium_pct: approvedPct,
      platform_premium_amount: platformFee,
      gst_amount: gstAmount,
      total_amount: totalAmount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', boq.id)

  if (updateErr) return { error: updateErr.message }
  return {}
}
