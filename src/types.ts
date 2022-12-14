export interface FetchResponse<T> {
  data: T | null
  error: Error | null
}

export interface DomainInfo {
  type: 'withAffiliateAd' | 'withMoneymadeAd' | 'withoutAd' | 'freemium'
  url: string
  name: string
  profiles: Profile[]
}

export interface Hashes {
  adPlug: string
  hash: string
  inContext: boolean
  summary: string[]
  anchors: string[]
  error?: string
}

export interface Profile {
  name: string
  colorSchema: ColorSchema | null
  platforms: Affiliate[] | null
  number: number
  widget: string | null
  container: string | null
  divider: number | null
}

export interface ColorSchema {
  colors: {
    [key: string]: string
  }
  fonts: {
    [key: string]: string
  }
}

export interface Affiliate {
  slug: string
  affiliateUrl: string
}
