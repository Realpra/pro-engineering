'use client'

// "Download PDF Certificate" had no onClick anywhere (PENDING #26) and no
// PDF library exists anywhere in this codebase (confirmed by grep) --
// adding one is a real dependency decision, not made here on a guess.
// window.print() achieves the same practical outcome with zero new
// dependencies: every browser's print dialog offers "Save as PDF" natively,
// and the certificate card itself is marked print-only via the
// data-certificate attribute + print.css so only it (not the whole page)
// prints.
export default function PrintCertificateButton({ targetId }: { targetId: string }) {
  function handlePrint() {
    document.querySelectorAll('[data-print-target]').forEach(el => el.removeAttribute('data-print-target'))
    document.getElementById(targetId)?.setAttribute('data-print-target', 'true')
    window.print()
  }

  return (
    <button
      onClick={handlePrint}
      className="w-full border border-[#1F3864] text-[#1F3864] text-xs font-bold py-2.5 rounded-xl"
    >
      Print / Save as PDF
    </button>
  )
}
