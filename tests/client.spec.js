/* eslint-env node, mocha */
import { expect } from 'chai'
import nullCache from '../src/cache/null'
import memoryCache from '../src/cache/memory'
import Module from '../src/client'
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('client', () => {
  let client
  beforeEach(() => {
    client = new Module()
  })

  it('can set a language', () => {
    let api = client.language('de')
    expect(client.lang).to.equal('de')
    expect(api).to.be.an.instanceof(Module)

    let endpoint = client.account().language('fr')
    expect(endpoint.lang).to.equal('fr')
    expect(client.language('es').lang).to.equal('es')
    expect(endpoint.lang).to.equal('fr')
  })

  it('can set an api key', () => {
    let api = client.authenticate('key')
    expect(client.apiKey).to.equal('key')
    expect(api).to.be.an.instanceof(Module)

    let endpoint = client.account().authenticate('key-two')
    expect(endpoint.apiKey).to.equal('key-two')
    expect(client.authenticate('key-three').apiKey).to.equal('key-three')
    expect(endpoint.apiKey).to.equal('key-two')
  })

  it('can set a cache handler', () => {
    let cacheHandler = {set: () => false, get: () => false}
    let api = client.cacheStorage(cacheHandler)
    expect(client.caches).to.deep.equal([cacheHandler])
    expect(api).to.be.an.instanceof(Module)

    client.cacheStorage([cacheHandler, cacheHandler])
    expect(client.caches).to.deep.equal([cacheHandler, cacheHandler])
  })

  it('can set a header object', () => {
    let api = client.headers({'X-Herp': 'Derp'})
    expect(client.headersObject).to.deep.equal({'X-Herp': 'Derp'})
    expect(api).to.be.an.instanceof(Module)
  })

  it('can flush the caches if there is a game update', async () => {
    const tmp = client.build
    client.caches = [nullCache(), memoryCache(), memoryCache()]

    // Mock the build endpoint
    let savedBuildId = null
    let buildMock = {
      live: () => ({get: () => Promise.resolve(123)}),
      _cacheGetSingle: (key) => Promise.resolve(null),
      _cacheSetSingle: (key, value) => {
        savedBuildId = value
        Promise.resolve(null)
      }
    }
    client.build = () => buildMock

    // Add some random cache entries
    await client.caches[1].set('foo', 'bar', 60 * 60)
    await client.caches[2].set('herp', 'derp', 60 * 60)
    await wait(50)

    // Cached is not set, expect the caches to still be there
    await client.flushCacheIfGameUpdated()
    expect(await client.caches[1].get('foo')).to.equal('bar')
    expect(await client.caches[2].get('herp')).to.equal('derp')
    expect(savedBuildId).to.equal(123)
    await wait(50)

    // Cached and live is the same, expect the caches to still be there
    buildMock._cacheGetSingle = (key) => Promise.resolve(456)
    buildMock.live = () => ({get: () => Promise.resolve(456)})
    await client.flushCacheIfGameUpdated()
    expect(await client.caches[1].get('foo')).to.equal('bar')
    expect(await client.caches[2].get('herp')).to.equal('derp')
    expect(savedBuildId).to.equal(456)
    await wait(50)

    // Live is newer, expect the caches to be flushed
    buildMock.live = () => ({get: () => Promise.resolve(789)})
    await client.flushCacheIfGameUpdated()
    expect(await client.caches[1].get('foo')).to.equal(null)
    expect(await client.caches[2].get('herp')).to.equal(null)
    expect(savedBuildId).to.equal(789)
    await wait(50)

    client.build = tmp
  })

  it('can get the account endpoint', () => {
    let endpoint = client.account()
    expect(endpoint.url).to.equal('/v2/account')
  })

  it('can get the achievements endpoint', () => {
    let endpoint = client.achievements()
    expect(endpoint.url).to.equal('/v2/achievements')
  })

  it('can get the backstory endpoint', () => {
    let endpoint = client.backstory()
    expect(endpoint.answers).to.not.equal(undefined)
  })

  it('can get the build endpoint', () => {
    let endpoint = client.build()
    expect(endpoint.url).to.equal('/v2/build')
  })

  it('can get the characters endpoint', () => {
    let endpoint = client.characters()
    expect(endpoint.url).to.equal('/v2/characters')
  })

  it('can get the characters endpoint with a name', () => {
    let endpoint = client.characters('Derp')
    expect(endpoint.url).to.equal('/v2/characters')
    expect(endpoint.name).to.equal('Derp')
  })

  it('can get the colors endpoint', () => {
    let endpoint = client.colors()
    expect(endpoint.url).to.equal('/v2/colors')
  })

  it('can get the commerce endpoint', () => {
    let endpoint = client.commerce()
    expect(endpoint.exchange).to.not.equal(undefined)
  })

  it('can get the continents endpoint', () => {
    let endpoint = client.continents()
    expect(endpoint.url).to.equal('/v2/continents')
  })

  it('can get the currencies endpoint', () => {
    let endpoint = client.currencies()
    expect(endpoint.url).to.equal('/v2/currencies')
  })

  it('can get the dungeons endpoint', () => {
    let endpoint = client.dungeons()
    expect(endpoint.url).to.equal('/v2/dungeons')
  })

  it('can get the emblem endpoint', () => {
    let endpoint = client.emblem()
    expect(endpoint.backgrounds).to.not.equal(undefined)
  })

  it('can get the events endpoint', () => {
    let endpoint = client.events()
    expect(endpoint.url).to.equal('/v1/event_details.json')
  })

  it('can get the files endpoint', () => {
    let endpoint = client.files()
    expect(endpoint.url).to.equal('/v2/files')
  })

  it('can get the finishers endpoint', () => {
    let endpoint = client.finishers()
    expect(endpoint.url).to.equal('/v2/finishers')
  })

  it('can get the gliders endpoint', () => {
    let endpoint = client.gliders()
    expect(endpoint.url).to.equal('/v2/gliders')
  })

  it('can get the guild endpoint', () => {
    let endpoint = client.guild()
    expect(endpoint.url).to.equal('/v2/guild')
  })

  it('can get the guild endpoint with an id', () => {
    let endpoint = client.guild('UUID')
    expect(endpoint.url).to.equal('/v2/guild')
    expect(endpoint.id).to.equal('UUID')
  })

  it('can get the items endpoint', () => {
    let endpoint = client.items()
    expect(endpoint.url).to.equal('/v2/items')
  })

  it('can get the itemstats endpoint', () => {
    let endpoint = client.itemstats()
    expect(endpoint.url).to.equal('/v2/itemstats')
  })

  it('can get the legends endpoint', () => {
    let endpoint = client.legends()
    expect(endpoint.url).to.equal('/v2/legends')
  })

  it('can get the maps endpoint', () => {
    let endpoint = client.maps()
    expect(endpoint.url).to.equal('/v2/maps')
  })

  it('can get the masteries endpoint', () => {
    let endpoint = client.masteries()
    expect(endpoint.url).to.equal('/v2/masteries')
  })

  it('can get the materials endpoint', () => {
    let endpoint = client.materials()
    expect(endpoint.url).to.equal('/v2/materials')
  })

  it('can get the minis endpoint', () => {
    let endpoint = client.minis()
    expect(endpoint.url).to.equal('/v2/minis')
  })

  it('can get the outfits endpoint', () => {
    let endpoint = client.outfits()
    expect(endpoint.url).to.equal('/v2/outfits')
  })

  it('can get the pets endpoint', () => {
    let endpoint = client.pets()
    expect(endpoint.url).to.equal('/v2/pets')
  })

  it('can get the professions endpoint', () => {
    let endpoint = client.professions()
    expect(endpoint.url).to.equal('/v2/professions')
  })

  it('can get the pvp endpoint', () => {
    let endpoint = client.pvp()
    expect(endpoint.games).to.not.equal(undefined)
  })

  it('can get the quaggans endpoint', () => {
    let endpoint = client.quaggans()
    expect(endpoint.url).to.equal('/v2/quaggans')
  })

  it('can get the races endpoint', () => {
    let endpoint = client.races()
    expect(endpoint.url).to.equal('/v2/races')
  })

  it('can get the raids endpoint', () => {
    let endpoint = client.raids()
    expect(endpoint.url).to.equal('/v2/raids')
  })

  it('can get the recipes endpoint', () => {
    let endpoint = client.recipes()
    expect(endpoint.url).to.equal('/v2/recipes')
  })

  it('can get the skills endpoint', () => {
    let endpoint = client.skills()
    expect(endpoint.url).to.equal('/v2/skills')
  })

  it('can get the skins endpoint', () => {
    let endpoint = client.skins()
    expect(endpoint.url).to.equal('/v2/skins')
  })

  it('can get the specializations endpoint', () => {
    let endpoint = client.specializations()
    expect(endpoint.url).to.equal('/v2/specializations')
  })

  it('can get the stories endpoint', () => {
    let endpoint = client.stories()
    expect(endpoint.url).to.equal('/v2/stories')
  })

  it('can get the titles endpoint', () => {
    let endpoint = client.titles()
    expect(endpoint.url).to.equal('/v2/titles')
  })

  it('can get the tokeninfo endpoint', () => {
    let endpoint = client.tokeninfo()
    expect(endpoint.url).to.equal('/v2/tokeninfo')
  })

  it('can get the traits endpoint', () => {
    let endpoint = client.traits()
    expect(endpoint.url).to.equal('/v2/traits')
  })

  it('can get the worlds endpoint', () => {
    let endpoint = client.worlds()
    expect(endpoint.url).to.equal('/v2/worlds')
  })

  it('can get the wvw endpoint', () => {
    let endpoint = client.wvw()
    expect(endpoint.matches).to.not.equal(undefined)
  })
})
