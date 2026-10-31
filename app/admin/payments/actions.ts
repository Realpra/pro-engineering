'use server'
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logJobMovement, type MovementAction } from '@/lib/jobMovementLog'

export type PaymentActionResult = { success: true } | { error: string }

const TABLE = 'milestone_payment_schedule'

type PaymentLog = { action: MovementAction; adminUserId: string; remarks: string }

async function applyUpdate(patch: Record<string, unknown>, paymentId: string, log?: PaymentLog): Promise<PaymentActionResult> {
  const supabase: any = await createClient()
  const { error } = await supabase.from(TABLE).update(patch).eq('id', paymentId)
  if (error) return { error: error.message }
  // Job movement log (owner, 31 Oct 2026). A rejected payment counts as a send-back;
  // a hold or a Decision 5 ruling does not.
  if (log) {
    await logJobMovement(supabase, {
      milestonePaymentId: paymentId, stage: 'payment', action: log.action,
      itemType: 'milestone_payment_schedule', itemId: paymentId,
      fromUserId: log.adminUserId || undefined, remarks: log.remarks,
    })
  }
  revalidatePath('/admin/payments')
  return { success: true }
}

// ACTION 1
export async function adminApprovePayment(
  paymentId: string,
  adminUserId: string,
  remarks: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      admin_approved_at: new Date().toISOString(),
      status: 'admin_approved',
      platform_remarks: remarks,
      updated_at: new Date().toISOString(),
    },
    paymentId,
    { action: 'approved', adminUserId, remarks: remarks || 'Payment approved by Admin' }
  )
}

// ACTION 2
export async function adminHoldPayment(
  paymentId: string,
  adminUserId: string,
  holdReason: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      status: 'admin_hold',
      admin_hold_reason: holdReason,
      updated_at: new Date().toISOString(),
    },
    paymentId,
    { action: 'held', adminUserId, remarks: holdReason }
  )
}

// ACTION 3
export async function adminRejectPayment(
  paymentId: string,
  adminUserId: string,
  rejectionReason: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      status: 'admin_rejected',
      admin_rejection_reason: rejectionReason,
      updated_at: new Date().toISOString(),
    },
    paymentId,
    { action: 'rejected', adminUserId, remarks: rejectionReason }
  )
}

// ACTION 4
export async function adminConfirmDecision5(
  paymentId: string,
  adminUserId: string,
  bearsCost: string,
  adminRemarks: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      decision_5_admin_decision: 'confirmed',
      decision_5_admin_remarks: adminRemarks,
      rework_bears_cost: bearsCost,
      status: 'decision_5_confirmed',
      updated_at: new Date().toISOString(),
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Decision 5 confirmed (cost borne by ${bearsCost})${adminRemarks ? ': ' + adminRemarks : ''}` }
  )
}

// ACTION 5
export async function adminOverrideDecision5(
  paymentId: string,
  adminUserId: string,
  adminRemarks: string
): Promise<PaymentActionResult> {
  const now = new Date().toISOString()
  return applyUpdate(
    {
      decision_5_admin_decision: 'overridden',
      decision_5_admin_remarks: adminRemarks,
      admin_override_type: 'approve_despite_decision5',
      admin_override_by: adminUserId,
      admin_override_at: now,
      status: 'admin_approved',
      admin_approved_at: now,
      updated_at: now,
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Decision 5 overridden${adminRemarks ? ': ' + adminRemarks : ''}` }
  )
}

// ACTION 6
export async function adminPartialAcceptDecision5(
  paymentId: string,
  adminUserId: string,
  partialAmount: number,
  adminRemarks: string
): Promise<PaymentActionResult> {
  const now = new Date().toISOString()
  return applyUpdate(
    {
      decision_5_admin_decision: 'partial_accepted',
      decision_5_admin_remarks: adminRemarks,
      rework_cost_approved: partialAmount,
      admin_override_type: 'partial_accept',
      admin_override_by: adminUserId,
      admin_override_at: now,
      status: 'admin_approved',
      admin_approved_at: now,
      updated_at: now,
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Decision 5 partly accepted${adminRemarks ? ': ' + adminRemarks : ''}` }
  )
}

// ACTION 7
export async function adminApproveReworkDeduction(
  paymentId: string,
  adminUserId: string,
  approvedAmount: number,
  remarks: string
): Promise<PaymentActionResult> {
  const now = new Date().toISOString()
  return applyUpdate(
    {
      rework_cost_approved: approvedAmount,
      rework_cost_approved_by: adminUserId,
      rework_cost_approved_at: now,
      rework_cost_remarks: remarks,
      status: 'admin_approved',
      admin_approved_at: now,
      updated_at: now,
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Rework deduction approved${remarks ? ': ' + remarks : ''}` }
  )
}

// ACTION 8
export async function adminModifyReworkDeduction(
  paymentId: string,
  adminUserId: string,
  modifiedAmount: number,
  remarks: string
): Promise<PaymentActionResult> {
  const now = new Date().toISOString()
  return applyUpdate(
    {
      rework_cost_approved: modifiedAmount,
      rework_cost_approved_by: adminUserId,
      rework_cost_approved_at: now,
      rework_cost_remarks: remarks,
      updated_at: now,
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Rework deduction modified${remarks ? ': ' + remarks : ''}` }
  )
}

// ACTION 9
export async function adminWaiveReworkDeduction(
  paymentId: string,
  adminUserId: string,
  remarks: string
): Promise<PaymentActionResult> {
  const now = new Date().toISOString()
  return applyUpdate(
    {
      rework_cost_approved: 0,
      rework_cost_approved_by: adminUserId,
      rework_cost_approved_at: now,
      rework_cost_remarks: remarks,
      updated_at: now,
    },
    paymentId,
    { action: 'decided', adminUserId, remarks: `Rework deduction waived${remarks ? ': ' + remarks : ''}` }
  )
}

// ACTION 10
export async function adminReleaseFromHold(
  paymentId: string,
  adminUserId: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      status: 'coordinator_approved',
      admin_hold_reason: null,
      updated_at: new Date().toISOString(),
    },
    paymentId,
    { action: 'released', adminUserId, remarks: 'Payment released from hold' }
  )
}

// ACTION 11
export async function adminAddSuperAdminNote(
  paymentId: string,
  adminUserId: string,
  note: string
): Promise<PaymentActionResult> {
  return applyUpdate(
    {
      platform_remarks: note,
      above_limit_super_admin_status: 'admin_noted',
      updated_at: new Date().toISOString(),
    },
    paymentId
  )
}
