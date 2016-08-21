const AbstractEndpoint = require('../endpoint.js')

class ItemstatsEndpoint extends AbstractEndpoint {
  constructor (client) {
    super(client)
    this.url = '/v2/itemstats'
    this.isPaginated = true
    this.isBulk = true
    this.isLocalized = true
  }
}

module.exports = ItemstatsEndpoint