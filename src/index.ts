import { zValidator } from '@hono/zod-validator'
import { Hono, type Context } from 'hono'
import z from 'zod'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello there!')
})

type v0Bindings = {
  Bindings: CloudflareBindings
}

const v0 = new Hono<v0Bindings>()

const CACHE_TIME = {
  kv: 3600,
  fetch: 300,
  response: 300,
}

function getCachedKV(c: Context<v0Bindings>, key: string) {
  return c.env.KV.get(key, { cacheTtl: CACHE_TIME.kv })
}

v0.get(
  '/docs/:key',
  zValidator(
    'param',
    z.object({
      key: z.string().min(1, 'Key must be at least 1 character long'),
    })
  ),
  async (c) => {
    const { key } = c.req.param()

    const url = await getCachedKV(c, `docs:${key}`)

    if (!url) {
      return c.notFound()
    }

    const txtUrl = new URL(url)

    txtUrl.pathname = txtUrl.pathname.replace('/edit', '/export')
    txtUrl.hash = ''
    txtUrl.searchParams.append('format', 'txt')

    const response = await fetch(txtUrl.toString(), {
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_TIME.fetch,
      },
    })

    return c.text(await response.text(), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TIME.response}, must-revalidate`,
      },
    })
  }
)

v0.get(
  '/sheets/:key',
  zValidator(
    'param',
    z.object({
      key: z.string().min(1, 'Key must be at least 1 character long'),
    })
  ),
  async (c) => {
    const { key } = c.req.param()

    const url = await c.env.KV.get(`sheets:${key}`)

    if (!url) {
      return c.notFound()
    }

    const csvUrl = new URL(url)

    csvUrl.pathname = csvUrl.pathname.replace('/edit', '/gviz/tq')
    csvUrl.hash = ''
    csvUrl.searchParams.append('tqx', 'out:csv')

    const response = await fetch(csvUrl.toString(), {
      cf: {
        cacheEverything: true,
        cacheTtl: CACHE_TIME.fetch,
      },
    })

    return c.text(await response.text(), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': `public, max-age=${CACHE_TIME.response}, must-revalidate`,
      },
    })
  }
)

app.route('/v0', v0)

export default app
