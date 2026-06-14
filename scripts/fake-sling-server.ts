// scripts/fake-sling-server.ts

import * as http from 'http'

const PORT = 3001

const server = http.createServer((req, res) => {
  // Only accept POST /run
  if (req.method !== 'POST' || req.url !== '/run') {
    res.writeHead(404, {
      'Content-Type': 'application/json'
    })

    res.end(
      JSON.stringify({
        error: 'Not found'
      })
    )

    return
  }

  let body = ''

  // Receive chunks
  req.on('data', chunk => {
    body += chunk.toString()
  })

  // Finished receiving request
  req.on('end', () => {
    try {
      const payload = JSON.parse(body)

      console.log('\n=== RECEIVED FROM PY-SLANG ===')
      console.dir(payload, { depth: null })

      // Example:
      // {
      //   code: '1 + 1',
      //   svml: ...
      // }

      // Return fake execution response
      res.writeHead(200, {
        'Content-Type': 'application/json'
      })

      res.end(
        JSON.stringify({
          status: 'finished',
          output: 'Fake Sling server received request'
        })
      )
    } catch (err) {
      res.writeHead(400, {
        'Content-Type': 'application/json'
      })

      res.end(
        JSON.stringify({
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
        })
      )
    }
  })
})

server.listen(PORT, () => {
  console.log(
    `Fake Sling server listening at http://localhost:${PORT}/run`
  )
})
