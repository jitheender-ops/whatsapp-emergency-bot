import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { initDb, closeDb } from '../src/db/database.js';
import { runMigrations } from '../src/db/migrations.js';
import { upsertUser, getUserByPhone, findDonors, registerDonor, findDonorsNearby } from '../src/db/models/user.js';

describe('Blood Donor Model', () => {
  beforeAll(async () => {
    await initDb(':memory:');
    await runMigrations();
  });

  afterAll(() => {
    closeDb();
  });

  test('upsertUser creates new user', () => {
    const user = upsertUser({ phone: '111', name: 'Alice', blood_group: 'A+' });
    expect(user.phone).toBe('111');
    expect(user.name).toBe('Alice');
    expect(user.blood_group).toBe('A+');
  });

  test('upsertUser updates existing user', () => {
    upsertUser({ phone: '111', city: 'Mumbai' });
    const user = getUserByPhone('111');
    expect(user.city).toBe('Mumbai');
    expect(user.name).toBe('Alice'); // Should be preserved
  });

  test('registerDonor creates available donor', () => {
    const user = registerDonor('222', 'Bob', 'O-', 'Delhi');
    expect(user.is_donor).toBe(1);
    expect(user.is_available).toBe(1);
  });

  test('findDonors finds matching donors', () => {
    const donors = findDonors('O-');
    expect(donors).toHaveLength(1);
    expect(donors[0].name).toBe('Bob');
  });

  test('findDonors filters by city', () => {
    registerDonor('333', 'Charlie', 'O-', 'Mumbai');
    const donors = findDonors('O-', 'Mumbai');
    expect(donors).toHaveLength(1);
    expect(donors[0].name).toBe('Charlie');
  });

  test('findDonorsNearby finds donors within radius', () => {
    // Mumbai approx
    upsertUser({ phone: '333', latitude: 19.0, longitude: 72.8, is_donor: true });
    
    // Search from nearby
    const donors = findDonorsNearby('O-', 19.01, 72.81, 15);
    expect(donors.length).toBeGreaterThan(0);
    expect(donors[0].phone).toBe('333');
    expect(donors[0].distance_km).toBeDefined();
  });
});
