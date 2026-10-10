'use client'
import { useState } from 'react'
import { Search } from 'lucide-react'
import content from '@/content/site-content.json'
import { cn } from '@/lib/utils'

const b = content.blog

export default function BlogList() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  const q = query.trim().toLowerCase()
  const posts = b.posts.filter(p =>
    (!category || p.category === category) &&
    (!q || `${p.title} ${p.summary}`.toLowerCase().includes(q)),
  )

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        {posts.length === 0 && <p className="text-stone-600">{b.noResults}</p>}
        {posts.map(post => (
          <article key={post.title} className="bg-white border border-stone-200 border-l-4 border-l-[#F97316] p-5">
            <div className="text-xs font-bold uppercase tracking-wide text-stone-500">
              {post.date} · {post.author} · {post.category}
            </div>
            <h2 className="mt-1.5 text-xl font-black leading-snug">{post.title}</h2>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed">{post.summary}</p>
          </article>
        ))}
      </div>

      <aside className="space-y-8">
        <label className="block">
          <span className="block text-xs font-bold uppercase tracking-wide text-stone-600 mb-1.5">{b.searchLabel}</span>
          <span className="relative block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" aria-hidden />
            <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={b.searchPlaceholder}
              className="w-full bg-white border border-stone-300 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:border-[#1F2328]" />
          </span>
        </label>

        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-stone-600 mb-2">{b.categoriesTitle}</div>
          <ul className="space-y-1 text-sm">
            {b.categories.map(c => (
              <li key={c}>
                <button type="button" onClick={() => setCategory(category === c ? '' : c)} aria-pressed={category === c}
                  className={cn('w-full text-left px-3 py-2 border', category === c ? 'bg-[#1F2328] border-[#1F2328] text-white font-bold' : 'bg-white border-stone-200 hover:border-[#1F2328]')}>
                  {c} <span className={category === c ? 'text-stone-300' : 'text-stone-400'}>({b.posts.filter(p => p.category === c).length})</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  )
}
