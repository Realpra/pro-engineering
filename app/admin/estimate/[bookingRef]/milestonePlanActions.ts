'use server'

import { createClient } from '@/lib/supabase/server'

// ── Row types (exact confirmed columns) ─────────────────────────────────────

export type MilestoneStageTemplateRow = {
  id: string
  job_type: string
  milestone_code: string
  milestone_name: string
  description: string | null
  payment_percent: number
  milestone_number: number
  planned_day: number | null
  skilled_workers_per_day: number | null
  unskilled_workers_per_day: number | null
  sku_codes: string[] | null
  created_at: string
  updated_at: string
}

// Maps boq_sku_catalogue.lab_item_code -> labour_rate_config.rate_card_code.
// Copied from app/admin/estimate/[bookingRef]/actions.ts (LAB_TO_RATE_CODE) so
// this file can resolve the same SKU codes without importing a server-action
// file that also exports many unrelated actions.
const LAB_TO_RATE_CODE: Record<string, string> = {
  'LAB-ISO-01': 'ISO-LUMP',
  'LAB-DEM-01': 'DEM-FL',
  'LAB-DEM-02': 'DEM-WL',
  'LAB-MUK-01': 'MUK-LUMP',
  'LAB-CLR-01': 'CLR-LUMP',
  'LAB-CHZ-01': 'CHZ-RFT',
  'LAB-PLS-01': 'PLS-WL',
  'LAB-SCR-01': 'SCR-FL',
  'LAB-WPF-01': 'WPF',
  'LAB-PND-01': 'PND-LUMP',
  'LAB-TIL-01': 'TIL-WL',
  'LAB-TIL-02': 'TIL-FL',
  'LAB-WST-01': 'WST-LUMP',
  'LAB-GRT-01': 'GRT',
  'LAB-PLM-01': 'PLB-RFT',
  'LAB-TST-01': 'TST-LUMP',
  'LAB-DRN-01': 'DRN-UNIT',
  'LAB-ELE-01': 'ELE-PT-LAB',
  'LAB-SAN-01': 'FIX-FT',
  'LAB-SAN-02': 'FIX-FT',
  'LAB-PLM-02': 'FIX-FT',
  'LAB-APP-01': 'FIX-FT',
  'LAB-PNT-01': 'PNT-SQFT',
  'LAB-SLN-01': 'SLN-LUMP',
  'LAB-CLN-01': 'CLN-LUMP',
  'LAB-SUP-01': 'SUP-DY',
  'LAB-VTC-01': 'VTC-LUMP',
  'MAT-WPF-01': 'WPF',
  'MAT-TIL-FL': 'TIL-FL',
  'MAT-TIL-WL': 'TIL-WL',
  'MAT-ADH-FL': 'TIL-FL',
  'MAT-ADH-WL': 'TIL-WL',
  'MAT-GRT-01': 'GRT',
  'MAT-PPE-01': 'MAT-PPE-JOB',
  'MAT-PPE-02': 'MAT-PPE-DRAIN',
  'MAT-ELE-01': 'MAT-ELE-PT',
  'MAT-PNT-01': 'MAT-PNT-LUMP',
  'MAT-SLN-01': 'MAT-SLN-LUMP',
}

type BoqLineItemRow = {
  skuCode: string
  quantity: number
}

export type MilestoneSubstageTemplateRow = {
  id: string
  stage_template_id: string
  substage_code: string
  substage_name: string
  planned_day: number | null
  evidence_checklist: string[] | null
  created_at: string
  updated_at: string
}

export type JobMilestoneSubstageRow = {
  id: string
  booking_ref: string
  milestone_code: string
  substage_code: string
  substage_name: string
  planned_day: number
  skilled_workers_per_day: number
  unskilled_workers_per_day: number
  evidence_required: string[] | null
  status: string
  sequence_order: number
  labour_assignments: LabourAssignment[] | null
  predecessor_substage_code: string | null
  dependency_type: string | null
  lag_days: number | null
  lag_hours: number | null
  float_days: number | null
  buffer_days: number | null
  is_critical_path: boolean | null
  early_start_date: string | null
  early_finish_date: string | null
  created_at: string
  updated_at: string
}

type LabourRateForStage = {
  rate_card_code: string
  skilled_rate_per_day: number | null
  unskilled_rate_per_day: number | null
  skilled_workers_count: number | null
  unskilled_workers_count: number | null
  output_per_mason_per_day: number | null
}

// ── Client-facing merged shape ───────────────────────────────────────────────

export type LabourAssignment = {
  rowId: string
  trade: string
  skillType: 'skilled' | 'unskilled'
  qty: number
  startTime: string
  endTime: string
  hoursPerDay: number
  daysNeeded: number
  dependsOnRowId?: string
  lagHours?: number
  canUseMultiskill?: boolean
  minSkillLevel?: string
  ratePerHour?: number
  totalHours?: number
  totalCost?: number
}

// Per-skill deployment status, read from the real Task Ledger (never guessed/typed by hand) --
// "the skilled workers, all as one number... all skills to be shown every where" (10 Oct 2026
// correction). One entry per distinct required_skill_code the Dynamic Scheduler has actually
// materialized for this sub-stage, so a multi-trade sub-stage (e.g. a skilled trade + Helper)
// shows each trade's own real booked-vs-needed count, not one combined figure.
export type SkillDeploymentStatus = {
  skillCode: string
  totalSlots: number
  deployedSlots: number
  pendingDates: string[]
}

export type MilestonePlanSubstage = {
  id?: string
  substageCode: string
  substageName: string
  plannedDay: number
  skilledWorkersPerDay: number
  unskilledWorkersPerDay: number
  evidenceRequired: string[]
  status: string
  isCustom: boolean
  substageDescription?: string
  plannedHours?: number
  startTimeSlot?: string
  plannedStartDate?: string
  tradeType?: string
  predecessorCode?: string
  dependencyType?: string
  lagDays?: number
  lagHours?: number
  floatDays?: number
  bufferDays?: number
  isCriticalPath?: boolean
  earlyStartDate?: string
  earlyFinishDate?: string
  resourceConstraint?: string
  constraintType?: string
  constraintDate?: string
  weatherDelayDays?: number
  supervisorChecklist?: string[]
  subcoordinatorChecklist?: string[]
  coordinatorChecklist?: string[]
  labourAssignments?: LabourAssignment[]
  skillDeployment?: SkillDeploymentStatus[]
}

export type MilestonePlanStage = {
  milestoneCode: string
  milestoneName: string
  paymentPercent: number | null
  milestoneNumber: number
  isCustomStage: boolean
  rate: { boqLabourCost: number } | null
  subStages: MilestonePlanSubstage[]
}

export type MilestonePlanDataResult = {
  error?: string
  stages?: MilestonePlanStage[]
  resolvedJobType?: string | null
  jobTypeMatched?: boolean
}

export async function getMilestonePlanData(
  bookingRef: string,
  jobCardType: string,
): Promise<MilestonePlanDataResult> {
  const supabase = await createClient()

  // job_type on milestone_stage_templates has not been confirmed against real
  // data — try jobCardType directly, then the jcMap translation used elsewhere
  // in this codebase, then fall back to unfiltered + a warning so the real
  // values are observable in server logs instead of silently showing nothing.
  const jcMap: Record<string, string> = { L: 'labour-only', M: 'material-supply', LM: 'turnkey' }
  const candidates = [jobCardType, jcMap[jobCardType] ?? jobCardType].filter(
    (v, i, arr) => arr.indexOf(v) === i,
  )

  let resolvedJobType: string | null = null
  let jobTypeMatched = false
  for (const candidate of candidates) {
    const { data: probe } = await (supabase as any)
      .from('milestone_stage_templates')
      .select('id')
      .eq('job_type', candidate)
      .limit(1)
    if (probe && probe.length > 0) {
      resolvedJobType = candidate
      jobTypeMatched = true
      break
    }
  }

  let stageTemplates: MilestoneStageTemplateRow[] = []
  if (jobTypeMatched && resolvedJobType) {
    const { data, error } = await (supabase as any)
      .from('milestone_stage_templates')
      .select('id, job_type, milestone_code, milestone_name, description, payment_percent, milestone_number, planned_day, skilled_workers_per_day, unskilled_workers_per_day, sku_codes, created_at, updated_at')
      .eq('job_type', resolvedJobType)
      .order('milestone_number', { ascending: true })
    if (error) return { error: (error as { message: string }).message }
    stageTemplates = (data ?? []) as MilestoneStageTemplateRow[]
  } else {
    console.warn('[getMilestonePlanData] no job_type candidate matched', candidates, '— falling back to unfiltered fetch')
    const { data, error } = await (supabase as any)
      .from('milestone_stage_templates')
      .select('id, job_type, milestone_code, milestone_name, description, payment_percent, milestone_number, planned_day, skilled_workers_per_day, unskilled_workers_per_day, sku_codes, created_at, updated_at')
      .order('milestone_number', { ascending: true })
    if (error) return { error: (error as { message: string }).message }
    stageTemplates = (data ?? []) as MilestoneStageTemplateRow[]
    if (stageTemplates.length > 0) {
      console.warn('[getMilestonePlanData] distinct job_type values found:', [...new Set(stageTemplates.map(s => s.job_type))])
    }
  }

  // Sub-stage templates, joined by stage_template_id
  const stageIds = stageTemplates.map(s => s.id)
  const { data: substageData, error: substageErr } = stageIds.length
    ? await (supabase as any)
        .from('milestone_substage_templates')
        .select('id, stage_template_id, substage_code, substage_name, planned_day, evidence_checklist, created_at, updated_at')
        .in('stage_template_id', stageIds)
    : { data: [], error: null }
  if (substageErr) return { error: (substageErr as { message: string }).message }
  const substageTemplates = (substageData ?? []) as MilestoneSubstageTemplateRow[]
  // No ordering column exists on this table — sort client-side.
  substageTemplates.sort((a, b) =>
    a.substage_code && b.substage_code
      ? a.substage_code.localeCompare(b.substage_code)
      : (a.created_at ?? '').localeCompare(b.created_at ?? ''),
  )

  // Existing coordinator-saved rows for this booking
  const { data: existingData, error: existingErr } = await (supabase as any)
    .from('job_milestone_substages')
    .select('id, booking_ref, milestone_code, substage_code, substage_name, planned_day, skilled_workers_per_day, unskilled_workers_per_day, evidence_required, status, sequence_order, labour_assignments, predecessor_substage_code, dependency_type, lag_days, lag_hours, float_days, buffer_days, is_critical_path, early_start_date, early_finish_date, created_at, updated_at')
    .eq('booking_ref', bookingRef)
  if (existingErr) return { error: (existingErr as { message: string }).message }
  const existingRows = (existingData ?? []) as JobMilestoneSubstageRow[]

  // Real per-skill deployment status (10 Oct 2026 correction) -- read directly from the
  // Dynamic Scheduler's own Task Ledger, grouped by (substage_id, required_skill_code), never
  // from the plan's own flat skilled/unskilled aggregate. One Supabase call covering every
  // sub-stage this booking has, reduced client-side -- this table has no GROUP BY RPC, and the
  // row volume per booking is small (day-grain slots for one job, not the whole platform).
  const existingSubstageIds = existingRows.map(r => r.id)
  const skillDeploymentBySubstage = new Map<string, Map<string, SkillDeploymentStatus>>()
  if (existingSubstageIds.length > 0) {
    const { data: ledgerRows, error: ledgerErr } = await (supabase as any)
      .from('task_ledger')
      .select('substage_id, required_skill_code, slot_status, assigned_worker_id, target_date')
      .in('substage_id', existingSubstageIds)
      .neq('slot_status', 'Cancelled_Delayed')
    if (ledgerErr) return { error: (ledgerErr as { message: string }).message }
    for (const row of (ledgerRows ?? []) as { substage_id: string; required_skill_code: string; slot_status: string; assigned_worker_id: string | null; target_date: string }[]) {
      if (!row.substage_id) continue
      if (!skillDeploymentBySubstage.has(row.substage_id)) skillDeploymentBySubstage.set(row.substage_id, new Map())
      const bySkill = skillDeploymentBySubstage.get(row.substage_id)!
      if (!bySkill.has(row.required_skill_code)) {
        bySkill.set(row.required_skill_code, { skillCode: row.required_skill_code, totalSlots: 0, deployedSlots: 0, pendingDates: [] })
      }
      const entry = bySkill.get(row.required_skill_code)!
      entry.totalSlots += 1
      if (row.assigned_worker_id) entry.deployedSlots += 1
      else if (row.slot_status === 'Pending' && !entry.pendingDates.includes(row.target_date)) entry.pendingDates.push(row.target_date)
    }
  }
  function skillDeploymentFor(substageId: string | undefined): SkillDeploymentStatus[] | undefined {
    if (!substageId) return undefined
    const bySkill = skillDeploymentBySubstage.get(substageId)
    if (!bySkill) return undefined
    return [...bySkill.values()].map(s => ({ ...s, pendingDates: s.pendingDates.sort() }))
  }

  // Stage labour cost is derived from the booking's actual BOQ line items, not
  // from a (nonexistent) labour_rate_config row keyed by milestone_code.
  // Each stage's sku_codes list picks out which LAB-* BOQ line items belong to
  // it; each SKU resolves to a labour_rate_config.rate_card_code via
  // LAB_TO_RATE_CODE, giving the per-activity skilled/unskilled day-rate and
  // output_per_mason_per_day needed to convert BOQ quantity into person-days.
  const { data: boqData, error: boqErr } = await (supabase as any)
    .from('boq_generated')
    .select('line_items')
    .eq('booking_ref', bookingRef)
    .maybeSingle()
  if (boqErr) return { error: (boqErr as { message: string }).message }
  const boqLineItems = (boqData?.line_items ?? []) as BoqLineItemRow[]

  const allRateCardCodes = [...new Set(
    stageTemplates.flatMap(st => (st.sku_codes ?? []).map(sku => LAB_TO_RATE_CODE[sku] ?? sku)),
  )]
  const { data: rateData, error: rateErr } = allRateCardCodes.length
    ? await (supabase as any)
        .from('labour_rate_config')
        .select('rate_card_code, skilled_rate_per_day, unskilled_rate_per_day, skilled_workers_count, unskilled_workers_count, output_per_mason_per_day')
        .in('rate_card_code', allRateCardCodes)
    : { data: [], error: null }
  if (rateErr) return { error: (rateErr as { message: string }).message }
  const rateConfigMap = new Map<string, LabourRateForStage>(
    ((rateData ?? []) as LabourRateForStage[]).map(r => [r.rate_card_code, r]),
  )

  function computeStageBoqLabourCost(stage: MilestoneStageTemplateRow): number | null {
    const skuCodes = stage.sku_codes ?? []
    if (skuCodes.length === 0) return null
    let total = 0
    let matched = false
    for (const item of boqLineItems) {
      if (!skuCodes.includes(item.skuCode)) continue
      const rateCardCode = LAB_TO_RATE_CODE[item.skuCode] ?? item.skuCode
      const config = rateConfigMap.get(rateCardCode)
      if (!config || !config.output_per_mason_per_day) continue
      const days = (Number(item.quantity) || 0) / config.output_per_mason_per_day
      const skilledCost = days * (config.skilled_workers_count ?? 0) * (config.skilled_rate_per_day ?? 0)
      const unskilledCost = days * (config.unskilled_workers_count ?? 0) * (config.unskilled_rate_per_day ?? 0)
      total += skilledCost + unskilledCost
      matched = true
    }
    return matched ? total : null
  }

  // Merge: template stage -> template substages, overridden by existingRows
  const existingByKey = new Map<string, JobMilestoneSubstageRow>(
    existingRows.map(r => [`${r.milestone_code}::${r.substage_code}`, r]),
  )
  const consumedKeys = new Set<string>()

  const stages: MilestonePlanStage[] = stageTemplates.map(st => {
    const boqLabourCost = computeStageBoqLabourCost(st)
    const subFromTemplates = substageTemplates
      .filter(sub => sub.stage_template_id === st.id)
      .map((sub): MilestonePlanSubstage => {
        const key = `${st.milestone_code}::${sub.substage_code}`
        const existing = existingByKey.get(key)
        if (existing) consumedKeys.add(key)
        const defaultSkilled = st.skilled_workers_per_day ?? 0
        const defaultUnskilled = st.unskilled_workers_per_day ?? 0
        return {
          id: existing?.id,
        substageCode: sub.substage_code,
          substageName: existing?.substage_name ?? sub.substage_name,
          plannedDay: existing?.planned_day ?? sub.planned_day ?? st.planned_day ?? 0,
          skilledWorkersPerDay: existing?.skilled_workers_per_day ?? defaultSkilled,
          unskilledWorkersPerDay: existing?.unskilled_workers_per_day ?? defaultUnskilled,
          evidenceRequired: existing?.evidence_required ?? sub.evidence_checklist ?? [],
          predecessorCode: existing?.predecessor_substage_code??undefined,
          dependencyType: existing?.dependency_type??'FS',
          lagDays: existing?.lag_days??0,
          lagHours: existing?.lag_hours??0,
          floatDays: existing?.float_days??0,
          bufferDays: existing?.buffer_days??0,
          isCriticalPath: existing?.is_critical_path??false,
          earlyStartDate: existing?.early_start_date??undefined,
          earlyFinishDate: existing?.early_finish_date??undefined,
          status: existing?.status ?? 'pending',
          isCustom: false,
          labourAssignments: existing?.labour_assignments ?? [],
          skillDeployment: skillDeploymentFor(existing?.id),
        }
      })

    // Coordinator-added rows under this same (known) milestone_code that don't
    // match any template substage_code — i.e. "Add Sub-stage" was used previously.
    const extraSubs = existingRows
      .filter(r => r.milestone_code === st.milestone_code && !consumedKeys.has(`${r.milestone_code}::${r.substage_code}`))
      .map((r): MilestonePlanSubstage => ({
        id: r.id,
        substageCode: r.substage_code,
        substageName: r.substage_name,
        plannedDay: r.planned_day,
        skilledWorkersPerDay: r.skilled_workers_per_day,
        unskilledWorkersPerDay: r.unskilled_workers_per_day,
        evidenceRequired: r.evidence_required ?? [],
        status: r.status,
        predecessorCode: r.predecessor_substage_code??undefined,
        dependencyType: r.dependency_type??'FS',
        lagDays: r.lag_days??0,
        lagHours: r.lag_hours??0,
        floatDays: r.float_days??0,
        bufferDays: r.buffer_days??0,
        isCriticalPath: r.is_critical_path??false,
        earlyStartDate: r.early_start_date??undefined,
        earlyFinishDate: r.early_finish_date??undefined,
        isCustom: true,
        labourAssignments: r.labour_assignments ?? [],
        skillDeployment: skillDeploymentFor(r.id),
      }))
    extraSubs.forEach(s => consumedKeys.add(`${st.milestone_code}::${s.substageCode}`))

    return {
      milestoneCode: st.milestone_code,
      milestoneName: st.milestone_name,
      paymentPercent: st.payment_percent,
      milestoneNumber: st.milestone_number,
      isCustomStage: false,
      rate: boqLabourCost != null ? { boqLabourCost } : null,
      subStages: [...subFromTemplates, ...extraSubs],
    }
  })

  // Entirely coordinator-added stages ("Add Stage") — milestone_code not found
  // in any template row. Grouped purely by distinct milestone_code, since
  // job_milestone_substages has no stage-level name/percent columns of its own.
  const knownCodes = new Set(stageTemplates.map(s => s.milestone_code))
  const customCodes = [...new Set(
    existingRows
      .filter(r => !knownCodes.has(r.milestone_code) && !consumedKeys.has(`${r.milestone_code}::${r.substage_code}`))
      .map(r => r.milestone_code),
  )]

  customCodes.forEach((code, idx) => {
    const subs = existingRows
      .filter(r => r.milestone_code === code)
      .map((r): MilestonePlanSubstage => ({
        id: r.id,
        substageCode: r.substage_code,
        substageName: r.substage_name,
        plannedDay: r.planned_day,
        skilledWorkersPerDay: r.skilled_workers_per_day,
        unskilledWorkersPerDay: r.unskilled_workers_per_day,
        evidenceRequired: r.evidence_required ?? [],
        status: r.status,
        predecessorCode: r.predecessor_substage_code??undefined,
        dependencyType: r.dependency_type??'FS',
        lagDays: r.lag_days??0,
        lagHours: r.lag_hours??0,
        floatDays: r.float_days??0,
        bufferDays: r.buffer_days??0,
        isCriticalPath: r.is_critical_path??false,
        earlyStartDate: r.early_start_date??undefined,
        earlyFinishDate: r.early_finish_date??undefined,
        isCustom: true,
        labourAssignments: r.labour_assignments ?? [],
        skillDeployment: skillDeploymentFor(r.id),
      }))
    stages.push({
      milestoneCode: code,
      milestoneName: code,
      paymentPercent: null,
      milestoneNumber: 1000 + idx,
      isCustomStage: true,
      rate: null,
      subStages: subs,
    })
  })

  return { stages, resolvedJobType, jobTypeMatched }
}

export type JobMilestoneSubstageInput = {
  milestoneCode: string
  substageCode: string
  substageName: string
  plannedDay: number
  skilledWorkersPerDay: number
  unskilledWorkersPerDay: number
  evidenceRequired: string[]
  status: string
  substageDescription?: string
  plannedHours?: number
  startTimeSlot?: string
  plannedStartDate?: string
  tradeType?: string
  predecessorCode?: string
  dependencyType?: string
  lagDays?: number
  lagHours?: number
  floatDays?: number
  bufferDays?: number
  isCriticalPath?: boolean
  resourceConstraint?: string
  constraintType?: string
  constraintDate?: string
  weatherDelayDays?: number
  supervisorChecklist?: string[]
  subcoordinatorChecklist?: string[]
  coordinatorChecklist?: string[]
  labourAssignments?: LabourAssignment[]
}

export async function generateSubstagesFromBOQ(bookingRef: string): Promise<{stages: MilestonePlanStage[], error?: string}> {
  const supabase = await createClient()
  const {data: boq, error} = await (supabase as any)
    .from('boq_generated')
    .select('line_items')
    .eq('booking_ref', bookingRef)
    .single()
  if(error || !boq) return {stages: [], error: 'BOQ not found for this booking'}
  const items: Array<{skuCode:string,description:string,quantity:number,unit:string,rate:number,amount:number,isRiskFlag:boolean}> = boq.line_items || []
  const nonRisk = items.filter((i: any) => !i.isRiskFlag)

const SKU_TO_RATE: Record<string,string> = {
  'LAB-ISO-01':'ISO-LUMP','LAB-MUK-01':'MUK-LUMP','LAB-CLR-01':'CLR-LUMP',
  'LAB-DEM-01':'DEM-FL','LAB-DEM-02':'DEM-WL','LAB-CHZ-01':'PLB-RRT',
  'LAB-PLS-01':'PLS-WL','LAB-WPF-01':'WPF','LAB-PND-01':'WPF',
  'LAB-SCR-01':'SCR-FL','LAB-WST-01':'TIL-LF','LAB-TST-01':'PLB-RRT',
  'LAB-DRN-01':'FIX-FT','LAB-TIL-01':'TIL-WL','LAB-TIL-02':'TIL-FL',
  'LAB-GRT-01':'GRT','LAB-SLN-01':'FIX-FT','LAB-ELE-01':'ELC-PT',
  'LAB-SAN-01':'FIX-FT','LAB-SAN-02':'FIX-FT','LAB-PLM-01':'PLB-RRT',
  'LAB-PLM-02':'FIX-FT','LAB-APP-01':'FIX-FT','LAB-PNT-01':'PLS-WL',
  'LAB-CLN-01':'CLR-LUMP','LAB-SUP-01':'SUP-DY','LAB-VTC-01':'VTC-LUMP',
}

  // Fetch productivity norms from labour_rate_config
  const {data: rateConfigs} = await supabase
    .from('labour_rate_config')
    .select('rate_card_code,output_per_mason_per_day,curing_days_after')
  const rateMap: Record<string,{output:number,curing:number}> = {}
  if(rateConfigs){
    rateConfigs.forEach((r:any)=>{ rateMap[r.rate_card_code]={output:r.output_per_mason_per_day||1,curing:r.curing_days_after||0} })
  }
  // Fallback DAYS if rate config not available
  const DAYS: Record<string,number> = {'LAB-ISO-01':1,'LAB-MUK-01':1,'LAB-CLR-01':1,'LAB-DEM-01':2,'LAB-DEM-02':1,'LAB-CHZ-01':1,'LAB-PLS-01':2,'LAB-WPF-01':3,'LAB-PND-01':1,'LAB-SCR-01':2,'LAB-WST-01':1,'LAB-TST-01':1,'LAB-DRN-01':1,'LAB-TIL-01':2,'LAB-TIL-02':3,'LAB-GRT-01':1,'LAB-SLN-01':1,'LAB-ELE-01':4,'LAB-SAN-01':1,'LAB-SAN-02':1,'LAB-PLM-01':2,'LAB-PLM-02':1,'LAB-APP-01':1,'LAB-PNT-01':1,'LAB-CLN-01':1,'LAB-SUP-01':15,'LAB-VTC-01':1}
  const WORKERS: Record<string,{skilled:number,unskilled:number}> = {'LAB-ISO-01':{skilled:1,unskilled:1},'LAB-MUK-01':{skilled:0,unskilled:2},'LAB-CLR-01':{skilled:0,unskilled:2},'LAB-DEM-01':{skilled:1,unskilled:1},'LAB-DEM-02':{skilled:1,unskilled:1},'LAB-CHZ-01':{skilled:1,unskilled:0},'LAB-PLS-01':{skilled:1,unskilled:1},'LAB-WPF-01':{skilled:2,unskilled:1},'LAB-PND-01':{skilled:1,unskilled:0},'LAB-SCR-01':{skilled:1,unskilled:1},'LAB-WST-01':{skilled:1,unskilled:0},'LAB-TST-01':{skilled:1,unskilled:0},'LAB-DRN-01':{skilled:1,unskilled:0},'LAB-TIL-01':{skilled:2,unskilled:1},'LAB-TIL-02':{skilled:2,unskilled:1},'LAB-GRT-01':{skilled:1,unskilled:0},'LAB-SLN-01':{skilled:1,unskilled:0},'LAB-ELE-01':{skilled:2,unskilled:1},'LAB-SAN-01':{skilled:1,unskilled:0},'LAB-SAN-02':{skilled:1,unskilled:0},'LAB-PLM-01':{skilled:1,unskilled:1},'LAB-PLM-02':{skilled:1,unskilled:0},'LAB-APP-01':{skilled:1,unskilled:0},'LAB-PNT-01':{skilled:1,unskilled:0},'LAB-CLN-01':{skilled:1,unskilled:1},'LAB-SUP-01':{skilled:1,unskilled:0},'LAB-VTC-01':{skilled:1,unskilled:0}}
  const TRADE: Record<string,string> = {'LAB-ISO-01':'Plumber','LAB-MUK-01':'Helper','LAB-CLR-01':'Helper','LAB-DEM-01':'Mason','LAB-DEM-02':'Mason','LAB-CHZ-01':'Mason','LAB-PLS-01':'Mason','LAB-WPF-01':'Waterproofer','LAB-PND-01':'Waterproofer','LAB-SCR-01':'Mason','LAB-WST-01':'Tiler','LAB-TST-01':'Plumber','LAB-DRN-01':'Plumber','LAB-TIL-01':'Tiler','LAB-TIL-02':'Tiler','LAB-GRT-01':'Tiler','LAB-SLN-01':'Mason','LAB-ELE-01':'Electrician','LAB-SAN-01':'Plumber','LAB-SAN-02':'Plumber','LAB-PLM-01':'Plumber','LAB-PLM-02':'Plumber','LAB-APP-01':'Electrician','LAB-PNT-01':'Mason','LAB-CLN-01':'Helper','LAB-SUP-01':'Supervisor','LAB-VTC-01':'Supervisor'}
  const EVIDENCE: Record<string,string[]> = {'LAB-ISO-01':['Photo of closed main valve','Photo of drained pipes'],'LAB-MUK-01':['Photo of debris cleared','Photo of exit route clean'],'LAB-CLR-01':['Photo of site cleared','Photo of debris bags loaded'],'LAB-DEM-01':['Photo of floor tiles fully chipped','Photo of base slab exposed'],'LAB-DEM-02':['Photo of wall tiles fully chipped','Photo of raw brick exposed'],'LAB-CHZ-01':['Photo of chased grooves in wall','Photo of pipe routing complete'],'LAB-PLS-01':['Photo of plastered wall surface','Photo showing flat finish'],'LAB-WPF-01':['Photo of first coat applied','Photo of second coat applied','Photo of 3ft skirting done'],'LAB-PND-01':['Photo of brick threshold built','Photo of water filled','Photo after 24 hours no seepage'],'LAB-SCR-01':['Photo of screed poured','Photo showing slope toward drain'],'LAB-WST-01':['Photo of edge mitring complete'],'LAB-TST-01':['Photo of pressure gauge at 10 bar','Photo after 30 minutes hold'],'LAB-DRN-01':['Photo of drain trap set','Photo of anti-odour seal fitted'],'LAB-TIL-01':['Photo of wall tiles complete','Photo of alignment check'],'LAB-TIL-02':['Photo of floor tiles complete','Photo of slope check toward drain'],'LAB-GRT-01':['Photo of grouted joints floor','Photo of grouted joints wall'],'LAB-SLN-01':['Photo of silicone caulking at all fixture-tile joints'],'LAB-ELE-01':['Photo of conduit routing','Photo of switch boxes set','Photo of wire pull complete'],'LAB-SAN-01':['Photo of WC installed','Photo of flush test'],'LAB-SAN-02':['Photo of washbasin anchored','Photo of tap tested'],'LAB-PLM-01':['Photo of pipes concealed','Photo of joints tested'],'LAB-PLM-02':['Photo of diverter installed','Photo of shower arm fitted'],'LAB-APP-01':['Photo of geyser mounted','Photo of exhaust fan running','Photo of light connected'],'LAB-PNT-01':['Photo of ceiling primed','Photo of two coats complete'],'LAB-CLN-01':['Photo of acid wash complete','Photo of fixtures polished'],'LAB-SUP-01':['Daily supervisor log photo','Quality check sign-off'],'LAB-VTC-01':['Video call screenshot','Sub-coordinator verification note']}
  const DEPS: Record<string,{pred:string,type:string}> = {'LAB-MUK-01':{pred:'LAB-ISO-01',type:'FS'},'LAB-CLR-01':{pred:'LAB-MUK-01',type:'FS'},'LAB-DEM-02':{pred:'LAB-DEM-01',type:'SS'},'LAB-CHZ-01':{pred:'LAB-DEM-02',type:'FS'},'LAB-PLS-01':{pred:'LAB-CHZ-01',type:'FS'},'LAB-WPF-01':{pred:'LAB-PLS-01',type:'FS'},'LAB-PND-01':{pred:'LAB-WPF-01',type:'FS'},'LAB-WST-01':{pred:'LAB-SCR-01',type:'SS'},'LAB-TST-01':{pred:'LAB-PLM-01',type:'FS'},'LAB-DRN-01':{pred:'LAB-SCR-01',type:'FS'},'LAB-TIL-02':{pred:'LAB-TIL-01',type:'SS'},'LAB-GRT-01':{pred:'LAB-TIL-02',type:'FS'},'LAB-SLN-01':{pred:'LAB-GRT-01',type:'FS'},'LAB-SAN-01':{pred:'LAB-PLM-02',type:'FS'},'LAB-SAN-02':{pred:'LAB-SAN-01',type:'SS'},'LAB-APP-01':{pred:'LAB-ELE-01',type:'FS'},'LAB-PNT-01':{pred:'LAB-SLN-01',type:'FS'},'LAB-CLN-01':{pred:'LAB-PNT-01',type:'FS'},'LAB-VTC-01':{pred:'LAB-SUP-01',type:'SS'}}
  const SKU_MS: Record<string,string> = {'LAB-ISO-01':'M0','LAB-MUK-01':'M0','LAB-CLR-01':'M0','LAB-DEM-01':'M1','LAB-DEM-02':'M1','LAB-CHZ-01':'M1','LAB-PLS-01':'M1','LAB-WPF-01':'M1','LAB-PND-01':'M1','LAB-SCR-01':'M2','LAB-WST-01':'M2','LAB-TST-01':'M2','LAB-DRN-01':'M2','LAB-TIL-01':'M3','LAB-TIL-02':'M3','LAB-GRT-01':'M3','LAB-SLN-01':'M3','LAB-ELE-01':'M3','LAB-SAN-01':'M3','LAB-SAN-02':'M3','LAB-PLM-01':'M3','LAB-PLM-02':'M3','LAB-APP-01':'M3','LAB-PNT-01':'M3','LAB-CLN-01':'M3','LAB-SUP-01':'M4','LAB-VTC-01':'M4'}
  const MS_NAMES: Record<string,string> = {'M0':'Mobilisation & Preparatory Works','M1':'First Fix — Civil & MEP Rough-in','M2':'Mid Works — Waterproofing & Screed','M3':'Second Fix — Finishing & Tiling','M4':'Handover & DLP Start'}
  const MS_PCT: Record<string,number> = {'M0':20,'M1':25,'M2':20,'M3':25,'M4':10}
  const byMS: Record<string,MilestonePlanSubstage[]> = {}
  for(const item of nonRisk) {
    // Scope-change-merge SKU codes (LAB-SC-.../LAB-CC-..., see
    // app/admin/scope|milestones/actions.ts) are never in this fixed
    // catalogue table -- they are new, execution-stage-discovered work, not
    // one of the original 26 catalogue SKUs. Per the project owner's
    // worked example (9 Oct 2026 -- "add one item, cleaning, 1hr next day,
    // nothing else changed"), a newly-approved scope change is additional
    // work picked up at the point the plan is redefined, not retroactively
    // part of an earlier milestone -- defaulted to M4 (the last milestone)
    // rather than silently dropped, same discipline as TRADE/WORKERS/
    // EVIDENCE/DAYS below, which already default rather than skip.
    const mc = SKU_MS[item.skuCode] || (String(item.skuCode).startsWith('LAB-') ? 'M4' : undefined)
    if(!mc) continue
    if(!byMS[mc]) byMS[mc]=[]
    const dep = DEPS[item.skuCode]
    const ev = EVIDENCE[item.skuCode] || ['Photo of completed work']
    const w = WORKERS[item.skuCode] || {skilled:1,unskilled:0}
    const sub: MilestonePlanSubstage = {
      substageCode: item.skuCode,
      substageName: item.description,
      plannedDay: (()=>{
        const rc=SKU_TO_RATE[item.skuCode]
        if(rc && rateMap[rc] && rateMap[rc].output>1 && item.quantity>0){
          return Math.max(1,Math.ceil(item.quantity/rateMap[rc].output))
        }
        return DAYS[item.skuCode]||1
      })(),
      skilledWorkersPerDay: w.skilled,
      unskilledWorkersPerDay: w.unskilled,
      evidenceRequired: ev,
      status: 'pending',
      isCustom: false,
      substageDescription: item.description,
      plannedHours: 8,
      startTimeSlot: 'Full Day',
      tradeType: TRADE[item.skuCode] || 'Mason',
      predecessorCode: dep?.pred,
      dependencyType: dep?.type || 'FS',
      lagDays: 0,
      lagHours: ['LAB-WPF-01','LAB-PND-01'].includes(item.skuCode) ? 24 : 0,
      floatDays: 0,
      bufferDays: 0,
      isCriticalPath: ['LAB-WPF-01','LAB-PND-01','LAB-SCR-01','LAB-TIL-02','LAB-GRT-01'].includes(item.skuCode),
      constraintType: 'ASAP',
      supervisorChecklist: ['Confirm scope matches BOQ','Check quality before sign-off'],
      subcoordinatorChecklist: ['Verify evidence photos','Confirm trade compliance'],
      coordinatorChecklist: ['Approve for payment release','Confirm no pending snags'],
      labourAssignments: w.skilled>0||w.unskilled>0 ? [
        ...(w.skilled>0 ? [{
          rowId: item.skuCode+'-s1',
          trade: TRADE[item.skuCode]||'Mason',
          skillType: 'skilled' as const,
          qty: w.skilled,
          startTime: '08:00',
          endTime: '17:00',
          hoursPerDay: 8,
          daysNeeded: (()=>{const rc=SKU_TO_RATE[item.skuCode];if(rc&&rateMap[rc]&&rateMap[rc].output>1&&item.quantity>0){return Math.max(1,Math.ceil(item.quantity/rateMap[rc].output))}return DAYS[item.skuCode]||1})(),
          canUseMultiskill: true,
          minSkillLevel: 'mid',
        }] : []),
        ...(w.unskilled>0 ? [{
          rowId: item.skuCode+'-u1',
          trade: 'Helper',
          skillType: 'unskilled' as const,
          qty: w.unskilled,
          startTime: '08:00',
          endTime: '17:00',
          hoursPerDay: 8,
          daysNeeded: (()=>{const rc=SKU_TO_RATE[item.skuCode];if(rc&&rateMap[rc]&&rateMap[rc].output>1&&item.quantity>0){return Math.max(1,Math.ceil(item.quantity/rateMap[rc].output))}return DAYS[item.skuCode]||1})(),
          canUseMultiskill: true,
          minSkillLevel: 'beginner',
        }] : []),
        // Due-inspection, auto-attached to every real activity the moment the job's plan is
        // generated (10 Oct 2026 correction: "dates for inspections filling from jobs
        // initiated" -- not something a human adds by hand after the fact, every activity
        // carries its own real inspection requirement from generation onward). Skipped for an
        // activity whose own trade IS Supervisor (LAB-SUP-01/LAB-VTC-01) -- a supervisor
        // logging/verifying his own supervision activity is not a real inspection. Anchors to
        // the LAST day of the activity's own span via materialize.ts's daysNeeded<fullSpan
        // rule -- "due inspection days are programmed... after sub-stage/activity completion",
        // never spread across it. Runs through the exact same zone/deviance-walk/Day-by-Day
        // board/delay-recast mechanism as any skilled trade, no special casing.
        ...((TRADE[item.skuCode]||'Mason') !== 'Supervisor' ? [{
          rowId: item.skuCode+'-insp1',
          trade: 'Supervisor',
          skillType: 'skilled' as const,
          qty: 1,
          startTime: '08:00',
          endTime: '17:00',
          hoursPerDay: 1,
          daysNeeded: 1,
          canUseMultiskill: false,
          minSkillLevel: 'mid',
        }] : []),
      ] : [],
    }
    byMS[mc].push(sub)
  }
  const stages: MilestonePlanStage[] = ['M0','M1','M2','M3','M4'].map(mc=>({
    milestoneCode: mc,
    milestoneName: MS_NAMES[mc],
    paymentPercent: MS_PCT[mc],
    milestoneNumber: parseInt(mc.replace('M','')),
    isCustomStage: false,
    rate: {
      boqLabourCost: (byMS[mc]||[]).reduce((sum,s)=>{
        const item=nonRisk.find((x:any)=>x.skuCode===s.substageCode)
        return sum+(item?item.amount:0)
      },0)
    },
    subStages: byMS[mc] || [],
  }))
  return {stages}
}

export async function saveMilestonePlan(
  bookingRef: string,
  rows: JobMilestoneSubstageInput[],
): Promise<{ error?: string; savedCount?: number }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()

  const { error: deleteErr } = await (supabase as any)
    .from('job_milestone_substages')
    .delete()
    .eq('booking_ref', bookingRef)
  if (deleteErr) return { error: (deleteErr as { message: string }).message }

  if (rows.length === 0) return { savedCount: 0 }

  const insertRows = rows.map((r, index) => ({
    booking_ref: bookingRef,
    milestone_code: r.milestoneCode,
    substage_code: r.substageCode,
    substage_name: r.substageName,
    sequence_order: index,
    planned_day: r.plannedDay,
    skilled_workers_per_day: r.skilledWorkersPerDay,
    unskilled_workers_per_day: r.unskilledWorkersPerDay,
    evidence_required: r.evidenceRequired,
    status: r.status||'pending',
    substage_description: r.substageDescription||null,
    planned_hours: r.plannedHours||8,
    start_time_slot: r.startTimeSlot||'Full Day',
    planned_start_date: r.plannedStartDate||null,
    trade_type: r.tradeType||null,
    predecessor_substage_code: r.predecessorCode||null,
    dependency_type: r.dependencyType||'FS',
    lag_days: r.lagDays||0,
    lag_hours: r.lagHours||0,
    float_days: r.floatDays||0,
    buffer_days: r.bufferDays||0,
    is_critical_path: r.isCriticalPath||false,
    resource_constraint: r.resourceConstraint||null,
    constraint_type: r.constraintType||'ASAP',
    constraint_date: r.constraintDate||null,
    weather_delay_days: r.weatherDelayDays||0,
    // site_checklist/site_evidence_checklist are the correctly-named columns
    // (Site Incharge is the actual filler, despite the historical "supervisor_"
    // naming) -- resolved canonically here at creation time too, no dual-write
    // to the legacy evidence_checklist/supervisor_checklist columns.
    site_evidence_checklist: r.evidenceRequired?r.evidenceRequired.map(e=>({label:e,type:'photo',confirmed:false})):[],
    site_checklist: r.supervisorChecklist?r.supervisorChecklist.map(e=>({item:e,checked:false})):[],
    subcoordinator_checklist: r.subcoordinatorChecklist?r.subcoordinatorChecklist.map(e=>({item:e,checked:false})):[],
    coordinator_checklist: r.coordinatorChecklist?r.coordinatorChecklist.map(e=>({item:e,checked:false})):[],
    labour_assignments: r.labourAssignments||[],
    created_at: now,
    updated_at: now,
  }))

  const { error: insertErr } = await (supabase as any)
    .from('job_milestone_substages')
    .insert(insertRows)
  if (insertErr) return { error: (insertErr as { message: string }).message }

  // Baseline snapshot - per row, only where baseline not yet set
  const {data: unbaselined} = await supabase
    .from('job_milestone_substages')
    .select('id, early_start_date, early_finish_date, planned_day')
    .eq('booking_ref', bookingRef)
    .is('baseline_start_date', null)
  if(unbaselined && unbaselined.length > 0) {
    await Promise.all(unbaselined.map(s =>
      supabase.from('job_milestone_substages').update({
        baseline_start_date: s.early_start_date,
        baseline_finish_date: s.early_finish_date,
        baseline_planned_day: s.planned_day,
      }).eq('id', s.id)
    ))
  }
  return { savedCount: insertRows.length }
}


export async function computeCPMSchedule(bookingRef: string): Promise<{success:boolean;error?:string}> {
  const supabase = await createClient()
  const { data: subs, error } = await supabase
    .from('job_milestone_substages')
    .select('id,substage_code,planned_day,lag_days,lag_hours,dependency_type,predecessor_substage_code,weather_delay_days')
    .eq('booking_ref', bookingRef)
    .order('sequence_order')
  if (error||!subs) return {success:false,error:error?.message}
  const map: Record<string,typeof subs[0]> = {}
  subs.forEach(s=>{ if(s.substage_code) map[s.substage_code]=s })
  const earlyStart: Record<string,Date> = {}
  const earlyFinish: Record<string,Date> = {}
  const base = new Date(); base.setHours(0,0,0,0)
  for (const s of subs) {
    const code = s.substage_code; if(!code) continue
    // weather_delay_days extends THIS substage's own duration -- a real logged delay (Dynamic
    // Scheduler recast.ts bumps this column) pushes this substage's own finish date later,
    // which the FS/SS/FF/SF propagation below naturally carries forward into every substage
    // that actually depends on it. Confirmed correction, 10 Oct 2026: a delay must recompute
    // the whole dependency-aware schedule, not a flat "+N days to everything dated after it."
    const dur = (s.planned_day||1) + (s.weather_delay_days||0)
    const lagDays = (s.lag_days||0)+((s.lag_hours||0)/24)
    const pred = s.predecessor_substage_code
    const dep = s.dependency_type||'FS'
    let start = new Date(base)
    if(pred && earlyStart[pred] && earlyFinish[pred]){
      if(dep==='FS'){ start=new Date(earlyFinish[pred]); start.setDate(start.getDate()+Math.ceil(lagDays)) }
      else if(dep==='SS'){ start=new Date(earlyStart[pred]); start.setDate(start.getDate()+Math.ceil(lagDays)) }
      else if(dep==='FF'){ const f=new Date(earlyFinish[pred]); f.setDate(f.getDate()+Math.ceil(lagDays)); start=new Date(f); start.setDate(start.getDate()-dur) }
      else if(dep==='SF'){ start=new Date(earlyFinish[pred]); start.setDate(start.getDate()+Math.ceil(lagDays)) }
    }
    const finish=new Date(start); finish.setDate(finish.getDate()+dur)
    earlyStart[code]=start; earlyFinish[code]=finish
  }
  await Promise.all(subs.filter(s=>s.substage_code&&earlyStart[s.substage_code]).map(s=>
    supabase.from('job_milestone_substages').update({
      early_start_date:earlyStart[s.substage_code!].toISOString().split('T')[0],
      early_finish_date:earlyFinish[s.substage_code!].toISOString().split('T')[0],
      internal_planned_days:s.planned_day||1,
    }).eq('id',s.id)
  ))
  return {success:true}
}

export async function saveDependency(substageId: string, fields: {predecessorCode?: string;dependencyType?: string;lagDays?: number;lagHours?: number;isCriticalPath?: boolean;plannedDay?: number}): Promise<{success:boolean;error?:string}> {
  const supabase = await createClient()
  const updatePayload: Record<string, unknown> = {predecessor_substage_code: fields.predecessorCode??null,dependency_type: fields.dependencyType??"FS",lag_days: fields.lagDays??0,lag_hours: fields.lagHours??0,is_critical_path: fields.isCriticalPath??false}
  if (fields.plannedDay != null) updatePayload.planned_day = fields.plannedDay
  const { error } = await supabase.from("job_milestone_substages").update(updatePayload).eq("id", substageId)
  if(error) return {success:false,error:error.message}
  return {success:true}
}
export async function cleanSubstagePredecessor(
  bookingRef: string,
  substageCode: string,
  val: string | null
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('job_milestone_substages')
    .update({ predecessor_substage_code: val })
    .eq('booking_ref', bookingRef)
    .eq('substage_code', substageCode)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// Per the project owner's explicit verdict (9 Oct 2026): an execution-stage
// scope change, once merged into the main estimate, makes the job's whole
// plan "redefined... in short it gets to become a new job from when it
// happens" -- their own explicit choice was "Fully regenerated" (wipe and
// rebuild job_milestone_substages from the new merged BOQ from scratch,
// completed/paid sub-stages re-marked done manually afterward), not a
// partial patch. Called only from the client-acceptance hook
// (app/client/dashboard/[bookingRef]/actions.ts's submitOverallResponse)
// once it has confirmed this acceptance is for an execution-stage revision,
// not the job's original first-ever acceptance.
export async function regeneratePlanForRevisedEstimate(
  bookingRef: string,
): Promise<{ error?: string; savedCount?: number }> {
  const { stages, error: genErr } = await generateSubstagesFromBOQ(bookingRef)
  if (genErr) return { error: genErr }

  const rows: JobMilestoneSubstageInput[] = stages.flatMap((stage) =>
    stage.subStages.map((sub): JobMilestoneSubstageInput => ({
      milestoneCode: stage.milestoneCode,
      substageCode: sub.substageCode,
      substageName: sub.substageName,
      plannedDay: sub.plannedDay,
      skilledWorkersPerDay: sub.skilledWorkersPerDay,
      unskilledWorkersPerDay: sub.unskilledWorkersPerDay,
      evidenceRequired: sub.evidenceRequired,
      status: sub.status,
      substageDescription: sub.substageDescription,
      plannedHours: sub.plannedHours,
      startTimeSlot: sub.startTimeSlot,
      plannedStartDate: sub.plannedStartDate,
      tradeType: sub.tradeType,
      predecessorCode: sub.predecessorCode,
      dependencyType: sub.dependencyType,
      lagDays: sub.lagDays,
      lagHours: sub.lagHours,
      floatDays: sub.floatDays,
      bufferDays: sub.bufferDays,
      isCriticalPath: sub.isCriticalPath,
      resourceConstraint: sub.resourceConstraint,
      constraintType: sub.constraintType,
      constraintDate: sub.constraintDate,
      weatherDelayDays: sub.weatherDelayDays,
      supervisorChecklist: sub.supervisorChecklist,
      subcoordinatorChecklist: sub.subcoordinatorChecklist,
      coordinatorChecklist: sub.coordinatorChecklist,
      labourAssignments: sub.labourAssignments,
    })),
  )

  const saveResult = await saveMilestonePlan(bookingRef, rows)
  if (saveResult.error) return { error: saveResult.error }

  const cpmResult = await computeCPMSchedule(bookingRef)
  if (!cpmResult.success) return { error: cpmResult.error, savedCount: saveResult.savedCount }

  return { savedCount: saveResult.savedCount }
}