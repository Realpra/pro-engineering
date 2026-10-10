import SiteHeader from './_components/SiteHeader'
import SiteFooter from './_components/SiteFooter'
import AccountReminder from './_components/AccountReminder'

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1F2328]">
      <SiteHeader />
      <AccountReminder />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
