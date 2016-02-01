/* eslint-env node, mocha */
const expect = require('chai').expect
const reqMock = require('../mocks/requester.mock.js')

const module = require('../../src/endpoints/pvp.js')

describe('endpoints > pvp', () => {
  let endpoint
  beforeEach(() => {
    endpoint = new module(false)
    reqMock.reset()
    endpoint.requester = reqMock
  })

  it('test /v2/pvp/games', async () => {
    endpoint = endpoint.games()
    endpoint.requester = reqMock

    expect(endpoint.isBulk).to.equal(true)
    expect(endpoint.isAuthenticated).to.equal(true)
    expect(endpoint.url).to.equal('/v2/pvp/games')

    reqMock.addResponse(['uuid1', 'uuid2'])
    let content = await endpoint.ids()
    expect(content).to.deep.equal(['uuid1', 'uuid2'])
  })

  it('test /v2/pvp/stats', async () => {
    endpoint = endpoint.stats()
    endpoint.requester = reqMock

    expect(endpoint.isAuthenticated).to.equal(true)
    expect(endpoint.url).to.equal('/v2/pvp/stats')

    reqMock.addResponse({pvp_rank: 80})
    let content = await endpoint.get()
    expect(content.pvp_rank).to.equal(80)
  })
})
