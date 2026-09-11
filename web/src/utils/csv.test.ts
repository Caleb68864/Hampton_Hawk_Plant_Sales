import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvLine, extractCsvColumnValues } from './csv.ts';

test('parseCsvLine splits plain fields and trims whitespace', () => {
  assert.deepEqual(parseCsvLine('a, b ,c'), ['a', 'b', 'c']);
  assert.deepEqual(parseCsvLine(''), ['']);
  assert.deepEqual(parseCsvLine('a,,c'), ['a', '', 'c']);
});

test('parseCsvLine keeps commas inside quoted fields', () => {
  assert.deepEqual(parseCsvLine('SKU-1,"Tomato, Cherry",3'), ['SKU-1', 'Tomato, Cherry', '3']);
});

test('parseCsvLine unescapes doubled quotes', () => {
  assert.deepEqual(parseCsvLine('"He said ""hi""",x'), ['He said "hi"', 'x']);
});

test('parseCsvLine tolerates an unterminated quote', () => {
  assert.deepEqual(parseCsvLine('"open,field'), ['open,field']);
});

test('extractCsvColumnValues reads the right column when an earlier field has a quoted comma', () => {
  const text = [
    'name,sku,price',
    '"Basil, Sweet",SKU-100,2.50',
    'Mint,SKU-200,3.00',
    '"Pepper, Bell",SKU-300,4.00',
  ].join('\n');
  assert.deepEqual(extractCsvColumnValues(text, 'SKU'), ['SKU-100', 'SKU-200', 'SKU-300']);
});

test('extractCsvColumnValues dedupes, skips blanks, and handles a missing header', () => {
  const text = 'sku,name\r\nA,x\r\n\r\nA,y\r\n,z\r\nB,w';
  assert.deepEqual(extractCsvColumnValues(text, 'sku'), ['A', 'B']);
  assert.deepEqual(extractCsvColumnValues(text, 'barcode'), []);
  assert.deepEqual(extractCsvColumnValues('sku,name', 'sku'), []);
});
