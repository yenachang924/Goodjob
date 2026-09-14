import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import Ajv from 'ajv';

test('OpenAPI input, update and response schemas accept the real task contract', () => {
  const api = parse(
    readFileSync(new URL('../apps/api/openapi.yaml', import.meta.url), 'utf8'),
  );
  const ajv = new Ajv({ strict: false });
  ajv.addFormat('uuid', /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i);
  ajv.addSchema({ $id: 'goodjob', components: api.components });
  const validate = (name) =>
    ajv.compile({ $ref: `goodjob#/components/schemas/${name}` });
  const input = {
    project: '학습',
    title: 'SQL',
    minutes: 30,
    priority: 2,
    done: false,
    due: '',
  };
  const task = {
    ...input,
    id: '594e4cfc-84f3-4455-967e-84424b5f87ae',
    revision: 1,
  };
  assert.equal(validate('TaskInput')(input), true);
  assert.equal(validate('TaskUpdate')({ ...input, revision: 1 }), true);
  assert.equal(validate('TaskResponse')({ success: true, data: task }), true);
  assert.equal(validate('TaskInput')({ ...input, revision: 1 }), false);
  assert.equal(validate('TaskUpdate')(input), false);
  assert.equal(validate('TaskUpdate')({ ...input, revision: 1.8 }), false);
  assert.equal(validate('TaskInput')({ ...input, minutes: 30.5 }), false);
  assert.equal(validate('Task')({ ...task, id: 'invalid' }), false);
});
