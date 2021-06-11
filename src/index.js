/* global __coverage__ */

import assert from 'node:assert'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import playwright from 'playwright'
import trim from 'lodash.trim'
import execa from 'execa'
import retry from 'p-retry'
import debounce from 'lodash.debounce'
import tempy from 'tempy'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

function defaultParser ({ target, logger }) {
  logger.log(`Target: ${target}\n`)
  return function (args) {
    logger.log(...args)
  }
}

class Runner {
  constructor (fastClose = false) {
    this._closed = false
    this._exitError = null

    if (!fastClose) {
      this._done = debounce(this._done.bind(this), 1000)
    }

    this._promise = {}

    this._promise.wait = new Promise((resolve, reject) => {
      this._promise.resolve = resolve
      this._promise.reject = reject
    })
  }

  get closed () {
    return this._closed
  }

  done (err) {
    if (this._closed) return
    if (err && !this._exitError) {
      if (err === 1) {
        err = new Error('runner error')
        err.hidden = true
      }
      if (typeof err === 'string') {
        err = new Error(err)
      }
      this._exitError = err
    }
    this._done()
  }

  wait () {
    return this._promise.wait
  }

  _done () {
    if (this._closed) return
    this._closed = true
    this._exitError ? this._promise.reject(this._exitError) : this._promise.resolve()
  }
}

export class Brout {
  constructor (opts = {}) {
    const {
      url = 'http://127.0.0.1:8080',
      target = 'chromium',
      devtools = false,
      command,
      parser = defaultParser,
      fastClose = false,
      retries = 5,
      timeout = 0,
      coverage = false,
      logger = {
        log: (...args) => console.log(...args),
        error: (...args) => console.error(...args),
        warn: (...args) => console.warn(...args)
      },
      stdout = process.stdout,
      stderr = process.stderr
    } = opts

    assert(url, 'url is required')
    assert(target, 'target is required')

    this._url = url
    this._target = target
    this._devtools = devtools
    this._command = command
    this._fastClose = fastClose
    this._retries = retries
    this._timeout = timeout
    this._coverage = coverage === true ? path.join(process.cwd(), '.nyc_output', 'coverage.json') : coverage
    this._parser = parser
    this._logger = logger
    this._stdout = stdout
    this._stderr = stderr
    this._releases = []
    this._subprocess = null
    this._running = false
    this._tmpdir = null
  }

  async run () {
    if (this._running) return

    const targets = this._target.split(',').map(target => trim(target, ' \n\t'))
    this._before()
    this._running = true
    return Promise.race([
      this._timeout > 0 && delay(this._timeout * targets.length),
      this._subprocess,
      this._run(targets)
    ].filter(Boolean)).finally(() => {
      this._running = false
      return this._after()
    })
  }

  async _run (targets) {
    for (const target of targets) {
      if (!this._running) return
      await this._runBrowser(target)
    }

    if (this._coverage) {
      await execa.command(`nyc merge ${this._tmpdir} ${this._coverage}`, {
        preferLocal: true
      })
    }
  }

  async _runBrowser (target) {
    const browser = await playwright[target].launch({ devtools: this._devtools })
    this._releases.push(() => browser.close())

    const runner = new Runner(this._fastClose)

    const parse = this._parser({
      target,
      exit: signal => runner.done(signal),
      logger: this._logger,
      stdout: this._stdout,
      stdeer: this._stderr
    })

    const context = await browser.newContext()
    const page = await context.newPage()
    this._releases.push(() => page.close())

    await page.exposeFunction('__BROUT_CONSOLE_LOG__', (...args) => this._logger.log(...args))
    await page.exposeFunction('__BROUT_CONSOLE_ERROR__', (...args) => this._logger.error(...args))
    await page.exposeFunction('__BROUT_CONSOLE_WARN__', (...args) => this._logger.warn(...args))
    await page.exposeFunction('__BROUT_STDOUT__', text => this._stdout.write(text))
    await page.exposeFunction('__BROUT_STDERR__', text => this._stderr.write(text))
    await page.exposeFunction('__BROUT_EXIT__', signal => runner.done(signal))

    await page.addInitScript({
      content: `
        globalThis.$brout = {
          console: {
            log: globalThis.__BROUT_CONSOLE_LOG__,
            error: globalThis.__BROUT_CONSOLE_ERROR__,
            warn: globalThis.__BROUT_CONSOLE_WARN__
          },
          stdout: globalThis.__BROUT_STDOUT__,
          stderr: globalThis.__BROUT_STDERR__,
          exit: globalThis.__BROUT_EXIT__
        }
      `
    })

    page.on('console', async msg => {
      const args = await Promise.all(msg.args().map(arg => arg.jsonValue()))
      if (runner.closed) return
      parse(args)
    })

    page.on('pageerror', (err) => runner.done(err))

    retry(async () => {
      await delay(1000)
      return page.goto(this._url, { timeout: this._timeout })
    }, {
      retries: this._retries,
      onFailedAttempt: error => {
        if (error.retriesLeft === 0) throw error
      }
    }).catch(err => runner.done(err))

    try {
      await runner.wait()
      if (!this._coverage) return
      await this._runCoverage(target, page)
    } finally {
      await page.close()
      await browser.close()
    }
  }

  _before () {
    if (this._command) {
      this._subprocess = execa.command(this._command, {
        preferLocal: true
      })
      this._subprocess.stderr.pipe(process.stderr)

      this._releases.push(() => this._subprocess.cancel())
    }
  }

  _after () {
    return Promise.all(this._releases.map(release => release()))
  }

  async _runCoverage (target, page) {
    if (!this._tmpdir) {
      this._tmpdir = tempy.directory()
      if (!this._tmpdir) throw new Error('create tmpdir failed')
      await fs.mkdir(this._tmpdir, { recursive: true })
    }

    const result = await page.evaluate(() => JSON.stringify(typeof __coverage__ !== 'undefined' && __coverage__))
    if (!result) return

    await fs.writeFile(path.join(this._tmpdir, `${target}.json`), JSON.stringify(JSON.parse(result), null, 2), 'utf8')
  }
}
