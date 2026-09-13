import Link from 'next/link'

const trades = [
  { name: 'Mason', slug: 'mason', desc: 'Tiling, plastering, waterproofing, brickwork' },
  { name: 'Plumber', slug: 'plumber', desc: 'Supply lines, drainage, sanitary fitting' },
  { name: 'Electrician', slug: 'electrician', desc: 'Wiring, DB installation, light fitting' },
  { name: 'Waterproofer', slug: 'waterproofer', desc: 'Bathroom and terrace waterproofing' },
  { name: 'Painter', slug: 'painter', desc: 'Interior, exterior, texture finish' },
  { name: 'Carpenter', slug: 'carpenter', desc: 'Modular furniture, doors, false ceiling frame' },
  { name: 'False Ceiling Installer', slug: 'false-ceiling-installer', desc: 'Gypsum, grid, POP cornice' },
  { name: 'Helper', slug: 'helper', desc: 'Site support, material handling, cleaning' },
  { name: 'Supervisor', slug: 'supervisor', desc: 'Site supervision, quality inspection' },
]

export default function OnboardingLandingPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-[#1F3864] py-6 px-4">
        <div className="text-white font-bold text-xl text-center">PRO ENGINEERING</div>
        <div className="text-blue-200 text-sm text-center mt-1">Worker Registration Portal</div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="text-[#1F3864] font-bold text-lg mb-2">Select Your Trade</div>
        <div className="text-gray-500 text-sm mb-6">Choose your primary trade to begin registration</div>
        <div className="space-y-3">
          {trades.map(t => (
            <Link key={t.slug} href={`/onboarding/${t.slug}`}
              className="block bg-white rounded-2xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[#1F3864] font-bold text-base">{t.name}</div>
                  <div className="text-gray-500 text-sm mt-0.5">{t.desc}</div>
                </div>
                <div className="text-[#F97316] text-xl">→</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
