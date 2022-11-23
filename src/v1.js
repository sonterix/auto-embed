class MoneymadeAutoWidget {
  container = ''

  slug = 'horizontalDiscovery'

  dividerIndex = 2

  /**
   * @param {string} selector Container selector
   * @param {string} widget Slug of the widget that needs to be rendered
   * @param {number} divider Controls position
   */
  constructor(selector, widget, divider) {
    if (selector) {
      this.container = selector
    }

    if (widget) {
      this.slug = widget
    }

    if (divider) {
      this.dividerIndex = divider
    }
  }

  init() {
    const wrapper = document.querySelector(this.container)

    if (wrapper) {
      const position = wrapper.clientHeight / this.dividerIndex
      const wrapperElements = wrapper.children

      let heightCounter = 0
      let index = 0
      let triggerElement = null

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
        div.setAttribute('data-embed-widget', this.slug)
        div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
        div.setAttribute('data-utm-source', 'REPLACE_WITH_SOURCE')
        div.setAttribute(
          'data-utm-campaign',
          this.slug
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
}

/**
 * @param {string} selector Container selector
 * @param {string} widgetSlug Slug of the widget that needs to be rendered
 * @param {number} devider Controls position
 */
window.mmautoinit = (selector, widgetSlug, devider) => {
  const autoWidget = new MoneymadeAutoWidget(selector, widgetSlug, devider)
  autoWidget.init()
}
