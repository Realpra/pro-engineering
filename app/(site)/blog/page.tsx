import content from '@/content/site-content.json'
import { Band, PageHero } from '../_components/blocks'
import BlogList from './BlogList'

const b = content.blog

export default function BlogPage() {
  return (
    <>
      <PageHero eyebrow={b.eyebrow} title={b.title} intro={b.intro} />
      <Band><BlogList /></Band>
    </>
  )
}
