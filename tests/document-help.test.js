import { describe, test, expect, beforeEach } from '@jest/globals';
import { getSession, setSession, clearSession, isInModule, getActiveSessionCount, updateSessionData } from '../src/services/session.js';

describe('Session Manager', () => {
  beforeEach(() => {
    // Clear the specific phone used in tests
    clearSession('1234567890');
  });

  test('getSession creates new session', () => {
    const session = getSession('1234567890');
    expect(session.module).toBeNull();
    expect(session.step).toBeNull();
    expect(session.data).toEqual({});
  });

  test('setSession updates module and step', () => {
    setSession('1234567890', 'test_module', 'test_step', { key: 'value' });
    const session = getSession('1234567890');
    expect(session.module).toBe('test_module');
    expect(session.step).toBe('test_step');
    expect(session.data.key).toBe('value');
  });

  test('updateSessionData merges data', () => {
    setSession('1234567890', 'test', 'step', { a: 1 });
    updateSessionData('1234567890', { b: 2 });
    const session = getSession('1234567890');
    expect(session.data).toEqual({ a: 1, b: 2 });
  });

  test('clearSession removes session', () => {
    setSession('1234567890', 'test', 'step');
    clearSession('1234567890');
    const session = getSession('1234567890');
    expect(session.module).toBeNull();
  });

  test('isInModule works correctly', () => {
    setSession('1234567890', 'test_module', 'step');
    expect(isInModule('1234567890', 'test_module')).toBe(true);
    expect(isInModule('1234567890', 'other_module')).toBe(false);
    
    clearSession('1234567890');
    expect(isInModule('1234567890', 'test_module')).toBe(false);
  });
});
