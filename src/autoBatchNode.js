
const Endpoint = require('./endpoint')
const _ = require('lodash')

// This helper function returns all method names including those inherited from extending classes
function getClassMethodNames(klass) {
  const isFunction = (x, name) => typeof x[name] === 'function';
  const deepFunctions = x =>
      x !== Object.prototype &&
      Object.getOwnPropertyNames(x)
          .filter(name =>  isFunction(x, name))
          .concat(deepFunctions(Object.getPrototypeOf(x)) || []);
  const distinctDeepFunctions = klass => Array.from(new Set(deepFunctions(klass)));
  return distinctDeepFunctions(klass).filter(name => name !== 'constructor' && !name.startsWith('__'))
}

module.exports = class AutoBatchNode {
  constructor(parent, client) {
    this.parent = parent
    this.client = client
    this.children = {}
    
    getClassMethodNames(parent).forEach((key) => {
      this[key] = (...args) => {
        // Enforce settings from the Client
        this._syncSettingsFromClient()

        // Return endpoint node from the child pool, if available
        const child = this._getChildNode(key, args)
        if (child) {
          return child
        }

        // Call the parent's method
        const result = parent[key](...args)

        // If the method returns parent, return this
        if (result === this.parent) {
          return this
        } 
        // If method returns a new Endpoint, add it to the child pool and return it
        else if (result instanceof Endpoint) {
          return this._newChildNode(key, args, result)
        }
        // Otherwise, return the result of the method
        else {
          return result
        }
      }
    })
  }

  _syncSettingsFromClient() {
    // If this is the client, don't need to change settings
    if (this.parent === this.client) {
      return 
    }
    // Copy the settings from client to this endpoint
    this.parent
      .schema(this.client.schemaVersion)
      .language(this.client.lang)
      .authenticate(this.client.apiKey)
      .debugging(this.client.debug)
    // Autobatching endpoints should always use cache
    this.parent._skipCache = false

    return this
  }

  _newChildNode(endpointName, args, endpoint) {
    endpoint.enableAutoBatch()

    const childNode = new AutoBatchNode(endpoint, this.client)
    const nameList = [endpointName, ...args]
    const childName = nameList.join('_')
    this.children[childName] = childNode
    return childNode
  }

  _getChildNode(endpointName, args) {
    const nameList = [endpointName, ...args]
    const childName = nameList.join('_')
    return this.children[childName]   
  }

}