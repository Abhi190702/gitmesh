import { Config } from '@gitmesh/archetype-standard'
import { ServiceWorker, Options } from '@gitmesh/archetype-worker'

const config: Config = {
  envvars: [],
  temporal: {
    enabled: false,
  },
  redis: {
    enabled: false,
  },
}

const options: Options = {
  postgres: {
    enabled: false,
  },
}

const svc = new ServiceWorker(config, options)

setImmediate(async () => {
  await svc.init()
  await svc.start()
})
