import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classIdFromHash } from '../src/catalog/classRoute.js'

test('class detail route accepts only a positive safe class ID', () => {
  assert.equal(classIdFromHash('#/classes/42'), 42)
  for (const hash of ['', '#/classes', '#/classes/0', '#/classes/-1', '#/classes/abc', '#/classes/9007199254740992', '#/classes/4/extra']) {
    assert.equal(classIdFromHash(hash), null)
  }
})
