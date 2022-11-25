class MoneymadeAutoWidget {
  container

  widget

  divider

  /**
   * @param {Object} props container, widget, divider
   */
  constructor(props) {
    this.container = props?.container || null
    this.widget = props?.widget || 'horizontalDiscovery'
    this.divider = props?.divider || 2
  }

  init() {
    if (!this.container) {
      throw new Error('Container is not found')
    }

    const wrapper = document.querySelector(this.container)

    if (wrapper) {
      const position = wrapper.clientHeight / this.divider
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
        div.setAttribute('data-embed-widget', this.widget)
        div.setAttribute('data-utm-medium', 'REPLACE_WITH_PAGE_SLUG')
        div.setAttribute('data-utm-source', 'REPLACE_WITH_SOURCE')
        div.setAttribute(
          'data-utm-campaign',
          this.widget
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
 * @param {Object} props container, widget, divider
 */
window.mmautoinit = props => {
  const autoWidget = new MoneymadeAutoWidget(props)
  autoWidget.init()
}
