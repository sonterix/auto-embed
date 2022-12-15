import { DomainInfo, Profile } from './types'

declare global {
  interface Window {
    mmautoinit: () => void
  }
}

class MoneymadeAutoWidget {
  private profile: Profile

  public constructor() {
    this.fetchProfile().then(async ({ data, error }) => {
      if (error) {
        throw new Error(error.message)
      }

      // Get permission to render a widget
      const permission = await this.fetchPermission(data?.container || null)
      // Render a widget
      if (permission.data) {
        this.renderWidget(data?.container || null, data?.widget || null, data?.divider || null)
      }

      // Enable URL tracking
      this.trackURLChanges()
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
      // Save profile for the future
      if (profile) {
        this.profile = profile
      }

      return {
        data: profile,
        error: profile === null ? new Error(`${profileName}${profileNumber} profile is not found`) : null
      }
    } catch (error) {
      return { data: null, error: error }
    }
  }

  private async fetchPermission(container: string | null): Promise<{ data: boolean; error: Error | null }> {
    const containerElement = container ? document.querySelector(container) : null

    if (!containerElement) {
      return { data: false, error: new Error('container is not found') }
    }

    const url = 'https://context-dot-moneyman-ssr.uc.r.appspot.com/api/v1'
    const hashesPathname = '/hashes'
    const contextPathname = '/context'
    // Get only content text from container
    const containerContent = MoneymadeAutoWidget.stripHTML(containerElement?.innerHTML)

    try {
      // Get context hash
      const responseContext = await fetch(`${url}${hashesPathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: containerContent })
      })
      const dataContext: { hash: string } = await responseContext.json()

      // Get permission based on the hash
      if (dataContext?.hash) {
        const responseHashes = await fetch(`${url}${hashesPathname}${contextPathname}?hash=${dataContext.hash}`)
        const dataHashes: { inContext: boolean } = await responseHashes.json()

        return { data: dataHashes?.inContext || false, error: null }
      }

      return { data: false, error: new Error('hash not found') }
    } catch (error) {
      return { data: false, error }
    }
  }

  private renderWidget(container: string | null, widget: string | null, divider: number | null): void {
    if (!container) {
      throw new Error('Container is not found')
    }

    const wrapper = document.querySelector(container)

    if (wrapper) {
      const position = wrapper.clientHeight / (divider || 2)
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
        div.setAttribute('data-embed-widget', widget || 'horizontalDiscovery')
        div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
        div.setAttribute('data-utm-source', 'REPLACE_WITH_SOURCE')
        div.setAttribute(
          'data-utm-campaign',
          (widget || 'horizontalDiscovery')
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

  private trackURLChanges(): void {
    // Track page URL
    let previousUrl = ''
    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(async () => {
      if (location.href !== previousUrl) {
        previousUrl = location.href

        // Get permission to render a widget
        const permission = await this.fetchPermission(this.profile.container || null)
        // Render a widget
        if (permission.data) {
          this.renderWidget(this.profile.container || null, this.profile.widget || null, this.profile.divider || null)
        }
      }
    })

    const config = {
      attributes: false,
      childList: true,
      subtree: true,
      characterData: false
    }

    // Start observing the document for configured mutations
    observer.observe(document, config)
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
    return doc.body.textContent?.replace(/\n/g, '') || ''
  }
}

window.mmautoinit = (): void => {
  new MoneymadeAutoWidget()
}

// Call init when the DOM is ready
document.addEventListener('DOMContentLoaded', (): void => {
  window.mmautoinit()
})
