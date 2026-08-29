import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlantBarcode, normalizeScannedBarcode, toScanLookupValue } from './barcode.ts';

test('toScanLookupValue turns a printed 12-digit label back into its SKU', () => {
  assert.equal(toScanLookupValue(buildPlantBarcode('47')), '47');
  assert.equal(toScanLookupValue(' 000000000047\n'), '47');
});

test('toScanLookupValue passes non-padded reads through trimmed', () => {
  assert.equal(toScanLookupValue('  PL-HYD  '), 'PL-HYD');
  assert.equal(toScanLookupValue('101'), '101');
});

test('toScanLookupValue returns empty string for blank input', () => {
  assert.equal(toScanLookupValue(''), '');
  assert.equal(toScanLookupValue('   '), '');
  assert.equal(toScanLookupValue(null), '');
});

test('buildPlantBarcode pads short numeric SKUs to 12 digits', () => {
  assert.equal(buildPlantBarcode('101'), '000000000101');
  assert.equal(buildPlantBarcode('7'), '000000000007');
});

test('buildPlantBarcode trims whitespace before padding', () => {
  assert.equal(buildPlantBarcode('  42  '), '000000000042');
});

test('buildPlantBarcode returns 12 zeros for empty/null/undefined input', () => {
  assert.equal(buildPlantBarcode(''), '000000000000');
  assert.equal(buildPlantBarcode('   '), '000000000000');
  assert.equal(buildPlantBarcode(null), '000000000000');
  assert.equal(buildPlantBarcode(undefined), '000000000000');
});

test('buildPlantBarcode leaves already-long SKUs unchanged', () => {
  assert.equal(buildPlantBarcode('123456789012'), '123456789012');
  assert.equal(buildPlantBarcode('1234567890123'), '1234567890123');
});

test('normalizeScannedBarcode strips leading zeros', () => {
  assert.equal(normalizeScannedBarcode('000000000101'), '101');
  assert.equal(normalizeScannedBarcode('00042'), '42');
});

test('normalizeScannedBarcode leaves unpadded input unchanged', () => {
  assert.equal(normalizeScannedBarcode('101'), '101');
  assert.equal(normalizeScannedBarcode('ABC-123'), 'ABC-123');
});

test('normalizeScannedBarcode returns "0" for all-zero input', () => {
  assert.equal(normalizeScannedBarcode('000000000000'), '0');
  assert.equal(normalizeScannedBarcode('0'), '0');
});

test('normalizeScannedBarcode returns empty string for empty/null/undefined', () => {
  assert.equal(normalizeScannedBarcode(''), '');
  assert.equal(normalizeScannedBarcode('   '), '');
  assert.equal(normalizeScannedBarcode(null), '');
  assert.equal(normalizeScannedBarcode(undefined), '');
});

test('padded and legacy short forms of same SKU normalize to same value', () => {
  const legacy = normalizeScannedBarcode('101');
  const padded = normalizeScannedBarcode(buildPlantBarcode('101'));
  assert.equal(legacy, padded);
});
