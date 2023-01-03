import { DomainInfo, FetchResponse, Hashes, Profile } from './types'

declare global {
  interface Window {
    mmautoinit: () => void
  }
}

class MoneymadeAutoWidget {
  private name: string
  private profile: Profile

  public constructor() {
    this.fetchProfile().then(async ({ data, error }) => {
      if (error) {
        throw new Error(error.message)
      }

      // Get permission to render a widget
      const hashes = await this.fentchHashes(data?.container || null)
      // If permission to render a widget
      if (hashes.data?.inContext) {
        this.renderWidget(data?.container || '', data?.widget || undefined, data?.divider || undefined)
      }
      // Add summary if was received
      if (hashes.data?.summary) {
        this.renderSummary(hashes.data.summary, data?.container || '')
      }

      // Enable URL tracking
      this.trackURLChanges()
    })
  }

  private async fetchProfile(): Promise<FetchResponse<Profile>> {
    // Get GET params from URL
    const params = MoneymadeAutoWidget.parseSearch(window.location.search)
    // Get profile data
    const profileName = window.location.host.replace('www.', '').replace(/[\W_]+/g, '')
    const profileNumber = params.profile ? Number((params.profile as string).match(/[0-9]+$/)) || 1 : 1

    try {
      const url = `https://api.widgets-data.moneymade.io/api/v1/domains/${profileName}`
      const response = await fetch(url)
      const data: DomainInfo = await response.json()
      // Get certain profile
      const profile = data?.profiles?.find(({ number }) => number === profileNumber) || null
      // Save profile for the future
      if (profile) {
        this.name = data.name
        this.profile = profile

        return { data: profile, error: null }
      }

      throw new Error(`${profileName}${profileNumber} profile is not found`)
    } catch (error) {
      return { data: null, error: error }
    }
  }

  private async fentchHashes(container: string | null): Promise<FetchResponse<Hashes>> {
    const containerElement = container ? document.querySelector(container) : null

    if (!containerElement) {
      return { data: null, error: new Error('container is not found') }
    }

    // Get only content text from cotainer
    const containerContent = MoneymadeAutoWidget.stripHTML(containerElement?.innerHTML)

    try {
      const url = 'https://context-dot-moneyman-ssr.uc.r.appspot.com/api/v1/hashes'
      const responseContext = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: containerContent })
      })
      const dataContext: Hashes = await responseContext.json()

      if (dataContext?.hash) {
        return { data: dataContext, error: null }
      }

      throw new Error('Hash not found')
    } catch (error) {
      return { data: null, error }
    }
  }

  private renderWidget(container: string, widget: string = 'horizontalDiscovery', divider: number = 2): void {
    if (!container) {
      throw new Error('Container is not found')
    }

    const wrapper = document.querySelector(container)
    const existingWidget = wrapper?.querySelector('.money-made-auto-embed') || null

    if (wrapper && !existingWidget) {
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
        div.classList.add('money-made-auto-embed')
        div.style.display = 'block'
        div.setAttribute('data-width', '100%')
        div.setAttribute('data-height', '0')
        div.setAttribute('data-embed-widget', widget)
        div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
        div.setAttribute('data-utm-source', this.name || 'REPLACE_WITH_SOURCE')
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

  private renderSummary(summary: string[], container: string): void {
    const containerClasses = document.querySelector(container)?.classList.value || ''
    const summaryContainer = document.querySelector<HTMLElement>('.mm-summary')

    if (!summaryContainer) {
      throw new Error('Summary container is not found')
    }

    // Remove native summary
    summaryContainer.nextSibling?.remove()

    // Create list of summary
    const ul = document.createElement('ul')
    const lis = summary.map(text => {
      const li = document.createElement('li')
      // Detects $1.2 | 12 | $123 || 10% | $109,000 | $1.00 | 321,123 | 123.321
      const [textAnchor] = text.match(/(\$|)[0-9]+((\%|\.|\,|)([A-Za-z]+|[0-9]+|\%)|)/g) || []

      if (textAnchor && containerClasses) {
        // Generage ID for anchor
        const id = `mm-id-${Math.floor((1 + Math.random()) * 0x10000).toString(16)}`
        // Elements storage
        let node: Node | null = null
        const elements: Node[] = []

        try {
          // Select elements by text in container
          const xPath = `//*[contains(@class, '${containerClasses}')]//*[contains(text(), '${textAnchor}')]`
          const searchResult = document.evaluate(xPath, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null)
          // Collect searched elements in variable
          while ((node = searchResult.iterateNext())) {
            elements.push(node)
          }
        } catch (error) {
          console.error(error)
        }

        if (elements[0]) {
          // Add text widget to closest H tag
          this.renderTextWidget(elements[0].parentElement)

          // Add ID to the element
          ;(elements[0] as HTMLElement).id = id
          const a = document.createElement('a')

          a.innerText = text
          a.href = `#${id}`

          li.appendChild(a)
          return li
        }
      }

      li.innerText = text
      return li
    })
    // Add li elements to ul
    lis.forEach(li => {
      ul.appendChild(li)
    })
    // Clear container and add ul
    summaryContainer.style.display = 'block'
    summaryContainer.innerHTML = ''
    summaryContainer.appendChild(ul)
  }

  private renderTextWidget(elementAfter: HTMLElement | null): void {
    if (elementAfter) {
      // Chenck and not render the widget in tables or lists
      const updatedElementAfter =
        elementAfter.closest('table') || elementAfter.closest('ul') || elementAfter.closest('ol')

      if (updatedElementAfter) {
        elementAfter = updatedElementAfter
      }

      const div = document.createElement('div')
      div.style.display = 'block'
      div.style.margin = '20px auto'
      div.classList.add('money-made-embed')
      div.setAttribute('data-name', 'Text Widget')
      div.setAttribute('data-width', '100%')
      div.setAttribute('data-height', '0')
      div.setAttribute('data-embed-widget', 'text-widget')
      div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
      div.setAttribute('data-utm-source', this.name || 'REPLACE_WITH_SOURCE')
      div.setAttribute('data-utm-campaign', 'textWidget')

      elementAfter.after(div)
    }
  }

  private trackURLChanges(): void {
    // Track page URL
    let previousUrl = ''
    // Create an observer instance linked to the callback function
    const observer = new MutationObserver(() => {
      const currentUrl = window.location.origin + window.location.pathname

      if (previousUrl === '') {
        // Will fire on init
        previousUrl = currentUrl
      } else if (currentUrl !== previousUrl) {
        previousUrl = currentUrl
        // Protector from lazyload page loading
        setTimeout(async () => {
          // Get permission to render a widget
          const hashes = await this.fentchHashes(this.profile.container || null)
          // If permission to render a widget
          if (hashes.data?.inContext) {
            this.renderWidget(
              this.profile.container || '',
              this.profile.widget || undefined,
              this.profile.divider || undefined
            )
          }
          // Add summary if was received
          if (hashes.data?.summary) {
            this.renderSummary(hashes.data.summary, this.profile.container || '')
          }
        }, 200)
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
    return doc.body.textContent || ''
  }
}

window.mmautoinit = (): void => {
  new MoneymadeAutoWidget()
}

// Call init when the DOM is ready
window.addEventListener('load', (): void => {
  window.mmautoinit()
})
