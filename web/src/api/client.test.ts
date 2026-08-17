import test from 'node:test';
import assert from 'node:assert/strict';
import { getApiErrorMessage, toApiError } from './errorMessage.ts';

test('unwraps 400 validation envelope using first error and includes diagnostics list', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        errors: ['Name is required', 'Price must be greater than zero'],
      },
      statusText: 'Bad Request',
    },
  });

  assert.equal(message, 'Name is required (Name is required | Price must be greater than zero)');
});

test('unwraps 403 admin-pin envelope error', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        errors: ['Admin PIN required'],
      },
      statusText: 'Forbidden',
    },
  });

  assert.equal(message, 'Admin PIN required');
});

test('unwraps 404 not-found envelope error', () => {
  const message = getApiErrorMessage({
    response: {
      data: {
        errors: ['Order not found'],
      },
      statusText: 'Not Found',
    },
  });

  assert.equal(message, 'Order not found');
});

test('toApiError keeps the HTTP status and axios code so callers can branch on 401/network', () => {
  const unauthorized = toApiError({ response: { status: 401, statusText: 'Unauthorized' } });
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.message, 'Unauthorized');

  const offline = toApiError({ code: 'ERR_NETWORK', request: {} });
  assert.equal(offline.code, 'ERR_NETWORK');
  assert.equal(offline.status, undefined);
  assert.match(offline.message, /network/i);
});
