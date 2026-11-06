import { describe, expect, it } from 'vitest';
import { CITIES } from '../supabase/functions/_shared/cities.ts';

describe('CITIES', () => {
  it('Türkiye\'nin 81 ilini içerir', () => {
    expect(CITIES).toHaveLength(81);
  });

  it('il adları benzersizdir', () => {
    const names = CITIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('Türkçe alfabe sırasındadır', () => {
    const names = CITIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'tr')));
  });

  it('büyük şehirler mevcuttur ve doğru yazılmıştır', () => {
    const names = CITIES.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(['İstanbul', 'Ankara', 'İzmir']));
  });

  it('her il için makul koordinatlar taşır', () => {
    for (const city of CITIES) {
      expect(city.lat).toBeGreaterThanOrEqual(36);
      expect(city.lat).toBeLessThanOrEqual(42.5);
      expect(city.lng).toBeGreaterThanOrEqual(26);
      expect(city.lng).toBeLessThanOrEqual(44.5);
      expect(city.name.trim()).toBe(city.name);
    }
  });

  it('İstanbul kaydı bilinen merkez koordinatına yakındır', () => {
    const istanbul = CITIES.find((c) => c.name === 'İstanbul')!;
    expect(istanbul.lat).toBeCloseTo(41.0, 1);
    expect(istanbul.lng).toBeCloseTo(28.98, 1);
  });
});