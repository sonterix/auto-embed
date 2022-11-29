export interface Props {
  container: string
  widget: string
  divider: number
}

export interface DomainInfo {
  type: 'withAffiliateAd' | 'withMoneymadeAd' | 'withoutAd' | 'freemium'
  url: string
  name: string
  profiles: Profile[]
}

export interface Profile {
  name: string
  colorSchema: ColorSchema | null
  platforms: Affiliate[] | null
  number: number
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
