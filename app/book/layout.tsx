import StepHeader from './_components/StepHeader'

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <StepHeader />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  )
}
