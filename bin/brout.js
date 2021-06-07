#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import sade from 'sade'

import { Brout } from '../src/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageJSON = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'))

process.on('unhandledRejection', function (err) {
  console.error('Unhandled rejection:', err.message)
})

const readLocalPackageJSON = async () => {
  try {
    return JSON.parse(await fs.promises.readFile(path.resolve(process.cwd(), 'package.json'), 'utf-8'))
  } catch (err) {
    return null
  }
}

sade('brout', true)
  .version(packageJSON.version)
  .describe('Run brout')
  .example("-u http://127.0.0.1:8080 -c 'webpack serve' --target chromium,firefox")
  .example("-c 'webpack serve' --parser '@geut/brout/uvu'")
  .example("-c 'webpack serve' --parser '@geut/brout/tap'")
  .example("-c 'webpack serve' --parser '@geut/brout/tap' --coverage")
  .option('-u, --url', 'URL to bind', 'http://127.0.0.1:8080')
  .option('-t, --target', 'Browser target', 'chromium')
  .option('-d, --devtools', 'Enable devtool', false)
  .option('-c, --command', 'Execute a command before start')
  .option('-p, --parser', 'Log parser')
  .option('-r, --retries', 'Retries', 5)
  .option('-T, --timeout', 'Timeout', 0)
  .option('-C, --coverage', 'Add support for istanbul coverage', false)
  .option('--fast-close', 'Fast close')
  .action(async (opts = {}) => {
    const packageJSON = await readLocalPackageJSON()
    let { command, parser } = opts

    if (command && packageJSON && packageJSON.scripts[command]) {
      command = `npm run ${command}`
    }

    if (parser) {
      parser = (await import(parser)).default
    }

    const brout = new Brout({
      url: opts.url,
      target: opts.target,
      devtools: opts.devtools,
      command,
      parser,
      fastClose: opts['fast-close'],
      retries: opts.retries,
      timeout: opts.timeout,
      coverage: opts.coverage
    })

    try {
      await brout.run()
    } catch (err) {
      if (!err.hidden) {
        console.error(err)
      }
      process.exit(1)
    }
  })
  .parse(process.argv)
