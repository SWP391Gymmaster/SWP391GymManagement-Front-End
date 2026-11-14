import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

const db = process.env.E2E_DB || 'swp391_e2e_20261113'
if (!/^swp391_e2e_[a-zA-Z0-9_]+$/.test(db) || !process.env.MYSQL_PWD) {
  throw new Error('E2E requires MYSQL_PWD and an isolated swp391_e2e_* database')
}
const mysql = process.env.MYSQL_BIN || 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
const backendSql = file => resolve(import.meta.dirname, '../../../SWP391GymManagement-Back-End/sql/e2e', file)
const reset = () => {
  for (const file of ['reset.sql', 'seed-users.sql']) {
    const result = spawnSync(mysql, ['-u', 'root', '-h', '127.0.0.1', '-D', db], {
      input: readFileSync(backendSql(file)), encoding: 'utf8', env: process.env,
    })
    if (result.status !== 0) throw new Error(`${file}: ${result.stderr || result.error?.message}`)
  }
}
const run = args => spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, E2E_DB: db } }).status

reset()
const api = run(['--test', 'scripts/e2e/api.test.mjs'])
reset()
const browser = run(['scripts/e2e/browser.mjs'])
process.stdout.write(`E2E result: API ${api === 0 ? 'PASS' : 'FAIL'}, browser ${browser === 0 ? 'PASS' : 'FAIL'}\n`)
process.exitCode = api || browser ? 1 : 0
