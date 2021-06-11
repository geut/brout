import completed from 'tap-completed'

export default function tapParser ({ target, exit, logger }) {
  const tap = completed(results => {
    if (results.ok) {
      exit(0)
    } else {
      exit(1)
    }
  })
  logger.log(`# target: ${target}`)
  return function (args) {
    tap.write(`${args.join(' ')}\n`)
    logger.log(args)
  }
}
