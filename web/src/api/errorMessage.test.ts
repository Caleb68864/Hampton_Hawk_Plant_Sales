import test from 'node:test';
import assert from 'node:assert/strict';
import { getApiErrorMessage } from './errorMessage.ts';

test('getApiErrorMessage returns first API error and includes full list when multiple errors exist', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        errors: ['Primary validation error', 'Secondary warning'],
      },
      statusText: 'Bad Request',
    },
  });

  assert.equal(message, 'Primary validation error (Primary validation error | Secondary warning)');
});

test('getApiErrorMessage falls back to statusText when errors are empty', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        errors: ['   '],
      },
      statusText: 'Unauthorized',
    },
  });

  assert.equal(message, 'Unauthorized');
});

test('getApiErrorMessage falls back to generic message when response has no useful text', () => {
  const message = getApiErrorMessage({ response: { statusText: '   ' } });

  assert.equal(message, 'An error occurred');
});
