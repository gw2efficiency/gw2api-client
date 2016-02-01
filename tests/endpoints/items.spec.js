/* eslint-env node, mocha */
const expect = require('chai').expect
const reqMock = require('../mocks/requester.mock.js')

const module = require('../../src/endpoints/items.js')

describe('endpoints > items', () => {
  let endpoint
  beforeEach(() => {
    endpoint = new module(false)
    reqMock.reset()
    endpoint.requester = reqMock
  })

  it('test /v2/items', async () => {
    expect(endpoint.isBulk).to.equal(true)
    expect(endpoint.isLocalized).to.equal(true)
    expect(endpoint.url).to.equal('/v2/items')

    reqMock.addResponse([1, 2, 3, 4])
    let content = await endpoint.ids()
    expect(content).to.deep.equal([1, 2, 3, 4])
  })
})
