import { describe, test, expect } from '@jest/globals';
import { calculateDistance } from '../src/services/geocoding.js';

describe('Geocoding Service', () => {
  test('calculateDistance computes roughly correct distance', () => {
    // Mumbai (approx 19.076, 72.877) to Pune (approx 18.520, 73.856) is ~120km
    const dist = calculateDistance(19.076, 72.877, 18.520, 73.856);
    expect(dist).toBeGreaterThan(110);
    expect(dist).toBeLessThan(130);
  });

  test('calculateDistance is zero for same points', () => {
    const dist = calculateDistance(19.076, 72.877, 19.076, 72.877);
    expect(dist).toBe(0);
  });
});
