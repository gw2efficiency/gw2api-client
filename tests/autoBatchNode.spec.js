/* eslint-env jest */
const Client = require('../src/client')
const AutoBatchNode = require('../src/autoBatchNode')


describe('autoBatchNode', () => {
  let client
  let autoBatchNode
  beforeEach(() => {
    client = new Client()
    autoBatchNode = new AutoBatchNode(client, client)
  })

  it(`calls the method of the wrapped client or endpoint`, () => {
    let parentCalled = false
    client.schema = () => {parentCalled = true}
    autoBatchNode.schema()
    expect(parentCalled).toEqual(true)
  })


  it(`method returns client (with changed setting)`, () => {
    const resultNode = autoBatchNode.schema('new setting')
    expect(resultNode === autoBatchNode).toEqual(true)
    expect(autoBatchNode.parent.schemaVersion).toEqual('new setting')
  })

  describe(`method returns a new endpoint`, () => {
    let itemsNode
    beforeEach(() => {
      itemsNode = autoBatchNode.items()
    })

    it(`is a new instance of AutoBatchNode`,() => {
      expect(itemsNode).toBeInstanceOf(AutoBatchNode)
      expect(itemsNode === autoBatchNode).toEqual(false)
    })

    it(`all method calls sync settings from client, and force caching`, () => {
      client.schema('a')
        .language('b')
        .authenticate('c')
        .debugging('d')
  
      itemsNode.live()
      itemsNode.debugMessage('syncs settings with client TEST')
      expect(itemsNode.parent.schemaVersion).toEqual('a')
      expect(itemsNode.parent.lang).toEqual('b')
      expect(itemsNode.parent.apiKey).toEqual('c')
      expect(itemsNode.parent.debug).toEqual('d')
      expect(itemsNode.parent._skipCache).toEqual(false)
    })

    it(`saves child endpoints for later calls`, () => {
      let charNode1 = autoBatchNode.characters('1')
      let charNode2 = autoBatchNode.characters('2')

      expect(charNode1 === charNode2).toEqual(false)
      expect(autoBatchNode.characters('1') === charNode1).toEqual(true)
      expect(autoBatchNode.characters('2') === charNode2).toEqual(true)
      expect(autoBatchNode.items() === itemsNode).toEqual(true)
      expect(Object.keys(autoBatchNode.children).length).toEqual(3)
    })

    it(`turns on autoBatching for new endpoint`, () => {
      expect(itemsNode.parent._autoBatch).not.toBeNull()
    })

  })

})