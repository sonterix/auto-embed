import { DomainInfo, Profile } from './types'

declare global {
  interface Window {
    mmautoinit: () => void
  }
}

export class MoneymadeAutoWidget {
  public constructor() {
    this.fetchProfile().then(async ({ data, error }) => {
      if (error) {
        throw new Error(error.message)
      }
      // Get permission to render a widget
      const permission = await this.fetchPermission(data?.container || null)
      // Render a widget
      if (permission) {
        this.renderWidget(data?.container || null, data?.widget || 'horizontalDiscovery', data?.divider || 2)
      }
    })
  }

  private async fetchProfile(): Promise<{ data: Profile | null; error: Error | null }> {
    // Get GET params from URL
    const params = MoneymadeAutoWidget.parseSearch(window.location.search)
    // Get profile data
    const profileName = window.location.host.replace('www.', '').replace(/[\W_]+/g, '')
    const profileNumber = params.profile ? Number((params.profile as string).match(/[0-9]+$/)) || 1 : 1

    const url = 'https://api.widgets-data.moneymade.io/api/v1'
    const pathname = `/domains/${profileName}`

    try {
      const response = await fetch(`${url}${pathname}`)
      const data: DomainInfo = await response.json()
      // Get certain profile
      const profile = data?.profiles?.find(({ number }) => number === profileNumber) || null

      return {
        data: profile,
        error: profile === null ? new Error(`${profileName}${profileNumber} profile is not found`) : null
      }
    } catch (error) {
      return { data: null, error: null }
    }
  }

  private async fetchPermission(container: string | null): Promise<{ data: boolean; error: Error | null }> {
    const containerElement = container ? document.querySelector(container) : null

    if (!containerElement) {
      return { data: false, error: new Error('container is not found') }
    }

    const url = 'https://context-dot-moneyman-ssr.uc.r.appspot.com/v1'
    const contextPathname = '/context'
    const hashesPathname = '/hashes'
    // Get only content text from container
    const containerContent = MoneymadeAutoWidget.stripHTML(containerElement?.innerHTML)

    try {
      // Get context hash
      const responseContext = await fetch(`${url}${contextPathname}`, {
        method: 'POST',
        body: JSON.stringify({ hash: containerContent })
      })
      const dataContext = await responseContext.json()
      // Get permission based on the hash
      const responseHashes = await fetch(`${url}${hashesPathname}?hash=${dataContext}`)
      const dataHashes = await responseHashes.json()

      return { data: dataHashes, error: null }
    } catch (error) {
      return { data: false, error }
    }
  }

  private renderWidget(container: string | null, widget: string, divider: number): void {
    if (!container) {
      throw new Error('Container is not found')
    }

    const wrapper = document.querySelector(container)

    if (wrapper) {
      const position = wrapper.clientHeight / divider
      const wrapperElements = wrapper.children

      let heightCounter = 0
      let index = 0
      let triggerElement: Element | null = null

      while (position > heightCounter && wrapperElements[index]) {
        heightCounter += wrapperElements[index].clientHeight
        triggerElement = wrapperElements[index]
        index++
      }

      // Create widget element and append it
      if (triggerElement) {
        const div = document.createElement('div')
        div.classList.add('money-made-embed')
        div.style.display = 'block'
        div.setAttribute('data-width', '100%')
        div.setAttribute('data-height', '0')
        div.setAttribute('data-embed-widget', this.widget)
        div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
        div.setAttribute('data-utm-source', 'REPLACE_WITH_SOURCE')
        div.setAttribute(
          'data-utm-campaign',
          widget
            .split('-')
            .map((word, indx) => (indx !== 0 ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
            .join('')
        )
        triggerElement.before(div)
      }
    } else {
      throw new Error('Container is not found')
    }
  }

  private static parseSearch = (query: string): { [key: string]: string | string[] } => {
    if (!Object.keys(query).length) {
      return {}
    }

    const queryFormated = query.split('&').reduce<{ [key: string]: string | string[] }>((acc, value, index) => {
      const splitValue = value.split('=')

      // Decode values
      let key = decodeURI(splitValue[0] || 'unknown')
      const val = decodeURI(splitValue[1] || 'null')

      // Remove ? at the start of the query
      if (key.charAt(0) === '?' && index === 0) {
        key = key.slice(1)
      }
      // Convert to array if more than 1 value for the same key
      if (typeof acc[key] === 'string') {
        return { ...acc, [key]: [acc[key] as string, val] }
      }
      // If key value is array
      if (Array.isArray(acc[key])) {
        return { ...acc, [key]: [...((acc[key] as string[]) || []), val] }
      }

      return { ...acc, [key]: val }
    }, {})

    return queryFormated
  }

  private static stripHTML(html: string): string {
    let doc = new DOMParser().parseFromString(html, 'text/html')
    return doc.body.textContent || ''
  }
}

window.mmautoinit = (): void => {
  new MoneymadeAutoWidget()
}
