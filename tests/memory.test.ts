import { describe, expect, it } from 'vitest';
import { mergeMemoryNotes } from '../supabase/functions/_shared/memory.ts';

describe('mergeMemoryNotes', () => {
  const existing = [
    { id: '1', content: 'Kedisi Mavi çok seviliyor' },
    { id: '2', content: 'Salı günleri geç çalışıyor' },
  ];

  it('mevcut notun içinde geçen adayı atar', () => {
    const result = mergeMemoryNotes(existing, [
      { content: 'Salı günleri', category: 'preference' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('ilk tokenı aynı olan adayı atar', () => {
    const result = mergeMemoryNotes(existing, [
      { content: 'Kedisi yıllardır yanımda', category: 'fact' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('büyük/küçük harf ve aksan farkını tekrar saymaz', () => {
    const result = mergeMemoryNotes(existing, [
      { content: 'SALİ GÜNLERİ', category: 'event' },
    ]);
    expect(result).toHaveLength(0);
  });

  it('yeni ve alakasız bilgiyi kabul eder', () => {
    const result = mergeMemoryNotes(existing, [
      { content: 'İstanbul Kadıköy’de yaşıyor', category: 'fact' },
    ]);
    expect(result).toEqual([{ content: 'İstanbul Kadıköy’de yaşıyor', category: 'fact' }]);
  });

  it('beyaz liste dışı kategoriyi atar', () => {
    const result = mergeMemoryNotes([], [
      { content: 'Bir not', category: 'health' },
      { content: 'Başka bir not', category: 'fact' },
    ]);
    expect(result).toEqual([{ content: 'Başka bir not', category: 'fact' }]);
  });

  it('en fazla iki not kabul eder', () => {
    const result = mergeMemoryNotes([], [
      { content: 'Birinci bilgi', category: 'fact' },
      { content: 'İkinci bilgi', category: 'event' },
      { content: 'Üçüncü bilgi', category: 'context' },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((n) => n.content)).toEqual(['Birinci bilgi', 'İkinci bilgi']);
  });

  it('seçilen notlar arasında da tekrarı engeller', () => {
    const result = mergeMemoryNotes([], [
      { content: 'Denizde yüzmeyi seviyor', category: 'preference' },
      { content: 'Denizde yüzmeyi çok seviyor', category: 'preference' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('80 karakteri aşan adayı atar', () => {
    const long = 'x'.repeat(81);
    expect(mergeMemoryNotes([], [{ content: long, category: 'fact' }])).toHaveLength(0);
    expect(mergeMemoryNotes([], [{ content: 'x'.repeat(80), category: 'fact' }])).toHaveLength(1);
  });

  it('boş adayı atar', () => {
    expect(mergeMemoryNotes([], [{ content: '   ', category: 'fact' }])).toHaveLength(0);
  });
});