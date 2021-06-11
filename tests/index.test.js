import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Brout } from '../src/index.js'
import tapParser from '../src/parsers/tap.js'
import uvuParser from '../src/parsers/uvu.js'

const logger = logs => ({
  log: (...args) => logs.push(args.join(' ')),
  error: (...args) => logs.push(args.join(' '))
})

const stdout = logs => ({
  write: (text) => logs.push(text)
})

test.only('basic', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/basic.js --config ./tests/webpack.config.js',
    parser: ({ target, logger }) => {
      logger.log(target)
      return (args) => {
        logger.log(...args)
      }
    },
    logger: logger(logs),
    stdout: stdout(logs)
  })
  await brout.run()
  assert.equal(logs, ['chromium', 'log0', 'log1'])
})

test('basic fail', async () => {
  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/basic-fail.js --config ./tests/webpack.config.js',
    parser: () => () => {}
  })

  try {
    await brout.run()
    assert.unreachable('I will not run')
  } catch (err) {
    assert.is(err.message, 'error0')
  }
})

test.only('tap', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/tap.js --config ./tests/webpack.config.js',
    parser: tapParser,
    logger: logger(logs)
  })

  await brout.run()

  assert.is(logs.length, 10) // 10 messages from zora
})

test('tap fail', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/tap-fail.js --config ./tests/webpack.config.js',
    parser: tapParser,
    logger: logger(logs)
  })

  try {
    await brout.run()
    assert.unreachable('I will not run')
  } catch (err) {
    assert.is(logs.length, 16) // 16 messages from zora
    assert.instance(err, Error)
  }
})

test('uvu', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/uvu.js --config ./tests/webpack.config.js',
    parser: uvuParser,
    stdout: stdout(logs)
  })

  await brout.run()

  assert.is(logs.length, 4)
})

test('uvu fail', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/uvu-fail.js --config ./tests/webpack.config.js',
    parser: uvuParser,
    stdout: stdout(logs)
  })

  try {
    await brout.run()
    assert.unreachable('I will not run')
  } catch (err) {
    assert.is(logs.length, 4)
    assert.instance(err, Error)
  }
})

test.run()
