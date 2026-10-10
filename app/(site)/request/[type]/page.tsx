import { notFound } from 'next/navigation'
import RequestForm from '../../_components/RequestForm'
import type { RequestType } from '../../actions'

const TYPES: Record<string, RequestType> = {
  'one-day': 'one_day',
  'turn-key': 'turn_key',
  'labour-bazaar': 'labour_bazaar',
}

export function generateStaticParams() {
  return Object.keys(TYPES).map(type => ({ type }))
}

export default async function RequestPage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  const requestType = TYPES[type]
  if (!requestType) notFound()
  return <RequestForm key={requestType} type={requestType} />
}
