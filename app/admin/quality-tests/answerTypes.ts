// How each quality-test step is answered. Must match the CHECK constraint in
// supabase/migrations/20261030_admin_structure_quality_tests.sql.
export const ANSWER_TYPES = [
  { value: 'pass_fail', label: 'Pass / Fail / Not applicable' },
  { value: 'yes_no', label: 'Yes / No' },
  { value: 'options', label: 'Choose one option' },
  { value: 'number', label: 'Number (with unit)' },
  { value: 'photo', label: 'Photograph' },
  { value: 'timer_start', label: 'Start hold timer (with photo)' },
  { value: 'timer_end', label: 'End hold timer' },
  { value: 'text', label: 'Free text' },
] as const

export const ANSWER_TYPE_VALUES: readonly string[] = ANSWER_TYPES.map((a) => a.value)
