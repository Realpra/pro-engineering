import { createClient } from '@/lib/supabase-client'

export interface SectorConfig {
  sector: string
  display_name: string
  site_visit_type: string
  [key: string]: unknown
}

const SECTOR_DEFAULTS: Record<string, SectorConfig> = {
  civil: {
    sector: 'civil',
    display_name: 'Civil & Geotechnical',
    site_visit_type: 'civil-site-visit',
  },
  construction: {
    sector: 'construction',
    display_name: 'Construction',
    site_visit_type: 'site-visit',
  },
  renovation: {
    sector: 'renovation',
    display_name: 'Home Renovation',
    site_visit_type: 'site-visit',
  },
  waterproofing: {
    sector: 'waterproofing',
    display_name: 'Waterproofing & Leak-Proofing',
    site_visit_type: 'site-visit',
  },
}

export async function getSectorConfig(sector: string): Promise<SectorConfig> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sector_config')
    .select('*')
    .eq('sector', sector)
    .single()
  if (!error && data) return data as SectorConfig
  return SECTOR_DEFAULTS[sector] ?? { sector, display_name: sector, site_visit_type: 'site-visit' }
}
