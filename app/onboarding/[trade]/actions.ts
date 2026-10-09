'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { tradeName } from './utils'

const SUPABASE_URL = 'https://xhlpdbcrncpznrqpcrht.supabase.co'

function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  return serviceKey
    ? createAdminClient(SUPABASE_URL, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : createAdminClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
}

function tradeCode(trade: string): string {
  const map: Record<string, string> = {
    mason:'MAS', plumber:'PLB', electrician:'ELC', waterproofer:'WTP', tiler:'TIL',
    painter:'PNT', carpenter:'CRP', 'false-ceiling-installer':'FCI',
    helper:'HLP', supervisor:'SUP',
  }
  return map[trade.toLowerCase()] ?? 'WRK'
}

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '').slice(0, 20) || 'worker'
}

// ─── Reference data for the form (geo hierarchy + trade skill questions) ────

export type GeoNode = { id: string; name: string; level: string; parent_id: string | null }

export async function getOnboardingReferenceData(trade: string) {
  const supabase = adminClient()
  const [{ data: geo }, { data: questions }] = await Promise.all([
    supabase.from('geo_hierarchy').select('id, name, level, parent_id').eq('is_active', true).order('name'),
    supabase.from('trade_skill_questions').select('id, question_code, question_text, display_order')
      .eq('trade', tradeName(trade)).eq('is_active', true).order('display_order'),
  ])
  return {
    geo: (geo ?? []) as GeoNode[],
    skillQuestions: (questions ?? []) as { id: string; question_code: string; question_text: string; display_order: number }[],
  }
}

export async function getZoneSectorCoverage(zoneId: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('geo_zone_sector_coverage')
    .select('sector_id, geo_hierarchy!geo_zone_sector_coverage_sector_id_fkey(id, name)')
    .eq('zone_id', zoneId)
  return (data ?? []).map((r: any) => ({ id: r.sector_id, name: r.geo_hierarchy?.name ?? '' }))
}

// ─── Main registration insert — every Section A-K scalar field ─────────────

export type RegistrationInput = {
  // Section A — Identity & Location
  fullName: string; phone: string; email?: string; aadhaarLast4?: string; pan?: string
  gender?: string; dob?: string; whatsappSame: boolean; whatsappPhone?: string
  state: string; district?: string; city?: string; pincode?: string; address?: string
  accommodationType?: string; transportMode?: string; maxTravelMinutes?: number
  sameDayNoticeZones?: string[]; willingOutOfZoneOvernight?: boolean
  unavailableWeekdays?: string[]; seasonalUnavailableMonths?: string[]
  zones: string[]
  // Section B — Primary Trade Declaration
  skill_level: string; sector: string; labour_type: string; employment_type: string
  years_experience?: string; jobs_completed?: number
  yearsResidential?: number; yearsCommercial?: number; yearsInstitutional?: number
  largestProjectDescription?: string; largestProjectRole?: string; maxWorkersSupervised?: number
  mostDemandingJobDescription?: string
  lastEmployerName?: string; lastEmployerPhone?: string; lastEmployerWorkType?: string
  reasonLeftLastEmployer?: string
  priorEmployerName?: string; priorEmployerWorkType?: string
  longestTenureMonths?: number; priorPlatformExperience?: string
  // Section D
  secondaryTrades: string[]; nextTrainingInterest?: string
  // Section E
  rejectedWorkHistory?: string; standoutJobDescription?: string; hasAppreciationCertificate?: boolean
  selfRatedQualityScore?: number; selfRatedQualityReason?: string; qualityCheckMethod?: string
  paymentDisputeHistory?: string; askedToLeaveSiteHistory?: string; differentiatorDescription?: string
  // Section F
  height_restriction: boolean; dustRestriction: boolean; otherRestriction?: boolean
  otherRestrictionDetail?: string; deploymentRestriction?: string
  onMedicationAffectingAlertness?: boolean; doctorRestrictedWorkType?: string
  canCarry25kg50m?: string; canKneelCrouch2hr?: boolean; canWorkHeights2m?: string
  canWorkConfinedSpaces?: boolean; canWorkHighHeat8hr?: boolean; wearsCorrectiveLenses?: boolean
  // Section G
  hadFallFromHeight?: boolean; fallFromHeightDetail?: string
  hadElectricShock?: boolean; electricShockDetail?: string
  witnessedStructuralCollapse?: boolean; structuralCollapseDetail?: string
  chemicalInhalationTreatment?: string; eyeInjuryHistory?: string
  changedPracticeAfterIncident?: string; witnessedOthersAccident?: string
  reportedNearMiss?: boolean; nearMissActedOn?: boolean
  hasPermanentInjuryRestriction?: boolean; permanentInjuryDetail?: string
  // Section H
  daily_wage?: number; hourly_rate?: number; is_available: boolean
  currentlyEmployedElsewhere?: boolean; willInformCurrentEmployer?: boolean
  availableDaysPerMonth?: string; willingOutputBasedPay?: boolean
  prefersTeamOrSolo?: string; hasRegularPartner?: boolean
  partnerName?: string; partnerTrade?: string; partnerPhone?: string; partnerSkillAssessment?: string
  noticePeriodNeeded?: string; availableEmergency4hr?: boolean; emergencyPremiumPct?: number
  willingSundaysHolidays?: boolean; holidayPremiumPct?: number
  // Section I
  ownsBasicTools?: boolean; toolsList?: string; toolsCalibrated?: boolean
  ownsPowerTools?: boolean; powerToolsList?: string; ownsPpe?: string[]
  ownsSmartphone?: string; essentialTool1?: string; essentialTool2?: string
  hasReliableTransport1hr?: boolean
  // Section J
  ratingTechnicalAccuracy?: number; ratingSpeed?: number; ratingDrawingComprehension?: number
  ratingUnsupervisedDelivery?: number; ratingProblemIdentification?: number; ratingAsksForGuidance?: number
  ratingPhysicalFitness?: number; ratingReliability?: number; ratingHonesty?: number
  // Compliance & Finance (existing)
  team_name?: string; teamNumber?: string
  bocwRegistered: boolean; bocw_number?: string; pf_uan?: string; esic_ip?: string
  bank_account?: string; ifsc_code?: string
  emergency_name?: string; emergency_phone?: string
  // Trade credential validity (E5, WorkersTable_Review workbook, 1 Oct 2026) -- captured
  // on the form itself, flows upward unchanged to every review role.
  credentialType?: 'registration' | 'permit_license' | 'not_applicable' | 'other'
  credentialOtherDetail?: string; credentialValidUpto?: string
  // Section K
  reference1Name?: string; reference1Phone?: string; reference2Name?: string; reference2Phone?: string
  consentReferenceCheck?: boolean; consentProfileSharing?: boolean
  declared: boolean; agreed: boolean
}

export async function submitWorkerRegistration(trade: string, data: RegistrationInput) {
  try {
    const supabase = adminClient()

    // E7-ii (WorkersTable_Review workbook, 1 Oct 2026, "Fully automatic"): a new
    // registration matching a previously REJECTED worker's phone and/or Aadhaar-last-4
    // updates that same row (same id/worker_code) instead of creating a new, orphaned
    // one -- a genuine resubmission, not a duplicate. Matched on phone OR Aadhaar so
    // either identifier alone is enough (Aadhaar is optional at registration).
    const matchFilters = [`phone.eq.${data.phone}`]
    if (data.aadhaarLast4) matchFilters.push(`aadhaar_last4.eq.${data.aadhaarLast4}`)
    const { data: priorRejected } = await supabase
      .from('workers')
      .select('id, worker_code, resubmission_count')
      .eq('approval_status', 'rejected')
      .or(matchFilters.join(','))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const workerCode = priorRejected?.worker_code ?? (() => {
      const code = tradeCode(trade)
      const year = new Date().getFullYear()
      const rand = Math.floor(1000 + Math.random() * 9000)
      return `WRK-${code}-${year}-${rand}`
    })()

    const row = {
      full_name: data.fullName, phone: data.phone, email: data.email ?? null,
      aadhaar_last4: data.aadhaarLast4 ?? null, pan: data.pan ?? null,
      gender: data.gender ?? null, dob: data.dob ?? null,
      whatsapp_same: data.whatsappSame, whatsapp_phone: data.whatsappSame ? null : (data.whatsappPhone ?? null),
      state: data.state, district: data.district ?? null, city: data.city ?? null,
      pincode: data.pincode ?? null, address: data.address ?? null,
      accommodation_type: data.accommodationType ?? null, transport_mode: data.transportMode ?? null,
      max_travel_minutes: data.maxTravelMinutes ?? null,
      same_day_notice_zones: data.sameDayNoticeZones ?? null,
      willing_out_of_zone_overnight: data.willingOutOfZoneOvernight ?? false,
      unavailable_weekdays: data.unavailableWeekdays ?? null,
      seasonal_unavailable_months: data.seasonalUnavailableMonths ?? null,
      zones: data.zones,
      trade: tradeName(trade), skill_level: data.skill_level, sector: data.sector,
      labour_type: data.labour_type, employment_classification: data.employment_type,
      years_experience: data.years_experience ?? null, jobs_completed_in_trade: data.jobs_completed ?? 0,
      years_residential: data.yearsResidential ?? null, years_commercial: data.yearsCommercial ?? null,
      years_institutional: data.yearsInstitutional ?? null,
      largest_project_description: data.largestProjectDescription ?? null,
      largest_project_role: data.largestProjectRole ?? null,
      max_workers_supervised: data.maxWorkersSupervised ?? null,
      most_demanding_job_description: data.mostDemandingJobDescription ?? null,
      last_employer_name: data.lastEmployerName ?? null, last_employer_phone: data.lastEmployerPhone ?? null,
      last_employer_work_type: data.lastEmployerWorkType ?? null,
      reason_left_last_employer: data.reasonLeftLastEmployer ?? null,
      prior_employer_name: data.priorEmployerName ?? null, prior_employer_work_type: data.priorEmployerWorkType ?? null,
      longest_tenure_months: data.longestTenureMonths ?? null,
      prior_platform_experience: data.priorPlatformExperience ?? null,
      secondary_trades: data.secondaryTrades, next_training_interest: data.nextTrainingInterest ?? null,
      rejected_work_history: data.rejectedWorkHistory ?? null,
      standout_job_description: data.standoutJobDescription ?? null,
      has_appreciation_certificate: data.hasAppreciationCertificate ?? false,
      self_rated_quality_score: data.selfRatedQualityScore ?? null,
      self_rated_quality_reason: data.selfRatedQualityReason ?? null,
      quality_check_method: data.qualityCheckMethod ?? null,
      payment_dispute_history: data.paymentDisputeHistory ?? null,
      asked_to_leave_site_history: data.askedToLeaveSiteHistory ?? null,
      differentiator_description: data.differentiatorDescription ?? null,
      height_restriction: data.height_restriction, dust_restriction: data.dustRestriction,
      other_restriction: data.otherRestriction ?? false, other_restriction_detail: data.otherRestrictionDetail ?? null,
      deployment_restriction: data.deploymentRestriction ?? null,
      on_medication_affecting_alertness: data.onMedicationAffectingAlertness ?? null,
      doctor_restricted_work_type: data.doctorRestrictedWorkType ?? null,
      can_carry_25kg_50m: data.canCarry25kg50m ?? null, can_kneel_crouch_2hr: data.canKneelCrouch2hr ?? null,
      can_work_heights_2m: data.canWorkHeights2m ?? null, can_work_confined_spaces: data.canWorkConfinedSpaces ?? null,
      can_work_high_heat_8hr: data.canWorkHighHeat8hr ?? null, wears_corrective_lenses: data.wearsCorrectiveLenses ?? null,
      had_fall_from_height: data.hadFallFromHeight ?? false, fall_from_height_detail: data.fallFromHeightDetail ?? null,
      had_electric_shock: data.hadElectricShock ?? false, electric_shock_detail: data.electricShockDetail ?? null,
      witnessed_structural_collapse: data.witnessedStructuralCollapse ?? false,
      structural_collapse_detail: data.structuralCollapseDetail ?? null,
      chemical_inhalation_treatment: data.chemicalInhalationTreatment ?? null,
      eye_injury_history: data.eyeInjuryHistory ?? null,
      changed_practice_after_incident: data.changedPracticeAfterIncident ?? null,
      witnessed_others_accident: data.witnessedOthersAccident ?? null,
      reported_near_miss: data.reportedNearMiss ?? false, near_miss_acted_on: data.nearMissActedOn ?? null,
      has_permanent_injury_restriction: data.hasPermanentInjuryRestriction ?? false,
      permanent_injury_detail: data.permanentInjuryDetail ?? null,
      daily_wage_inr: data.daily_wage ?? null, hourly_rate: data.hourly_rate ?? null, is_available: data.is_available,
      currently_employed_elsewhere: data.currentlyEmployedElsewhere ?? null,
      will_inform_current_employer: data.willInformCurrentEmployer ?? null,
      available_days_per_month: data.availableDaysPerMonth ?? null,
      willing_output_based_pay: data.willingOutputBasedPay ?? null,
      prefers_team_or_solo: data.prefersTeamOrSolo ?? null, has_regular_partner: data.hasRegularPartner ?? false,
      partner_name: data.partnerName ?? null, partner_trade: data.partnerTrade ?? null,
      partner_phone: data.partnerPhone ?? null, partner_skill_assessment: data.partnerSkillAssessment ?? null,
      notice_period_needed: data.noticePeriodNeeded ?? null,
      available_emergency_4hr: data.availableEmergency4hr ?? false, emergency_premium_pct: data.emergencyPremiumPct ?? null,
      willing_sundays_holidays: data.willingSundaysHolidays ?? false, holiday_premium_pct: data.holidayPremiumPct ?? null,
      owns_basic_tools: data.ownsBasicTools ?? null, tools_list: data.toolsList ?? null,
      tools_calibrated: data.toolsCalibrated ?? null, owns_power_tools: data.ownsPowerTools ?? null,
      power_tools_list: data.powerToolsList ?? null, owns_ppe: data.ownsPpe ?? null,
      owns_smartphone: data.ownsSmartphone ?? null, essential_tool_1: data.essentialTool1 ?? null,
      essential_tool_2: data.essentialTool2 ?? null, has_reliable_transport_1hr: data.hasReliableTransport1hr ?? null,
      rating_technical_accuracy: data.ratingTechnicalAccuracy ?? null, rating_speed: data.ratingSpeed ?? null,
      rating_drawing_comprehension: data.ratingDrawingComprehension ?? null,
      rating_unsupervised_delivery: data.ratingUnsupervisedDelivery ?? null,
      rating_problem_identification: data.ratingProblemIdentification ?? null,
      rating_asks_for_guidance: data.ratingAsksForGuidance ?? null,
      rating_physical_fitness: data.ratingPhysicalFitness ?? null, rating_reliability: data.ratingReliability ?? null,
      rating_honesty: data.ratingHonesty ?? null,
      team_name: data.team_name ?? null, team_number: data.teamNumber ?? null,
      is_bocw_registered: data.bocwRegistered, bocw_registration_number: data.bocw_number ?? null,
      pf_uan: data.pf_uan ?? null, esic_ip_number: data.esic_ip ?? null,
      bank_account_number: data.bank_account ?? null, ifsc_code: data.ifsc_code ?? null,
      emergency_contact_name: data.emergency_name ?? null, emergency_contact_phone: data.emergency_phone ?? null,
      credential_type: data.credentialType ?? null, credential_other_detail: data.credentialOtherDetail ?? null,
      credential_valid_upto: data.credentialValidUpto ?? null,
      reference_1_name: data.reference1Name ?? null, reference_1_phone: data.reference1Phone ?? null,
      reference_2_name: data.reference2Name ?? null, reference_2_phone: data.reference2Phone ?? null,
      consent_reference_check: data.consentReferenceCheck ?? false,
      consent_profile_sharing: data.consentProfileSharing ?? false,
      declared: data.declared, agreed: data.agreed,
      declaration_confirmed_at: (data.declared && data.agreed) ? new Date().toISOString() : null,
      approval_status: 'pending', is_active: true, worker_code: workerCode, profile_complete: false,
    }

    const { data: result, error } = priorRejected
      ? await supabase.from('workers').update({
          ...row,
          resubmission_count: (priorRejected.resubmission_count ?? 0) + 1,
          resubmitted_at: new Date().toISOString(),
        }).eq('id', priorRejected.id).select('id, worker_code').single()
      : await supabase.from('workers').insert(row).select('id, worker_code').single()

    if (error) return { error: error.message }

    // Resubmission: clear the rejected attempt's own child-table rows before the
    // caller re-saves fresh ones for the same worker_id, so a resubmission doesn't
    // leave stale skill-answer/secondary-skill/accident-history/work-sample rows
    // sitting alongside the new submission's.
    if (priorRejected) {
      await Promise.all([
        supabase.from('worker_skill_answers').delete().eq('worker_id', priorRejected.id),
        supabase.from('worker_secondary_skills').delete().eq('worker_id', priorRejected.id),
        supabase.from('worker_accident_history').delete().eq('worker_id', priorRejected.id),
        supabase.from('worker_work_samples').delete().eq('worker_id', priorRejected.id),
      ])
    }

    revalidatePath('/onboarding')
    return { success: true, workerId: result.id, workerCode: result.worker_code }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── Child-table saves (Sections C, D, G) — called after the main insert ───

export async function saveSkillAnswers(workerId: string, trade: string, answers: Record<string, string>) {
  const entries = Object.entries(answers).filter(([, v]) => v && v.trim())
  if (entries.length === 0) return { success: true }
  const supabase = adminClient()
  const { error } = await supabase.from('worker_skill_answers').insert(
    entries.map(([question_code, answer]) => ({ worker_id: workerId, question_code, trade: tradeName(trade), answer }))
  )
  if (error) return { error: error.message }
  return { success: true }
}

export type SecondarySkillInput = { skillName: string; ratingLevel: string; jobsLast2yr?: number; complexExample?: string }

export async function saveSecondarySkills(workerId: string, skills: SecondarySkillInput[]) {
  if (skills.length === 0) return { success: true }
  const supabase = adminClient()
  const { error } = await supabase.from('worker_secondary_skills').insert(
    skills.map(s => ({
      worker_id: workerId, skill_name: s.skillName, rating_level: s.ratingLevel || null,
      jobs_last_2yr: s.jobsLast2yr ?? null, complex_example: s.complexExample ?? null,
    }))
  )
  if (error) return { error: error.message }
  return { success: true }
}

export type AccidentIncidentInput = {
  incidentYear?: number; injuryDescription?: string; cause?: string
  wasHospitalized?: boolean; fullRecovery?: boolean
}

export async function saveAccidentHistory(workerId: string, incidents: AccidentIncidentInput[]) {
  if (incidents.length === 0) return { success: true }
  const supabase = adminClient()
  const { error } = await supabase.from('worker_accident_history').insert(
    incidents.map(i => ({
      worker_id: workerId, incident_year: i.incidentYear ?? null, injury_description: i.injuryDescription ?? null,
      cause: i.cause ?? null, was_hospitalized: i.wasHospitalized ?? null, full_recovery: i.fullRecovery ?? null,
    }))
  )
  if (error) return { error: error.message }
  return { success: true }
}

// ─── Photo uploads (selfie + work samples) — real storage, worker-selfies
// bucket has existed since the original Tier-1 build but was never wired ───

export async function uploadWorkerPhoto(workerId: string, base64Data: string, fileName: string, kind: 'selfie' | 'work_sample') {
  try {
    const supabase = adminClient()
    const matches = base64Data.match(/^data:(.+);base64,(.+)$/)
    if (!matches) return { error: 'Invalid image data' }
    const contentType = matches[1]
    const buffer = Buffer.from(matches[2], 'base64')
    const ext = fileName.split('.').pop() || 'jpg'
    const path = `${workerId}/${kind}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('worker-selfies').upload(path, buffer, { contentType, upsert: true })
    if (uploadError) return { error: uploadError.message }

    if (kind === 'selfie') {
      const { error: updateError } = await supabase.from('workers').update({ profile_photo_url: path }).eq('id', workerId)
      if (updateError) return { error: updateError.message }
    } else {
      const { error: insertError } = await supabase.from('worker_work_samples').insert({ worker_id: workerId, photo_url: path })
      if (insertError) return { error: insertError.message }
    }
    return { success: true, path }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ─── Dev/beta-stage login convention (Session 65) ───────────────────────────

const WORKER_DEV_LOGIN_PASSWORD = 'Worker2026'

export async function createWorkerAuthAccount(trade: string, fullName: string, workerId: string, workerCode: string) {
  try {
    const admin = adminClient()
    const numbering = workerCode.split('-').pop() ?? '0000'
    const loginEmail = `${slugify(fullName)}_${slugify(tradeName(trade))}_${numbering}@proengineering.in`
    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail, password: WORKER_DEV_LOGIN_PASSWORD, email_confirm: true,
      user_metadata: { full_name: fullName, worker_code: workerCode }
    })
    if (error) return { error: error.message }
    const newId = data.user.id
    const { error: usersError } = await admin.from('users').insert({
      id: newId, email: loginEmail, full_name: fullName, platform_role: 'worker'
    })
    if (usersError) return { error: usersError.message }
    const { error: updateError } = await admin.from('workers')
      .update({ auth_user_id: newId, user_id: newId, login_email: loginEmail })
      .eq('id', workerId)
    if (updateError) return { error: updateError.message }
    return { success: true, userId: newId, loginEmail }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function checkPhoneExists(phone: string) {
  const supabase = adminClient()
  const { data } = await supabase.from('workers').select('id, approval_status').eq('phone', phone).maybeSingle()
  // A REJECTED worker's phone is not a blocking duplicate -- E7-ii's automatic
  // resubmission (submitWorkerRegistration) is meant to let them re-register through
  // that same phone, updating the old row rather than being told it's taken.
  return { exists: !!data && data.approval_status !== 'rejected' }
}
