/* eslint-disable @typescript-eslint/no-explicit-any */
// Daily execution visit findings (owner, 31 Oct 2026, D27). Every checklist item answered "No"
// and every risk flag raised on the visit becomes a line the Supervisor must turn into a
// corrective action. Labels are the exact item labels on the visit form
// (app/supervisor/site-visit/SiteVisitManager.tsx).

export const CHECKLIST_LABELS: Record<string, string> = {
  ppeInUse: "PPE in use by all workers",
  siteAccessClear: "Site access clear and safe",
  noHazards: "No hazardous conditions observed",
  workersCountMatch: "Workers count matches deployment plan",
  hardHat: "Hard Hat",
  safetyShoes: "Safety Shoes",
  gloves: "Gloves",
  eyeProtection: "Eye Protection",
  harness: "Safety Harness (if working at height)",
  workDoneAsDescribed: "Work done as described in substage?",
  photosCorrect: "Evidence photos correct and match actual?",
  testResultsOk: "Test results within specification?",
  noSnags: "No snags or defects observed?",
  readyForNext: "Ready for next substage to commence?",
  materialGradeMatch: "Material grade matches BOQ?",
  brandMatch: "Brand / standard matches?",
  quantityMatch: "Quantity on site matches requirement?",
  tradeSequenceCorrect: "Trade sequence correct?",
  applicationMethodCorrect: "Application method correct?",
}

export type VisitFinding = { source: 'checklist_no' | 'risk_flag'; key: string; text: string }

// Each saved screen column holds the whole form object, so the screens are merged in order.
export function mergeVisitForm(report: Record<string, any>, columns: string[]): Record<string, any> {
  const form: Record<string, any> = {}
  for (const c of columns) {
    const v = report[c]
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(form, v)
  }
  return form
}

export function extractVisitFindings(form: Record<string, any>): VisitFinding[] {
  const out: VisitFinding[] = []
  const remarks: Record<string, string> = form.checklistRemarks ?? {}
  for (const [key, label] of Object.entries(CHECKLIST_LABELS)) {
    if (form[key] === 'No') {
      const r = (remarks[key] ?? '').trim()
      out.push({ source: 'checklist_no', key, text: r ? `${label} -- No: ${r}` : `${label} -- No` })
    }
  }
  if (form.riskFlagged === true) {
    out.push({ source: 'risk_flag', key: 'riskFlagged', text: `Hazard risk flag${form.riskDescription ? ': ' + form.riskDescription : ''}` })
  }
  if (form.riskFlagType && form.riskFlagType !== 'None') {
    out.push({ source: 'risk_flag', key: 'riskFlagType', text: `${form.riskFlagType} risk${form.riskFlagDesc ? ': ' + form.riskFlagDesc : ''}` })
  }
  if ((form.attendanceMismatchReason ?? '').trim()) {
    out.push({ source: 'checklist_no', key: 'attendanceMismatchReason', text: `Attendance mismatch: ${form.attendanceMismatchReason}` })
  }
  return out
}

export const VISIT_FORM_COLUMNS = [
  'screen01_job_details', 'screen02_scope_intent', 'screen03_plumbing', 'screen04_electrical',
  'screen05_waterproofing', 'screen06_walls', 'screen07_floors', 'screen08_tiles', 'screen09_fixtures',
  'screen10_ceiling', 'screen11_logistics', 'screen12_compliance', 'screen13_measurements',
  'screen14_labour', 'screen15_materials', 'screen16_risk_flags', 'screen17_risk_decisions',
  'screen18_milestones', 'screen19_materials', 'screen20_submit',
]
