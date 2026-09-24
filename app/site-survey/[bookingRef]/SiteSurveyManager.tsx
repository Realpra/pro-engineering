'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Screen01 from '../../supervisor/site-visit/Screen01'
import Screen02_ScopeIntent from '../../supervisor/site-visit/Screen02_ScopeIntent'
import Screen03_Ceiling from '../../supervisor/site-visit/Screen03_Ceiling'
import Screen04_Walls from '../../supervisor/site-visit/Screen04_Walls'
import Screen05_Floors from '../../supervisor/site-visit/Screen05_Floors'
import Screen06_Plumbing from '../../supervisor/site-visit/Screen06_Plumbing'
import Screen07_Electrical from '../../supervisor/site-visit/Screen07_Electrical'
import Screen08_Waterproofing from '../../supervisor/site-visit/Screen08_Waterproofing'
import Screen09_Demolition from '../../supervisor/site-visit/Screen09_Demolition'
import Screen10_Tiles from '../../supervisor/site-visit/Screen10_Tiles'
import Screen11_Fixtures from '../../supervisor/site-visit/Screen11_Fixtures'
import Screen12_Logistics from '../../supervisor/site-visit/Screen12_Logistics'
import Screen13_Compliance from '../../supervisor/site-visit/Screen13_Compliance'
import Screen14_Measurements from '../../supervisor/site-visit/Screen14_Measurements'
import Screen15_Labour from '../../supervisor/site-visit/Screen15_Labour'
import Screen16_Timeline from '../../supervisor/site-visit/Screen16_Timeline'
import Screen17_RiskDecisions from '../../supervisor/site-visit/Screen17_RiskDecisions'
import Screen18_ClientScope from '../../supervisor/site-visit/Screen18_ClientScope'
import Screen19_Materials from '../../supervisor/site-visit/Screen19_Materials'
import Screen20_Submit from '../../supervisor/site-visit/Screen20_Submit'

const TOTAL_SCREENS = 20

const SCREEN_TITLES = [
  'Job Details', 'Scope Intent', 'Ceiling', 'Walls', 'Floors', 'Plumbing',
  'Electrical', 'Waterproofing', 'Demolition', 'Tiles', 'Fixtures', 'Logistics',
  'Compliance', 'Measurements', 'Labour', 'Timeline', 'Risk Decisions',
  'Client Scope', 'Materials', 'Submit & Authorize',
]

type Props = {
  supervisorId: string
  bookingRef: string
  jobTitle: string
  jobType: string
  zone: string
  district: string
  clientName: string
  existingReportId: string | null
  labourRateConfig: object[]
}

export default function SiteSurveyManager({
  supervisorId,
  bookingRef,
  jobTitle,
  jobType,
  zone,
  district,
  clientName,
  existingReportId,
  labourRateConfig,
}: Props) {
  const router = useRouter()
  const [screen, setScreen] = useState(1)
  const [reportId, setReportId] = useState<string | null>(existingReportId)
  const [scopeIntent, setScopeIntent] = useState<object>({})
  const [measurements, setMeasurements] = useState<object>({})
  const [labourData, setLabourData] = useState<object>({})
  const [done, setDone] = useState(false)

  const next = () => setScreen((s) => Math.min(TOTAL_SCREENS, s + 1))
  const back = () => setScreen((s) => Math.max(1, s - 1))

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-lg font-bold text-[#1F3864] mb-2">Survey Submitted</p>
        <p className="text-gray-500 text-sm mb-6">
          The site survey for {bookingRef} has been submitted for estimation.
        </p>
        <button
          type="button"
          onClick={() => router.push('/supervisor/dashboard')}
          className="text-blue-600 text-sm font-semibold underline"
        >
          Back to Dashboard
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-4">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Screen {screen} of {TOTAL_SCREENS} — {SCREEN_TITLES[screen - 1]}
        </p>
        <div className="w-full h-1.5 bg-gray-100 rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-[#1F3864] transition-all"
            style={{ width: `${(screen / TOTAL_SCREENS) * 100}%` }}
          />
        </div>
      </div>

      {screen === 1 && (
        <Screen01
          supervisorId={supervisorId}
          bookingRef={bookingRef}
          jobTitle={jobTitle}
          jobType={jobType}
          zone={zone}
          district={district}
          clientName={clientName}
          reportId={reportId}
          onComplete={(rid) => { setReportId(rid); next() }}
        />
      )}
      {screen === 2 && reportId && (
        <Screen02_ScopeIntent
          reportId={reportId}
          onComplete={(data) => { setScopeIntent(data); next() }}
          isReview={false}
          onBack={back}
        />
      )}
      {screen === 3 && reportId && <Screen03_Ceiling reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 4 && reportId && <Screen04_Walls reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 5 && reportId && <Screen05_Floors reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 6 && reportId && <Screen06_Plumbing reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 7 && reportId && <Screen07_Electrical reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 8 && reportId && <Screen08_Waterproofing reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 9 && reportId && <Screen09_Demolition reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 10 && reportId && <Screen10_Tiles reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 11 && reportId && <Screen11_Fixtures reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 12 && reportId && <Screen12_Logistics reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 13 && reportId && <Screen13_Compliance reportId={reportId} onComplete={next} onBack={back} />}
      {screen === 14 && reportId && (
        <Screen14_Measurements
          reportId={reportId}
          onComplete={(data) => { setMeasurements(data); next() }}
          onBack={back}
        />
      )}
      {screen === 15 && reportId && (
        <Screen15_Labour
          reportId={reportId}
          scopeIntent={scopeIntent}
          measurements={measurements}
          onComplete={(data) => { setLabourData(data); next() }}
          onBack={back}
        />
      )}
      {screen === 16 && reportId && (
        <Screen16_Timeline
          reportId={reportId}
          measurements={measurements}
          scopeIntent={scopeIntent}
          labourData={labourData}
          labourRateConfig={labourRateConfig}
          onComplete={next}
          onBack={back}
        />
      )}
      {screen === 17 && reportId && (
        <Screen17_RiskDecisions reportId={reportId} allScreenData={{}} onComplete={next} onBack={back} />
      )}
      {screen === 18 && reportId && (
        <Screen18_ClientScope reportId={reportId} scopeIntent={scopeIntent} onComplete={next} onBack={back} />
      )}
      {screen === 19 && reportId && (
        <Screen19_Materials
          reportId={reportId}
          measurements={measurements}
          scopeIntent={scopeIntent}
          onComplete={next}
          onBack={back}
        />
      )}
      {screen === 20 && reportId && (
        <Screen20_Submit
          reportId={reportId}
          bookingRef={bookingRef}
          supervisorId={supervisorId}
          allScreenData={{ scopeIntent, measurements, labourData }}
          onComplete={() => setDone(true)}
          onBack={(n) => (typeof n === 'number' ? setScreen(n) : back())}
        />
      )}
    </div>
  )
}
