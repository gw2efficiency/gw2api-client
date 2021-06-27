/* eslint-env jest */
const nullCache = require('../src/cache/null')
const memoryCache = require('../src/cache/memory')
const AutoBatchNode = require('../src/autoBatchNode')
const Module = require('../src/client')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// async function expectError (callback) {
//   let err
//   try {
//     await callback()
//   } catch (e) {
//     err = e
//   }

//   expect(err).toBeInstanceOf(Error)
// }

describe('client', () => {
  let client
  beforeEach(() => {
    client = new Module()
  })

  it('can set a schema', () => {
    let api = client.schema('latest')
    expect(client.schemaVersion).toEqual('latest')
    expect(api).toBeInstanceOf(Module)

    let endpoint = client.account().schema('latest')
    expect(endpoint.schemaVersion).toEqual('latest')
    expect(client.schema('2019-01-01').schemaVersion).toEqual('2019-01-01')
    expect(endpoint.schemaVersion).toEqual('latest')
  })

  it('can set a language', () => {
    let api = client.language('de')
    expect(client.lang).toEqual('de')
    expect(api).toBeInstanceOf(Module)

    let endpoint = client.account().language('fr')
    expect(endpoint.lang).toEqual('fr')
    expect(client.language('es').lang).toEqual('es')
    expect(endpoint.lang).toEqual('fr')
  })

  it('can set an api key', () => {
    let api = client.authenticate('key')
    expect(client.apiKey).toEqual('key')
    expect(api).toBeInstanceOf(Module)

    let endpoint = client.account().authenticate('key-two')
    expect(endpoint.apiKey).toEqual('key-two')
    expect(client.authenticate('key-three').apiKey).toEqual('key-three')
    expect(endpoint.apiKey).toEqual('key-two')
  })

  it('can set a cache handler', () => {
    let cacheHandler = { set: () => false, get: () => false }
    let api = client.cacheStorage(cacheHandler)
    expect(client.caches).toEqual([cacheHandler])
    expect(api).toBeInstanceOf(Module)

    client.cacheStorage([cacheHandler, cacheHandler])
    expect(client.caches).toEqual([cacheHandler, cacheHandler])
  })

  describe('debugging', () => {
    it('doesnt print anything if debugging is disabled', () => {
      const logMock = jest.fn()
      global.console = { log: logMock }

      client.debugging(false)
      client.debugMessage('Test message')

      expect(logMock.mock.calls).toEqual([])
    })

    it('prints a debug message if debugging is enabled', () => {
      const logMock = jest.fn()
      global.console = { log: logMock }

      client.debugging(true)
      client.debugMessage('Test message')

      expect(logMock.mock.calls).toEqual([[`[gw2api-client] Test message`]])
    })
  })

  it('can flush the caches if there is a game update', async () => {
    const tmp = client.build
    client.caches = [nullCache(), memoryCache(), memoryCache()]

    // Mock the build endpoint
    let savedBuildId = null
    let buildMock = {
      live: () => ({ get: () => Promise.resolve(123) }),
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
    expect(await client.caches[1].get('foo')).toEqual('bar')
    expect(await client.caches[2].get('herp')).toEqual('derp')
    expect(savedBuildId).toEqual(123)
    await wait(50)

    // Cached and live is the same, expect the caches to still be there
    buildMock._cacheGetSingle = (key) => Promise.resolve(456)
    buildMock.live = () => ({ get: () => Promise.resolve(456) })
    await client.flushCacheIfGameUpdated()
    expect(await client.caches[1].get('foo')).toEqual('bar')
    expect(await client.caches[2].get('herp')).toEqual('derp')
    expect(savedBuildId).toEqual(456)
    await wait(50)

    // Live is newer, expect the caches to be flushed
    buildMock.live = () => ({ get: () => Promise.resolve(789) })
    await client.flushCacheIfGameUpdated()
    expect(await client.caches[1].get('foo')).toEqual(null)
    expect(await client.caches[2].get('herp')).toEqual(null)
    expect(savedBuildId).toEqual(789)
    await wait(50)

    client.build = tmp
  })

  describe('autobatch', () => {

    it(`can get the autoBatchNode wrapped Client`, () => {
      expect(client.autoBatch()).toBeInstanceOf(AutoBatchNode)
      expect(client.autoBatch()).toBeInstanceOf(AutoBatchNode)
      expect(client.autoBatch().parent).toBeInstanceOf(Module)
      expect(client.autoBatch().parent === client).toEqual(true)
    })

    it('can get an autobatching endpoint', () => {
      let endpoint = client.autoBatch().items().parent
      expect(endpoint.url).toEqual('/v2/items')
      expect(endpoint._autoBatch).not.toBeNull()
    })
  })

  it('can get the account endpoint', () => {
    let endpoint = client.account()
    expect(endpoint.url).toEqual('/v2/account')
  })

  it('can get the achievements endpoint', () => {
    let endpoint = client.achievements()
    expect(endpoint.url).toEqual('/v2/achievements')
  })

  it('can get the backstory endpoint', () => {
    let endpoint = client.backstory()
    expect(endpoint.answers).not.toEqual(undefined)
  })

  it('can get the build endpoint', () => {
    let endpoint = client.build()
    expect(endpoint.url).toEqual('/v2/build')
  })

  it('can get the cats endpoint', () => {
    let endpoint = client.cats()
    expect(endpoint.url).toEqual('/v2/cats')
  })

  it('can get the characters endpoint', () => {
    let endpoint = client.characters()
    expect(endpoint.url).toEqual('/v2/characters')
  })

  it('can get the characters endpoint with a name', () => {
    let endpoint = client.characters('Derp')
    expect(endpoint.url).toEqual('/v2/characters')
    expect(endpoint.name).toEqual('Derp')
  })

  it('can get the colors endpoint', () => {
    let endpoint = client.colors()
    expect(endpoint.url).toEqual('/v2/colors')
  })

  it('can get the commerce endpoint', () => {
    let endpoint = client.commerce()
    expect(endpoint.exchange).not.toEqual(undefined)
  })

  it('can get the continents endpoint', () => {
    let endpoint = client.continents()
    expect(endpoint.url).toEqual('/v2/continents')
  })

  it('can get the currencies endpoint', () => {
    let endpoint = client.currencies()
    expect(endpoint.url).toEqual('/v2/currencies')
  })

  it('can get the dailycrafting endpoint', () => {
    let endpoint = client.dailycrafting()
    expect(endpoint.url).toEqual('/v2/dailycrafting')
  })

  it('can get the dungeons endpoint', () => {
    let endpoint = client.dungeons()
    expect(endpoint.url).toEqual('/v2/dungeons')
  })

  it('can get the emblem endpoint', () => {
    let endpoint = client.emblem()
    expect(endpoint.backgrounds).not.toEqual(undefined)
  })

  it('can get the events endpoint', () => {
    let endpoint = client.events()
    expect(endpoint.url).toEqual('/v1/event_details.json')
  })

  it('can get the files endpoint', () => {
    let endpoint = client.files()
    expect(endpoint.url).toEqual('/v2/files')
  })

  it('can get the finishers endpoint', () => {
    let endpoint = client.finishers()
    expect(endpoint.url).toEqual('/v2/finishers')
  })

  it('can get the gliders endpoint', () => {
    let endpoint = client.gliders()
    expect(endpoint.url).toEqual('/v2/gliders')
  })

  it('can get the guild endpoint', () => {
    let endpoint = client.guild()
    expect(endpoint.url).toEqual('/v2/guild')
  })

  it('can get the guild endpoint with an id', () => {
    let endpoint = client.guild('UUID')
    expect(endpoint.url).toEqual('/v2/guild')
    expect(endpoint.id).toEqual('UUID')
  })

  it('can get the home endpoint', () => {
    let endpoint = client.home()
    expect(endpoint.cats).not.toEqual(undefined)
  })

  it('can get the items endpoint', () => {
    let endpoint = client.items()
    expect(endpoint.url).toEqual('/v2/items')
  })

  it('can get the itemstats endpoint', () => {
    let endpoint = client.itemstats()
    expect(endpoint.url).toEqual('/v2/itemstats')
  })

  it('can get the legends endpoint', () => {
    let endpoint = client.legends()
    expect(endpoint.url).toEqual('/v2/legends')
  })

  it('can get the mailcarriers endpoint', () => {
    let endpoint = client.mailcarriers()
    expect(endpoint.url).toEqual('/v2/mailcarriers')
  })

  it('can get the mapchests endpoint', () => {
    let endpoint = client.mapchests()
    expect(endpoint.url).toEqual('/v2/mapchests')
  })

  it('can get the maps endpoint', () => {
    let endpoint = client.maps()
    expect(endpoint.url).toEqual('/v2/maps')
  })

  it('can get the masteries endpoint', () => {
    let endpoint = client.masteries()
    expect(endpoint.url).toEqual('/v2/masteries')
  })

  it('can get the materials endpoint', () => {
    let endpoint = client.materials()
    expect(endpoint.url).toEqual('/v2/materials')
  })

  it('can get the minis endpoint', () => {
    let endpoint = client.minis()
    expect(endpoint.url).toEqual('/v2/minis')
  })

  it('can get the mounts endpoint', () => {
    let endpoint = client.mounts()
    expect(endpoint.types().url).toEqual('/v2/mounts/types')
    expect(endpoint.skins().url).toEqual('/v2/mounts/skins')
  })

  it('can get the nodes endpoint', () => {
    let endpoint = client.nodes()
    expect(endpoint.url).toEqual('/v2/nodes')
  })

  it('can get the novelties endpoint', () => {
    let endpoint = client.novelties()
    expect(endpoint.url).toEqual('/v2/novelties')
  })

  it('can get the outfits endpoint', () => {
    let endpoint = client.outfits()
    expect(endpoint.url).toEqual('/v2/outfits')
  })

  it('can get the pets endpoint', () => {
    let endpoint = client.pets()
    expect(endpoint.url).toEqual('/v2/pets')
  })

  it('can get the professions endpoint', () => {
    let endpoint = client.professions()
    expect(endpoint.url).toEqual('/v2/professions')
  })

  it('can get the pvp endpoint', () => {
    let endpoint = client.pvp()
    expect(endpoint.games).not.toEqual(undefined)
  })

  it('can get the quaggans endpoint', () => {
    let endpoint = client.quaggans()
    expect(endpoint.url).toEqual('/v2/quaggans')
  })

  it('can get the quests endpoint', () => {
    let endpoint = client.quests()
    expect(endpoint.url).toEqual('/v2/quests')
  })

  it('can get the races endpoint', () => {
    let endpoint = client.races()
    expect(endpoint.url).toEqual('/v2/races')
  })

  it('can get the raids endpoint', () => {
    let endpoint = client.raids()
    expect(endpoint.url).toEqual('/v2/raids')
  })

  it('can get the recipes endpoint', () => {
    let endpoint = client.recipes()
    expect(endpoint.url).toEqual('/v2/recipes')
  })

  it('can get the skills endpoint', () => {
    let endpoint = client.skills()
    expect(endpoint.url).toEqual('/v2/skills')
  })

  it('can get the skins endpoint', () => {
    let endpoint = client.skins()
    expect(endpoint.url).toEqual('/v2/skins')
  })

  it('can get the specializations endpoint', () => {
    let endpoint = client.specializations()
    expect(endpoint.url).toEqual('/v2/specializations')
  })

  it('can get the stories endpoint', () => {
    let endpoint = client.stories()
    expect(endpoint.url).toEqual('/v2/stories')
  })

  it('can get the titles endpoint', () => {
    let endpoint = client.titles()
    expect(endpoint.url).toEqual('/v2/titles')
  })

  it('can get the tokeninfo endpoint', () => {
    let endpoint = client.tokeninfo()
    expect(endpoint.url).toEqual('/v2/tokeninfo')
  })

  it('can get the traits endpoint', () => {
    let endpoint = client.traits()
    expect(endpoint.url).toEqual('/v2/traits')
  })

  it('can get the worldbosses endpoint', () => {
    let endpoint = client.worldbosses()
    expect(endpoint.url).toEqual('/v2/worldbosses')
  })

  it('can get the worlds endpoint', () => {
    let endpoint = client.worlds()
    expect(endpoint.url).toEqual('/v2/worlds')
  })

  it('can get the wvw endpoint', () => {
    let endpoint = client.wvw()
    expect(endpoint.matches).not.toEqual(undefined)
  })
})
