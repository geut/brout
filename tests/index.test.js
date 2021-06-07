import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { Brout } from '../src/index.js'
import tapParser from '../src/parsers/tap.js'
import uvuParser from '../src/parsers/uvu.js'

test('basic', async () => {
  const targets = []
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/basic.js --config ./tests/webpack.config.js',
    parser: (target) => {
      targets.push(target)
      return (msg) => logs.push(msg)
    },
    stdout: {
      write: (msg) => logs.push(msg)
    }
  })
  await brout.run()
  assert.equal(targets, ['chromium'])
  assert.equal(logs, ['log0', 'log1'])
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

test('tap', async () => {
  const logs = []

  const brout = new Brout({
    url: 'http://127.0.0.1:3000',
    command: 'webpack serve ./tests/fixtures/tap.js --config ./tests/webpack.config.js',
    parser: tapParser,
    logger: {
      log: msg => logs.push(msg),
      error: msg => logs.push(msg)
    }
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
    logger: {
      log: msg => logs.push(msg),
      error: msg => logs.push(msg)
    }
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
    stdout: {
      write: (msg) => logs.push(msg)
    }
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
    stdout: {
      write: (msg) => logs.push(msg)
    }
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
