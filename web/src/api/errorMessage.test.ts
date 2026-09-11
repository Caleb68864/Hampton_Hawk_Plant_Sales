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

test('getApiErrorMessage reports a timeout when the request is aborted by the client timeout', () => {
  const message = getApiErrorMessage({ code: 'ECONNABORTED', message: 'timeout of 10000ms exceeded' });

  assert.equal(message, 'The request timed out before the server responded.');
});

test('getApiErrorMessage reports a timeout for ETIMEDOUT', () => {
  const message = getApiErrorMessage({ code: 'ETIMEDOUT' });

  assert.equal(message, 'The request timed out before the server responded.');
});

test('getApiErrorMessage reports a network failure when the server is unreachable', () => {
  const message = getApiErrorMessage({ code: 'ERR_NETWORK', message: 'Network Error' });

  assert.equal(message, 'Network error — could not reach the server.');
});

test('getApiErrorMessage reports a network failure when a request was sent but never answered', () => {
  const message = getApiErrorMessage({ request: {} });

  assert.equal(message, 'Network error — could not reach the server.');
});

test('getApiErrorMessage still prefers the server envelope when a response did arrive', () => {
  const message = getApiErrorMessage({
    code: 'ERR_BAD_REQUEST',
    request: {},
    response: {
      data: { errors: ['Order not found'] },
      statusText: 'Not Found',
    },
  });

  assert.equal(message, 'Order not found');
});
