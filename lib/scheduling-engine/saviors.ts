// Phase C5 — the absolute-last-resort fallback. A human decision, never auto-invoked by
// matchSlot(). "A Savior is a record, not a managed resource" — no Worker Master row, no
// Worker Supply Ledger row.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function fillSlotWithSavior(
  supabase: AnyClient,
  params: {
    slotId: string
    fullName: string
    mobile?: string
    email?: string
    tradeCode: string
    rateAgreed?: number
    bookingRef: string
    daysAssigned?: number
    loggedByUserId: string
    remarks?: string
  }
): Promise<{ saviorId: string }> {
  const { data: savior, error: saviorError } = await supabase
    .from('saviors')
    .insert({
      full_name: params.fullName,
      mobile: params.mobile ?? null,
      email: params.email ?? null,
      trade_code: params.tradeCode,
      rate_agreed: params.rateAgreed ?? null,
      booking_ref: params.bookingRef,
      filled_slot_id: params.slotId,
      days_assigned: params.daysAssigned ?? 1,
      logged_by: params.loggedByUserId,
      remarks: params.remarks ?? null,
    })
    .select('savior_id')
    .single()
  if (saviorError) throw new Error(`fillSlotWithSavior (saviors): ${saviorError.message}`)

  const { error: slotError } = await supabase
    .from('task_ledger')
    .update({
      filled_via_saviors_id: savior.savior_id,
      assigned_worker_id: null,
      slot_status: 'Pending',
      match_score: 'N/A (off-system)',
      compliance_check_status: 'N/A (off-system)',
      operational_action_trigger: 'FILLED_VIA_SAVIOR',
    })
    .eq('slot_id', params.slotId)
  if (slotError) throw new Error(`fillSlotWithSavior (task_ledger): ${slotError.message}`)

  const { error: decisionError } = await supabase.from('human_decision_log').insert({
    decision_type: 'Savior Appointed',
    related_slot_id: params.slotId,
    decided_by: params.loggedByUserId,
    decision_value_notes: `Deviance ladder and adjoining zones both exhausted with NO SUPPLY — logged Savior ${params.fullName} (${params.tradeCode}).`,
  })
  if (decisionError) throw new Error(`fillSlotWithSavior (decision_log): ${decisionError.message}`)

  return { saviorId: savior.savior_id }
}
