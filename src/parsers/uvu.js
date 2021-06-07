import trim from 'lodash.trim'

const fields = [
  {
    name: 'Total',
    parse: (text) => Number(/Total:[\s]*([\d]*)/gi.exec(text)[1])
  },
  {
    name: 'Passed',
    parse: (text) => Number(/Passed:[\s]*([\d]*)/gi.exec(text)[1])
  },
  {
    name: 'Skipped',
    parse: (text) => Number(/Skipped:[\s]*([\d]*)/gi.exec(text)[1])
  },
  {
    name: 'Duration',
    parse: text => Number(/Duration:[\s]*([\\.\d]*)/gi.exec(text)[1])
  }
]

function getResult (lines) {
  const result = {}
  try {
    lines = lines.slice(-4)
    for (const field of fields) {
      let value = lines.find(line => line.includes(field.name))
      if (value === undefined || value === null) return null
      value = field.parse(value)
      if (value === undefined || value === null || Number.isNaN(value)) return null
      result[field.name.toLocaleLowerCase()] = value
    }
    return result
  } catch (err) {
    return null
  }
}

export default function uvuParser (target, { exit, stdout }) {
  const lines = []

  return function (text) {
    lines.push(text)

    if (text.includes('Duration:') && lines.length >= 4) {
      const result = getResult(lines)
      if (result) {
        exit(result.total === result.passed ? 0 : 1)
        text = `\n${trim(text, '\n')}\n  Target:    ${target}\n\n`
      }
    }

    stdout.write(text)
  }
}
