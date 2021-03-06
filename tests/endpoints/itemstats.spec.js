/* eslint-env jest */
const { mockClient, fetchMock } = require('../mocks/client.mock')
const Module = require('../../src/endpoints/itemstats')

describe('endpoints > itemstats', () => {
  let endpoint
  beforeEach(() => {
    endpoint = new Module(mockClient)
    fetchMock.reset()
  })

  it('test /v2/itemstats', async () => {
    expect(endpoint.isPaginated).toEqual(true)
    expect(endpoint.isBulk).toEqual(true)
    expect(endpoint.supportsBulkAll).toEqual(true)
    expect(endpoint.isLocalized).toEqual(true)
    expect(endpoint.isAuthenticated).toEqual(false)
    expect(endpoint.cacheTime).not.toEqual(undefined)
    expect(endpoint.url).toEqual('/v2/itemstats')

    fetchMock.addResponse({ id: 1, name: 'Healing' })
    let content = await endpoint.get(1)
    expect(content.name).toEqual('Healing')
  })
})
