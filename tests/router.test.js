import { describe, test, expect } from '@jest/globals';
import { handleMessage } from '../src/modules/router.js';

describe('Intent Router', () => {
  test('handleMessage is exported as an async function', () => {
    expect(typeof handleMessage).toBe('function');
  });
});
