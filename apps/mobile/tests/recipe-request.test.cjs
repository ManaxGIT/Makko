const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = readFileSync(join(__dirname, '../src/features/create-request/api.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const context = { exports: {}, Date, require: () => ({}) };
vm.runInNewContext(outputText, context);
const { buildRequestBody } = context.exports;
const recipe = { title: 'Súp bí đỏ', cookingMinutes: 30, servings: 2, ingredients: [{ name: 'Bơ lạt', quantity: 20, unit: 'g' }], steps: ['Nấu bí đỏ đến khi mềm.'] };
const form = {
  title: recipe.title, recipe, savedAddress: { id: 'address-id' },
  items: [{ id: 'butter', name: 'Bơ lạt', quantity: '1', unit: 'gói', note: 'Gói nhỏ, tối thiểu 20 g', allowSubstitution: false }],
  day: 'today', time: '18:00', budget: '50000', fee: '25000', payment: 'cash', deliveryNote: '',
};

test('publishing preserves the cooking snapshot separately from package quantities', () => {
  const body = buildRequestBody(form, 'recipe-submission-0001', new Date(2030, 0, 1, 10));
  assert.equal(body.items[0].quantity, '1');
  assert.equal(body.items[0].unit, 'gói');
  assert.equal(body.items[0].note, 'Gói nhỏ, tối thiểu 20 g');
  assert.equal(body.recipe.ingredients[0].quantity, 20);
  assert.equal(body.recipe.ingredients[0].unit, 'g');
  assert.equal(body.recipe.steps[0], recipe.steps[0]);
});

test('editing an order does not send a replacement for its saved original recipe', () => {
  const body = buildRequestBody(form, 'recipe-edit-00000001', new Date(2030, 0, 1, 10), true);
  assert.equal('recipe' in body, false);
});
