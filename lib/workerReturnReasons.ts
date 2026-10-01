// Ported from the never-wired app/admin/dashboard/WorkersTable.tsx (Part A, confirmed
// superseded-but-richer by the WorkersTable_Review workbook, 1 Oct 2026, decision E6:
// "Port the 10 preset reasons + auto-filled correction message into the live return
// screens? >> AGREED"). Used by both Sub-Coordinator's and Coordinator's own return
// actions -- Return and Reject stay two separate actions, only Admin can reject
// (E7, confirmed 1 Oct 2026); this list only ever feeds a RETURN, never a rejection.
export const WORKER_RETURN_REASONS: { label: string; action: string }[] = [
  {
    label: 'Aadhaar details incomplete or mismatch — resubmit Aadhaar',
    action: 'Please resubmit your Aadhaar details. Ensure the number and name match your card exactly.',
  },
  {
    label: 'BOCW card missing — upload BOCW card to proceed',
    action: 'Please upload your BOCW (Building and Other Construction Workers) registration card to proceed.',
  },
  {
    label: 'Bank account not verified — resubmit correct account details',
    action: 'Please resubmit correct bank account details. Ensure the account number and IFSC code are accurate.',
  },
  {
    label: 'Phone number not reachable — update contact number',
    action: 'Please update your contact number. Your registered phone number is currently unreachable.',
  },
  {
    label: 'Reference check pending — provide valid reference contact',
    action: 'Please provide a valid reference contact. Your registration requires a verifiable reference.',
  },
  {
    label: 'Competency declarations incomplete — complete all module declarations',
    action: 'Please complete all module competency declarations in your profile.',
  },
  {
    label: 'Safety induction not completed — complete safety induction',
    action: 'Please complete the mandatory safety induction before your registration can be approved.',
  },
  {
    label: 'Duplicate registration detected — contact coordinator',
    action: 'A duplicate registration has been detected. Please contact your coordinator to resolve this.',
  },
  {
    label: 'Zone not currently active for this trade — await zone activation',
    action: 'Your zone is not currently active for this trade. Please await zone activation or contact your coordinator.',
  },
  {
    label: 'Other',
    action: '',
  },
]
