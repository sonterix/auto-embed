import { DomainInfo, FetchResponse, Hashes, Profile } from './types'

/* Done:
  - /hashes/context query
  - check for existing widget
  - check for parent width
  - canonical and og:url
**/

// anchors: [] - новые якоря для саммари
// Iframe widget based on new API

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
    // Generate hash
    const md5Hashe = MoneymadeAutoWidget.generateMD5(containerContent)

    // Attempt to get existing hase
    try {
      const url = `https://context-dot-moneyman-ssr.uc.r.appspot.com/api/v1/hashes/context?hash=${md5Hashe}`
      const responseContext = await fetch(url)
      const dataContext: Hashes = await responseContext.json()

      if (!dataContext?.error) {
        return { data: dataContext, error: null }
      }

      throw new Error('Content is not hashed')
    } catch (error) {
      console.error(error)
    }

    // Generate new hashe
    try {
      // Get page url form head tags for API request
      const pageUrlElement =
        document.querySelector('[rel="canonical"]') || document.querySelector('[property="og:url"]')
      const pageUrl = pageUrlElement
        ? pageUrlElement.getAttribute('href') || pageUrlElement.getAttribute('content')
        : null

      const url = 'https://context-dot-moneyman-ssr.uc.r.appspot.com/api/v1/hashes'
      const responseContext = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: containerContent, url: pageUrl })
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
    // Classes need for xpath search
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

      // Check if the parent already contains the widget and if parent more than 300 px width
      const parentWithWidget = elementAfter.parentElement?.querySelector('[data-widget="text-widget"]')
      const parentWidth = elementAfter.offsetWidth || 0

      if (!parentWithWidget && parentWidth >= 300) {
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
  }

  private trackURLChanges(): void {
    // Track page URL
    let previousUrl = ''
    // Create an observer instance linked to the callback
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

  private static generateMD5(string: string): string {
    const rotateLeft = (lValue, iShiftBits) => {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits))
    }

    const addUnsigned = (lX, lY) => {
      let lX4
      let lY4
      let lX8
      let lY8
      let lResult

      lX8 = lX & 0x80000000
      lY8 = lY & 0x80000000
      lX4 = lX & 0x40000000
      lY4 = lY & 0x40000000
      lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff)

      if (lX4 & lY4) {
        return lResult ^ 0x80000000 ^ lX8 ^ lY8
      }

      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return lResult ^ 0xc0000000 ^ lX8 ^ lY8
        } else {
          return lResult ^ 0x40000000 ^ lX8 ^ lY8
        }
      } else {
        return lResult ^ lX8 ^ lY8
      }
    }

    const F = (x, y, z) => {
      return (x & y) | (~x & z)
    }

    const G = (x, y, z) => {
      return (x & z) | (y & ~z)
    }

    const H = (x, y, z) => {
      return x ^ y ^ z
    }

    const I = (x, y, z) => {
      return y ^ (x | ~z)
    }

    const FF = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }

    const GG = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }

    const HH = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }

    const II = (a, b, c, d, x, s, ac) => {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac))
      return addUnsigned(rotateLeft(a, s), b)
    }

    const convertToWordArray = string => {
      let lWordCount
      const lMessageLength = string.length
      const lNumberOfWords_temp1 = lMessageLength + 8
      const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64
      const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16
      const lWordArray = Array(lNumberOfWords - 1)
      let lBytePosition = 0
      let lByteCount = 0

      while (lByteCount < lMessageLength) {
        lWordCount = (lByteCount - (lByteCount % 4)) / 4
        lBytePosition = (lByteCount % 4) * 8
        lWordArray[lWordCount] = lWordArray[lWordCount] | (string.charCodeAt(lByteCount) << lBytePosition)
        lByteCount++
      }

      lWordCount = (lByteCount - (lByteCount % 4)) / 4
      lBytePosition = (lByteCount % 4) * 8
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition)
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29

      return lWordArray
    }

    const wordToHex = lValue => {
      let WordToHexValue = ''
      let WordToHexValue_temp = ''
      let lByte
      let lCount

      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255
        WordToHexValue_temp = '0' + lByte.toString(16)
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2)
      }

      return WordToHexValue
    }

    const utf8Encode = string => {
      string = string.replace(/\r\n/g, '\n')

      let utftext = ''

      for (let n = 0; n < string.length; n++) {
        const c = string.charCodeAt(n)

        if (c < 128) {
          utftext += String.fromCharCode(c)
        } else if (c > 127 && c < 2048) {
          utftext += String.fromCharCode((c >> 6) | 192)
          utftext += String.fromCharCode((c & 63) | 128)
        } else {
          utftext += String.fromCharCode((c >> 12) | 224)
          utftext += String.fromCharCode(((c >> 6) & 63) | 128)
          utftext += String.fromCharCode((c & 63) | 128)
        }
      }

      return utftext
    }

    let x = Array()
    let k
    let AA
    let BB
    let CC
    let DD
    let a
    let b
    let c
    let d

    const S11 = 7,
      S12 = 12,
      S13 = 17,
      S14 = 22

    const S21 = 5,
      S22 = 9,
      S23 = 14,
      S24 = 20

    const S31 = 4,
      S32 = 11,
      S33 = 16,
      S34 = 23

    const S41 = 6,
      S42 = 10,
      S43 = 15,
      S44 = 21

    string = utf8Encode(string)
    x = convertToWordArray(string)

    a = 0x67452301
    b = 0xefcdab89
    c = 0x98badcfe
    d = 0x10325476

    for (k = 0; k < x.length; k += 16) {
      AA = a
      BB = b
      CC = c
      DD = d

      a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478)
      d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756)
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070db)
      b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee)
      a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf)
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a)
      c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613)
      b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501)
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8)
      d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af)
      c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1)
      b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be)
      a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122)
      d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193)
      c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e)
      b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821)
      a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562)
      d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340)
      c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51)
      b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa)
      a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d)
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453)
      c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681)
      b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8)
      a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6)
      d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6)
      c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87)
      b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed)
      a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905)
      d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8)
      c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9)
      b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a)
      a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942)
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681)
      c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122)
      b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c)
      a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44)
      d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9)
      c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60)
      b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70)
      a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6)
      d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa)
      c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085)
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05)
      a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039)
      d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5)
      c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8)
      b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665)
      a = II(a, b, c, d, x[k + 0], S41, 0xf4292244)
      d = II(d, a, b, c, x[k + 7], S42, 0x432aff97)
      c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7)
      b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039)
      a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3)
      d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92)
      c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d)
      b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1)
      a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f)
      d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0)
      c = II(c, d, a, b, x[k + 6], S43, 0xa3014314)
      b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1)
      a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82)
      d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235)
      c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb)
      b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391)

      a = addUnsigned(a, AA)
      b = addUnsigned(b, BB)
      c = addUnsigned(c, CC)
      d = addUnsigned(d, DD)
    }

    const temp = wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)

    return temp.toLowerCase()
  }
}

window.mmautoinit = (): void => {
  new MoneymadeAutoWidget()
}

// Call init when the DOM is ready
window.addEventListener('load', (): void => {
  window.mmautoinit()
})
