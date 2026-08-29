import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCsvContent, escapeCsvField } from './csvExport.ts';

test('escapeCsvField leaves ordinary values alone', () => {
  assert.equal(escapeCsvField('Basil'), 'Basil');
  assert.equal(escapeCsvField(''), '');
  assert.equal(escapeCsvField('12'), '12');
});

test('escapeCsvField quotes commas, quotes and newlines and doubles inner quotes', () => {
  assert.equal(escapeCsvField('Tomato, Cherry'), '"Tomato, Cherry"');
  assert.equal(escapeCsvField('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvField('line1\nline2'), '"line1\nline2"');
});

test('escapeCsvField neutralises spreadsheet formula triggers', () => {
  assert.equal(escapeCsvField('=HYPERLINK("http://evil","click")'), '"\'=HYPERLINK(""http://evil"",""click"")"');
  assert.equal(escapeCsvField('+1+1'), '"\'+1+1"');
  assert.equal(escapeCsvField('-cmd|/C calc'), '"\'-cmd|/C calc"');
  assert.equal(escapeCsvField('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(escapeCsvField('\t=1+1'), '"\'\t=1+1"');
  assert.equal(escapeCsvField('\r=1+1'), '"\'\r=1+1"');
});

test('escapeCsvField keeps plain negative and decimal numbers numeric', () => {
  assert.equal(escapeCsvField('-5'), '-5');
  assert.equal(escapeCsvField('-12.50'), '-12.50');
  assert.equal(escapeCsvField('-5x'), '"\'-5x"');
});

test('buildCsvContent keeps the BOM and CRLF row separator', () => {
  const rows = [{ name: 'Basil', qty: 2 }, { name: '=1+1', qty: -1 }];
  const content = buildCsvContent(rows, ['Name', 'Qty'], ['name', 'qty']);
  assert.equal(content.charCodeAt(0), 0xfeff);
  assert.equal(content.slice(1), 'Name,Qty\r\nBasil,2\r\n"\'=1+1",-1');
});

test('buildCsvContent rejects mismatched headers and keys', () => {
  assert.throws(() => buildCsvContent([], ['A'], []), /same length/);
});
