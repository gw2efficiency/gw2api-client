import fetch from 'lets-fetch'
import flow from 'promise-control-flow'
import debugging from 'debug'
import nullCache from './cache/null'
import * as endpoints from './endpoints'
const debug = debugging('gw2api-client')

export default class Client {
  constructor () {
    this.lang = 'en'
    this.apiKey = false
    this.fetch = fetch
    this.caches = [nullCache()]
    this.headersObject = {}
  }

  // Set the language for locale-aware endpoints
  language (lang) {
    this.lang = lang
    debug(`set the language to ${lang}`)
    return this
  }

  // Set the api key for authenticated endpoints
  authenticate (apiKey) {
    this.apiKey = apiKey
    debug(`set the api key to ${apiKey}`)
    return this
  }

  // Set the caching storage method(s)
  cacheStorage (caches) {
    this.caches = [].concat(caches)
    debug(`updated the cache storage`)
    return this
  }

  // Set the headers for all requests
  headers (headers) {
    this.headersObject = headers
    debug(`updated the headers`)
    return this
  }

  // Make sure we get the new content if the game updates
  flushCacheIfGameUpdated () {
    const buildEndpoint = this.build()
    const promises = {
      cacheBuildId: () => buildEndpoint._cacheGetSingle('cacheBuildId'),
      buildId: () => buildEndpoint.live().get()
    }

    return flow.parallel(promises).then(resp => {
      let flushPromises = []

      // Flush the caches if the cached build id is set (as a safety measure)
      // and the cached build id is older than the current one
      if (resp.cacheBuildId && resp.cacheBuildId < resp.buildId) {
        debug(`flushing the cache because of a new build`)
        flushPromises = this.caches.map(cache => () => cache.flush())
      }

      // Flush the caches (if needed) and save the current build id
      return flow.parallel(flushPromises)
        .then(() => buildEndpoint._cacheSetSingle('cacheBuildId', resp.buildId))
    })
  }

  // All the different API endpoints
  account () {
    return new endpoints.AccountEndpoint(this)
  }

  achievements () {
    return new endpoints.AchievementsEndpoint(this)
  }

  backstory () {
    return new endpoints.BackstoryEndpoint(this)
  }

  build () {
    return new endpoints.BuildEndpoint(this)
  }

  characters (name) {
    return new endpoints.CharactersEndpoint(this, name)
  }

  colors () {
    return new endpoints.ColorsEndpoint(this)
  }

  commerce () {
    return new endpoints.CommerceEndpoint(this)
  }

  continents () {
    return new endpoints.ContinentsEndpoint(this)
  }

  currencies () {
    return new endpoints.CurrenciesEndpoint(this)
  }

  dungeons () {
    return new endpoints.DungeonsEndpoint(this)
  }

  emblem () {
    return new endpoints.EmblemEndpoint(this)
  }

  events () {
    return new endpoints.EventsEndpoint(this)
  }

  files () {
    return new endpoints.FilesEndpoint(this)
  }

  finishers () {
    return new endpoints.FinishersEndpoint(this)
  }

  gliders () {
    return new endpoints.GlidersEndpoint(this)
  }

  guild (id) {
    return new endpoints.GuildEndpoint(this, id)
  }

  items () {
    return new endpoints.ItemsEndpoint(this)
  }

  itemstats () {
    return new endpoints.ItemstatsEndpoint(this)
  }

  legends () {
    return new endpoints.LegendsEndpoint(this)
  }

  maps () {
    return new endpoints.MapsEndpoint(this)
  }

  masteries () {
    return new endpoints.MasteriesEndpoint(this)
  }

  materials () {
    return new endpoints.MaterialsEndpoint(this)
  }

  minis () {
    return new endpoints.MinisEndpoint(this)
  }

  outfits () {
    return new endpoints.OutfitsEndpoint(this)
  }

  pets () {
    return new endpoints.PetsEndpoint(this)
  }

  professions () {
    return new endpoints.ProfessionsEndpoint(this)
  }

  pvp () {
    return new endpoints.PvpEndpoint(this)
  }

  quaggans () {
    return new endpoints.QuaggansEndpoint(this)
  }

  races () {
    return new endpoints.RacesEndpoint(this)
  }

  raids () {
    return new endpoints.RaidsEndpoint(this)
  }

  recipes () {
    return new endpoints.RecipesEndpoint(this)
  }

  skills () {
    return new endpoints.SkillsEndpoint(this)
  }

  skins () {
    return new endpoints.SkinsEndpoint(this)
  }

  specializations () {
    return new endpoints.SpecializationsEndpoint(this)
  }

  stories () {
    return new endpoints.StoriesEndpoint(this)
  }

  titles () {
    return new endpoints.TitlesEndpoint(this)
  }

  tokeninfo () {
    return new endpoints.TokeninfoEndpoint(this)
  }

  traits () {
    return new endpoints.TraitsEndpoint(this)
  }

  worlds () {
    return new endpoints.WorldsEndpoint(this)
  }

  wvw () {
    return new endpoints.WvwEndpoint(this)
  }
}
