/* eslint-env jest */
const { mockClient, fetchMock } = require('./mocks/client.mock')
const Module = require('../src/endpoint')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

Module.__set__('hashString', (x) => `hash[${x}]`)

async function expectError (callback) {
  let err
  try {
    await callback()
  } catch (e) {
    err = e
  }

  expect(err).toBeInstanceOf(Error)
}

describe('abstract endpoint', () => {
  let endpoint
  beforeEach(() => {
    endpoint = new Module(mockClient)
    fetchMock.reset()
    endpoint.caches.map(cache => cache.flush())
    endpoint.schema('schema')
  })

  it('sets up the initial values from the passed in client', () => {
    expect(endpoint.lang).toEqual('en')
    expect(endpoint.client).toBeDefined()
    expect(endpoint.schemaVersion).toEqual('schema')
  })

  describe('ids', () => {
    it('support', async () => {
      let content = [1, 2]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.ids()
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema')
      expect(entry).toEqual(content)
    })

    it('caching', async () => {
      let content = [1, 2]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.ids()
      await wait(50)
      let entryShouldCache = await endpoint.ids()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:ids')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
    })

    it('cant mutate cache data', async () => {
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse([1, 2])

      let entry = await endpoint.ids()
      entry[0] = 42
      await wait(50)
      let entryShouldCache = await endpoint.ids()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:ids')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual([42, 2])
      expect(entryShouldCache).toEqual([1, 2])
      expect(entryInCache).toEqual([1, 2])
    })

    it('live', async () => {
      let content = [1, 2]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponse(content)

      let entry = await endpoint.live().ids()
      let entryShouldBeLive = await endpoint.live().ids()
      await wait(50)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:ids')

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema',
        'https://api.guildwars2.com/v2/test?v=schema'
      ])
      expect(entry).toEqual(content)
      expect(entryShouldBeLive).toEqual(content)
      expect(entryInCache).toEqual(content)
    })

    it('only for bulk expanding', async () => {
      await expectError(() => endpoint.ids())
    })
  })

  describe('auto batching', () => {
    const batchDelay = 10
    beforeEach(() => {
      endpoint.isBulk = true
    })

    it('sets up _autoBatch variable', () => {
      let x = endpoint.enableAutoBatch(batchDelay)
      expect(x).toBeInstanceOf(Module)
      expect(x.autoBatchDelay).toEqual(batchDelay)
      expect(x._autoBatch.idsForNextBatch).toBeDefined()
      expect(x._autoBatch.nextBatchPromise).toBeNull()
    })

    it('has default batchDelay of 50', () => {
      let x = endpoint.enableAutoBatch()
      expect(x.autoBatchDelay).toEqual(50)
    })

    it('enableAutoBatch will overwrite autoBatchDelay variable', () => {
      endpoint.enableAutoBatch()
      endpoint.enableAutoBatch(batchDelay)
      expect(endpoint.autoBatchDelay).toEqual(batchDelay)
    })

    it(`enableAutoBatch will call debugMessage if endpoint is not bulk expanding`, () => {
      endpoint.isBulk = false
      const debugMessageMock = jest.fn()
      endpoint.debugMessage = debugMessageMock

      endpoint.enableAutoBatch()
      expect(debugMessageMock.mock.calls.length).toBe(1)
    })
    
    it('supports batching from get', async () => {
      let content = [{ id: 1, name: 'foo' }, { id: 2, name: 'bar' }]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.enableAutoBatch(batchDelay)
      fetchMock.addResponse(content)

      let [entry1, entry2] = await Promise.all([endpoint.get(1), endpoint.get(2)])
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=1,2')
      expect(entry1).toEqual(content[0])
      expect(entry2).toEqual(content[1])
    })

    it('returns null from get with no response', async () => {
      let content = []
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.enableAutoBatch(batchDelay)
      fetchMock.addResponse(content)

      let [entry1, entry2] = await Promise.all([endpoint.get(1), endpoint.get(2)])
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=1,2')
      expect(entry1).toEqual(null)
      expect(entry2).toEqual(null)
    })
    
    it('supports batching from many', async () => {
      let content = [{ id: 1, name: 'foo' }, { id: 2, name: 'bar' }, { id: 3, name: 'bar' }]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.enableAutoBatch(batchDelay)
      fetchMock.addResponse(content)

      let [entry1, entry2] = await Promise.all([endpoint.many([1,2]), endpoint.many([2,3])])
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3')
      expect(entry1).toEqual([content[0],content[1]])
      expect(entry2).toEqual([content[1],content[2]])
    })

    it('only batches requests during the batchDelay', async () => {
      let content1 = [{ id: 1, name: 'foo' }]
      let content2 = [{ id: 2, name: 'bar' }]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.enableAutoBatch(batchDelay)
      fetchMock.addResponse(content1)
      fetchMock.addResponse(content2)

      let [entry1, entry2] = await Promise.all([
        endpoint.get(1), 
        new Promise((resolve) => {setTimeout(() => {resolve(endpoint.get(2))}, batchDelay+1)})
      ])
      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&ids=1',
        'https://api.guildwars2.com/v2/test?v=schema&ids=2'
      ])
      expect(entry1).toEqual(content1[0])
      expect(entry2).toEqual(content2[0])

    })
  })

  describe('get', () => {
    it('support for bulk expanding', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.get(1)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&id=1')
      expect(entry).toEqual(content)
    })

    it('support for non bulk expanding', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.get()
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema')
      expect(entry).toEqual(content)
    })

    it('support for non bulk expanding with custom url', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.get('/bar?output_id=123&input_id=456', true)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test/bar?v=schema&output_id=123&input_id=456')
      expect(entry).toEqual(content)
    })

    it('caching for bulk expanding', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.get(1)
      await wait(50)
      let entryShouldCache = await endpoint.get(1)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&id=1')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
    })

    it('caching for non bulk expanding', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.get()
      await wait(50)
      let entryShouldCache = await endpoint.get()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]')
      let bulkEntryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(bulkEntryInCache).toEqual(null)
    })

    it('caching for non bulk expanding with custom url', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.get('/bar?output_id=123&input_id=456', true)
      await wait(50)
      let entryShouldCache = await endpoint.get('/bar?output_id=123&input_id=456', true)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:/bar?output_id=123&input_id=456')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test/bar?v=schema&output_id=123&input_id=456')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
    })

    it('cant mutate cache data', async () => {
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse({ id: 1, name: 'foo' })

      let entry = await endpoint.get(1)
      entry.name = 'NOT FOO'
      await wait(50)
      let entryShouldCache = await endpoint.get(1)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1')

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&id=1')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual({ id: 1, name: 'NOT FOO' })
      expect(entryShouldCache).toEqual({ id: 1, name: 'foo' })
      expect(entryInCache).toEqual({ id: 1, name: 'foo' })
    })

    it('live', async () => {
      let content = { id: 1, name: 'foo' }
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponse(content)

      let entry = await endpoint.live().get(1)
      let entryShouldBeLive = await endpoint.live().get(1)
      await wait(50)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1')

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&id=1',
        'https://api.guildwars2.com/v2/test?v=schema&id=1'
      ])
      expect(entry).toEqual(content)
      expect(entryShouldBeLive).toEqual(content)
      expect(entryInCache).toEqual(content)
    })

    it('requires an id for bulk expanding', async () => {
      endpoint.isBulk = true
      await expectError(() => endpoint.get())
    })
  })

  describe('many', () => {
    it('support', async () => {
      let content = [{ id: 2, name: 'bar' }, { id: 1, name: 'foo' }]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let ids = [2, 1, 1, 2, 2, 1, 1]
      let entry = await endpoint.many(ids)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=2,1')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(ids).toEqual([2, 1, 1, 2, 2, 1, 1])
    })

    it('uses the minimal amount of requests', async () => {
      endpoint.isBulk = true
      endpoint.maxPageSize = 3
      endpoint.url = '/v2/test'
      fetchMock.addResponse([1, 2, 3])
      fetchMock.addResponse([4, 5])

      let entry = await endpoint.many([1, 2, 3, 4, 5])
      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3',
        'https://api.guildwars2.com/v2/test?v=schema&ids=4,5'
      ])
      expect(entry).toEqual([1, 2, 3, 4, 5])
    })

    it('doesn\'t execute a request for 0 ids', async () => {
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse('nope.')

      let entry = await endpoint.many([])
      expect(fetchMock.urls().length).toEqual(0)
      expect(entry).toEqual([])
    })

    it('caching', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.many([1, 2, 3])
      await wait(50)
      let entryShouldCache = await endpoint.many([2, 3, 2])
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content.slice(1))
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('partial caching', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' },
        { id: 4, name: 'xd' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content.slice(1, 3))
      fetchMock.addResponse(content.slice(0, 1).concat(content.slice(3, 4)))

      let entry = await endpoint.many([2, 3])
      await wait(50)
      let entryShouldCache = await endpoint.many([1, 2, 3, 4])
      await wait(50)
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3',
        'hash[https://api.guildwars2.com/v2/test:schema]:4'
      ])

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&ids=2,3',
        'https://api.guildwars2.com/v2/test?v=schema&ids=1,4'
      ])
      expect(entry).toEqual(content.slice(1, 3))
      expect(entryShouldCache).toEqual(content)
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('cant mutate cache data', async () => {
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse([
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ])

      let entry = await endpoint.many([1, 2, 3])
      entry[1].name = 'NOT BAR'
      await wait(50)
      let entryShouldCache = await endpoint.many([2, 3, 2])
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual([
        { id: 1, name: 'foo' },
        { id: 2, name: 'NOT BAR' },
        { id: 3, name: 'fooo' }
      ])
      expect(entryShouldCache).toEqual([
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ])
      expect(bulkEntriesInCache).toEqual([
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ])
    })

    it('match the api behaviour for cached data if all not-cached data is invalid', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponseError({ status: 404 }, { text: 'all provided ids are invalid' })

      let entry = await endpoint.many([1, 2, 3])
      await wait(50)
      let entryShouldCache = await endpoint.many([2, 3, 2, 4])
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=4')
      expect(fetchMock.urls().length).toEqual(2)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content.slice(1))
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('live', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponse(content)

      let entry = await endpoint.live().many([1, 2, 3])
      let entryShouldBeLive = await endpoint.live().many([1, 2, 3])
      await wait(50)
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3',
        'https://api.guildwars2.com/v2/test?v=schema&ids=1,2,3'
      ])
      expect(entry).toEqual(content)
      expect(entryShouldBeLive).toEqual(content)
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('only available for bulk expanding', async () => {
      await expectError(() => endpoint.many([1, 2]))
    })
  })

  describe('page', () => {
    it('support', async () => {
      let content = [1, 2, 3]
      endpoint.isPaginated = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.page(0, 3)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3')
      expect(entry).toEqual(content)
    })

    it('caching for non bulk endpoints', async () => {
      let content = [1, 2, 3]
      endpoint.isPaginated = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.page(0, 3)
      await wait(50)
      let entryShouldCache = await endpoint.page(0, 3)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:page-0/3')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(bulkEntriesInCache.filter(x => x).length).toEqual(0)
    })

    it('caching for bulk endpoints', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isPaginated = true
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.page(0, 3)
      await wait(50)
      let entryShouldCache = await endpoint.page(0, 3)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:page-0/3')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('cant mutate cache data', async () => {
      endpoint.isPaginated = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse([1, 2, 3])

      let entry = await endpoint.page(0, 3)
      entry[0] = 42
      await wait(50)
      let entryShouldCache = await endpoint.page(0, 3)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:page-0/3')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual([42, 2, 3])
      expect(entryShouldCache).toEqual([1, 2, 3])
      expect(entryInCache).toEqual([1, 2, 3])
      expect(bulkEntriesInCache.filter(x => x).length).toEqual(0)
    })

    it('live', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isPaginated = true
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponse(content)

      let entry = await endpoint.live().page(0, 3)
      let entryShouldBeLive = await endpoint.live().page(0, 3)
      await wait(50)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:page-0/3')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3',
        'https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3'
      ])
      expect(entry).toEqual(content)
      expect(entryShouldBeLive).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(bulkEntriesInCache).toEqual(content)
    })

    it('throws an error for out of range size', async () => {
      endpoint.isBulk = true
      await expectError(() => endpoint.page(0, 1000))
    })

    it('throws an error for out of range pages', async () => {
      endpoint.isBulk = true
      await expectError(() => endpoint.page(-10))
    })

    it('only for bulk expanding and paginated', async () => {
      await expectError(() => endpoint.page(0))
    })
  })

  describe('all', () => {
    it('support for paginated', async () => {
      endpoint.isPaginated = true
      endpoint.maxPageSize = 3
      endpoint.url = '/v2/test'
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 8
        }
      })
      fetchMock.addResponse([4, 5, 6])
      fetchMock.addResponse([7, 8])

      let entry = await endpoint.all()
      expect(fetchMock.urls().length).toEqual(3)
      expect(fetchMock.urls()[1]).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=1&page_size=3')
      expect(entry).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('use the minimal amount of requests', async () => {
      endpoint.isPaginated = true
      endpoint.maxPageSize = 3
      endpoint.url = '/v2/test'
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 3
        }
      })

      let entry = await endpoint.all()
      expect(fetchMock.urls().length).toEqual(1)
      expect(fetchMock.urls()[0]).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=3')
      expect(entry).toEqual([1, 2, 3])
    })

    it('support for bulk expanding without bulk all', async () => {
      endpoint.isBulk = true
      endpoint.supportsBulkAll = false
      endpoint.maxPageSize = 3
      endpoint.url = '/v2/test'
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 8
        }
      })
      fetchMock.addResponse([4, 5, 6])
      fetchMock.addResponse([7, 8])

      let entry = await endpoint.all()
      expect(fetchMock.urls().length).toEqual(3)
      expect(fetchMock.urls()[1]).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=1&page_size=3')
      expect(entry).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('support for bulk expanding with bulk all', async () => {
      let content = [1, 2, 3]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      fetchMock.addResponse(content)

      let entry = await endpoint.all()
      expect(fetchMock.urls().length).toEqual(1)
      expect(fetchMock.urls()[0]).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=all')
      expect(entry).toEqual(content)
    })

    it('caching for non bulk endpoints', async () => {
      let content = [1, 2, 3]
      endpoint.isPaginated = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse({
        json: () => content,
        headers: {
          get: () => 3
        }
      })

      let entry = await endpoint.all()
      await wait(50)
      let entryShouldCache = await endpoint.all()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:all')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=200')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(bulkEntriesInCache.filter(x => x).length).toEqual(0)
    })

    it('caching for bulk endpoints', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)

      let entry = await endpoint.all()
      await wait(50)
      let entryShouldCache = await endpoint.all()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:all')
      let cacheEntries = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&ids=all')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual(content)
      expect(entryShouldCache).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(cacheEntries).toEqual(content)
    })

    it('cant mutate cache data', async () => {
      endpoint.isPaginated = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 3
        }
      })

      let entry = await endpoint.all()
      entry[0] = 42
      await wait(50)
      let entryShouldCache = await endpoint.all()
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:all')
      let bulkEntriesInCache = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&page=0&page_size=200')
      expect(fetchMock.urls().length).toEqual(1)
      expect(entry).toEqual([42, 2, 3])
      expect(entryShouldCache).toEqual([1, 2, 3])
      expect(entryInCache).toEqual([1, 2, 3])
      expect(bulkEntriesInCache.filter(x => x).length).toEqual(0)
    })

    it('live', async () => {
      let content = [
        { id: 1, name: 'foo' },
        { id: 2, name: 'bar' },
        { id: 3, name: 'fooo' }
      ]
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(content)
      fetchMock.addResponse(content)

      let entry = await endpoint.live().all()
      let entryShouldBeLive = await endpoint.live().all()
      await wait(50)
      let entryInCache = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:all')
      let cacheEntries = await endpoint._cacheGetMany([
        'hash[https://api.guildwars2.com/v2/test:schema]:1',
        'hash[https://api.guildwars2.com/v2/test:schema]:2',
        'hash[https://api.guildwars2.com/v2/test:schema]:3'
      ])

      expect(fetchMock.urls()).toEqual([
        'https://api.guildwars2.com/v2/test?v=schema&ids=all',
        'https://api.guildwars2.com/v2/test?v=schema&ids=all'
      ])
      expect(entry).toEqual(content)
      expect(entryShouldBeLive).toEqual(content)
      expect(entryInCache).toEqual(content)
      expect(cacheEntries).toEqual(content)
    })

    it('only for bulk expanding and paginated', async () => {
      await expectError(() => endpoint.all())
    })
  })

  describe('caching', () => {
    beforeEach(() => {
      endpoint.cacheTime = 60 * 60
    })

    it('includes the language into the caching key', async () => {
      let contentEn = { id: 1, name: 'Good Day' }
      let contentDe = { id: 1, name: 'Guten Tag' }
      endpoint.isLocalized = true
      endpoint.isBulk = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(contentEn)
      fetchMock.addResponse(contentDe)

      let entryEn = await endpoint.get(1)
      await wait(50)
      let entryShouldCacheEn = await endpoint.get(1)
      let entryInCacheEn = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1:en')

      let entryDe = await endpoint.language('de').get(1)
      await wait(50)
      let entryShouldCacheDe = await endpoint.language('de').get(1)
      let entryInCacheDe = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:1:de')

      expect(fetchMock.urls().length).toEqual(2)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&lang=de&id=1')
      expect(entryEn).toEqual(contentEn)
      expect(entryShouldCacheEn).toEqual(contentEn)
      expect(entryInCacheEn).toEqual(contentEn)
      expect(entryDe).toEqual(contentDe)
      expect(entryShouldCacheDe).toEqual(contentDe)
      expect(entryInCacheDe).toEqual(contentDe)
    })

    it('includes the autentication token into the caching key', async () => {
      let contentUserOne = { name: 'foo.1234' }
      let contentUserTwo = { name: 'bar.1234' }
      endpoint.isAuthenticated = true
      endpoint.url = '/v2/test'
      endpoint.cacheTime = 60
      fetchMock.addResponse(contentUserOne)
      fetchMock.addResponse(contentUserTwo)

      let entryUserOne = await endpoint.authenticate('key-user-one').get()
      await wait(50)
      let entryShouldCacheUserOne = await endpoint.authenticate('key-user-one').get()
      let entryInCacheUserOne = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:hash[key-user-one]')

      let entryUserTwo = await endpoint.authenticate('key-user-two').get()
      await wait(50)
      let entryShouldCacheUserTwo = await endpoint.authenticate('key-user-two').get()
      let entryInCacheUserTwo = await endpoint._cacheGetSingle('hash[https://api.guildwars2.com/v2/test:schema]:hash[key-user-two]')

      expect(fetchMock.urls().length).toEqual(2)
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&access_token=key-user-two')
      expect(entryUserOne).toEqual(contentUserOne)
      expect(entryShouldCacheUserOne).toEqual(contentUserOne)
      expect(entryInCacheUserOne).toEqual(contentUserOne)
      expect(entryUserTwo).toEqual(contentUserTwo)
      expect(entryShouldCacheUserTwo).toEqual(contentUserTwo)
      expect(entryInCacheUserTwo).toEqual(contentUserTwo)
    })

    it('single sets in all connected cache storages', async () => {
      endpoint._cacheSetSingle('foo', { bar: 1337 })
      await wait(50)

      expect(await endpoint.caches[1].get('foo')).toEqual({ bar: 1337 })
      expect(await endpoint.caches[2].get('foo')).toEqual({ bar: 1337 })
    })

    it('many sets in all connected cache storages', async () => {
      endpoint._cacheSetMany([['foo', { bar: 1337 }], ['herp', { derp: 42 }]])
      await wait(50)

      expect(await endpoint.caches[1].mget(['foo', 'herp'])).toEqual([{ bar: 1337 }, { derp: 42 }])
      expect(await endpoint.caches[2].mget(['foo', 'herp'])).toEqual([{ bar: 1337 }, { derp: 42 }])
    })

    it('single gets of the first possible connected cache storage', async () => {
      await endpoint.caches[1].set('herp', 'derp', 60)
      await endpoint.caches[2].set('herp', 'NOPE')
      await endpoint.caches[2].set('asd', { fgh: 42 }, 60)
      await wait(50)

      expect(await endpoint._cacheGetSingle('foo')).toEqual(null)
      expect(await endpoint._cacheGetSingle('herp')).toEqual('derp')
      expect(await endpoint._cacheGetSingle('asd')).toEqual({ fgh: 42 })
    })

    it('many gets of the first possible connected cache storage', async () => {
      await endpoint.caches[1].set('foo', 'bar', 60)
      await endpoint.caches[1].set('herp', 'derp', 60)
      await endpoint.caches[2].set('herp', 'NOPE')
      await endpoint.caches[2].set('asd', { fgh: 42 }, 60)
      await wait(50)

      expect(await endpoint._cacheGetMany(['x', 'foo', 'herp', 'y', 'asd', 'z']))
        .toEqual([null, 'bar', 'derp', null, { fgh: 42 }, null])
    })
  })

  describe('requests', () => {
    it('gives the type to the underlying api for single requests', async () => {
      endpoint.isLocalized = true
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 8
        }
      })

      let entry = await endpoint._request('/v2/test', 'response')
      expect(entry.json()).toEqual([1, 2, 3])
      expect(entry.headers.get()).toEqual(8)
    })

    it('gives the query parameters to the underlying api for single requests', async () => {
      endpoint.isLocalized = true
      endpoint.language('en')
      fetchMock.addResponse({ foo: 'bar' })

      let entry = await endpoint._request('/v2/test')
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&lang=en')
      expect(entry).toEqual({ foo: 'bar' })
    })

    it('gives the type to the underlying api for multiple requests', async () => {
      endpoint.isLocalized = true
      fetchMock.addResponse({
        json: () => [1, 2, 3],
        headers: {
          get: () => 8
        }
      })

      let entries = await endpoint._requestMany(['/v2/test'], 'response')
      expect(entries[0].json()).toEqual([1, 2, 3])
      expect(entries[0].headers.get()).toEqual(8)
    })

    it('gives the query parameters to the underlying api for multiple requests', async () => {
      endpoint.isLocalized = true
      endpoint.language('en')
      fetchMock.addResponse({ foo: 'bar' })

      let entry = await endpoint._requestMany(['/v2/test'])
      expect(fetchMock.lastUrl()).toEqual('https://api.guildwars2.com/v2/test?v=schema&lang=en')
      expect(entry).toEqual([{ foo: 'bar' }])
    })
  })

  describe('_buildUrl', () => {
    it('sets the language header for localized endpoints', () => {
      endpoint.isLocalized = true
      endpoint.language('de')
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema&lang=de')
    })

    it('doesn\'t set the language header for non localized endpoints', () => {
      endpoint.language('de')
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema')
    })

    it('sets the authorization header for authenticated endpoints', () => {
      endpoint.isAuthenticated = true
      endpoint.authenticate('key')
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema&access_token=key')
    })

    it('doesn\'t set the authorization header for non authenticated endpoints', () => {
      endpoint.authenticate('key')
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema')
    })

    it('sets the authorization header for optional authenticated endpoints', () => {
      endpoint.isAuthenticated = true
      endpoint.isOptionallyAuthenticated = true
      endpoint.authenticate('key')
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema&access_token=key')
    })

    it('doesn\'t set the authorization header for optional authenticated endpoints if the key is not set', () => {
      endpoint.isAuthenticated = true
      endpoint.isOptionallyAuthenticated = true
      let url = endpoint._buildUrl('/test')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema')
    })

    it('handles an already existing query', () => {
      endpoint.isAuthenticated = true
      endpoint.authenticate('key')
      endpoint.isLocalized = true
      endpoint.language('de')
      let url = endpoint._buildUrl('/test?page=0')
      expect(url).toEqual('https://api.guildwars2.com/test?v=schema&access_token=key&lang=de&page=0')
    })
  })

  describe('debugging', () => {
    it('doesnt print anything if debugging is disabled', () => {
      const logMock = jest.fn()
      global.console = { log: logMock }

      endpoint.debugging(false)
      endpoint.debugMessage('Test message')

      expect(logMock.mock.calls).toEqual([])
    })

    it('prints a debug message if debugging is enabled', () => {
      const logMock = jest.fn()
      global.console = { log: logMock }

      endpoint.debugging(true)
      endpoint.debugMessage('Test message')

      expect(logMock.mock.calls).toEqual([[`[gw2api-client] Test message`]])
    })
  })

  it('sets the schema', () => {
    let x = endpoint.schema('2019-04-26T00:00:00Z')
    expect(x.schemaVersion).toEqual('2019-04-26T00:00:00Z')
    expect(x).toBeInstanceOf(Module)
  })

  describe('_schemaIncludes', () => {
    it('returns "true" if the schema is set to "latest"', () => {
      endpoint.schema('latest')
      expect(endpoint._schemaIncludes('2019-01-02T00:00:00Z')).toEqual(true)
    })

    it('returns "true" if the schema is newer than required', () => {
      endpoint.schema('2019-01-02T00:00:00Z')
      expect(endpoint._schemaIncludes('2019-01-02T00:00:00Z')).toEqual(true)

      endpoint.schema('2019-01-03T00:00:00Z')
      expect(endpoint._schemaIncludes('2019-01-02T00:00:00Z')).toEqual(true)
    })

    it('returns "false" if the schema is too old', () => {
      endpoint.schema('2019-01-01T00:00:00Z')
      expect(endpoint._schemaIncludes('2019-01-02T00:00:00Z')).toEqual(false)
    })
  })

  it('sets the language', () => {
    let x = endpoint.language('de')
    expect(x.lang).toEqual('de')
    expect(x).toBeInstanceOf(Module)
  })

  it('sets the api key', () => {
    let x = endpoint.authenticate('key')
    expect(x.apiKey).toEqual('key')
    expect(x).toBeInstanceOf(Module)
  })
})
