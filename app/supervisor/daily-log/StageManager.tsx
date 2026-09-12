'use client'

import { useState } from 'react'
import MorningForm from './MorningForm'
import EveningForm from './EveningForm'
import LTFForm from './LTFForm'
import CompleteScreen from './CompleteScreen'

type Stage = 'morning' | 'evening' | 'ltf' | 'complete'

type Props = {
  supervisorId: string
  bookingRef: string
  jobTitle: string
  crew: { id: string; full_name: string; trade: string }[]
  morningSubmitted: boolean
  eveningSubmitted: boolean
  ltfSubmitted: boolean
}

export default function StageManager({
  supervisorId,
  bookingRef,
  crew,
  morningSubmitted,
  eveningSubmitted,
  ltfSubmitted,
}: Props) {
  const deriveInitialStage = (): Stage => {
    if (morningSubmitted && eveningSubmitted && ltfSubmitted) return 'complete'
    if (morningSubmitted && eveningSubmitted) return 'ltf'
    if (morningSubmitted) return 'evening'
    return 'morning'
  }

  const [stage, setStage] = useState<Stage>(deriveInitialStage)

  if (stage === 'complete') return <CompleteScreen />

  if (stage === 'morning') {
    return (
      <MorningForm
        supervisorId={supervisorId}
        bookingRef={bookingRef}
        crew={crew}
        onComplete={() => setStage('evening')}
      />
    )
  }

  if (stage === 'evening') {
    return (
      <EveningForm
        supervisorId={supervisorId}
        onComplete={() => setStage('ltf')}
      />
    )
  }

  return (
    <LTFForm
      supervisorId={supervisorId}
      onComplete={() => setStage('complete')}
    />
  )
}
