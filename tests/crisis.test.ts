import { describe, expect, it } from 'vitest';
import { detectCrisis, normalizeText, toLowerCaseTr } from '../supabase/functions/_shared/crisis.ts';

describe('detectCrisis', () => {
  it('kritik ifadeyi yüksek kriz olarak okur', () => {
    expect(detectCrisis('kendimi öldürmek istiyorum').level).toBe('high');
  });

  it('iç içe geçen desenleri iki kez saymaz', () => {
    // "kendimi öldürmek" zaten "kendimi öldürmek istiyorum" ifadesinin içinde.
    const result = detectCrisis('kendimi öldürmek istiyorum');
    expect(result.matched.filter((m) => m.includes('öldürmek'))).toHaveLength(1);
  });

  it('birbirinden bağımsız iki kritik ifadeyi en yüksek seviyeye taşır', () => {
    expect(detectCrisis('kendimi öldürmek istiyorum ve ilaç içeceğim').level).toBe('critical');
  });

  it('yalnızlık gibi düşük sinyalleri low olarak okur', () => {
    expect(detectCrisis('bugün çok yalnızım').level).toBe('low');
  });

  it('sıradan bir cümlede kriz sinyali bulmaz', () => {
    expect(detectCrisis('merhaba').level).toBe('none');
    expect(detectCrisis('').level).toBe('none');
  });

  it('iki yüksek desen bir araya gelince high olur', () => {
    expect(detectCrisis('dayanamıyorum ve acı çekiyorum').level).toBe('high');
  });

  it('kelime ortasındaki eşleşmeleri saymaz', () => {
    expect(detectCrisis('aslında ölmüyorum, sadece yorgunum').level).not.toBe('critical');
  });

  describe('üçüncü kişi bağlamı', () => {
    const aboutOthers = 'annem "ölmek istiyorum" dedi, ne yapmalı?';
    const aboutSelf = 'annem "ölmek istiyorum" dedi, ne yapmalı? ama ben de korkuyorum';

    it('üçüncü kişi hakkında soru soruluyorsa bir kademe düşürür', () => {
      expect(detectCrisis('"ölmek istiyorum" ne yapmalı?').level).toBe('high');
      expect(detectCrisis(aboutOthers).level).toBe('low');
    });

    it('kullanıcı kendinden bahsediyorsa düşürme uygulanmaz', () => {
      expect(detectCrisis(aboutSelf).level).toBe('high');
    });

    it('üçüncü kişi geçse de soru yoksa düşürme uygulanmaz', () => {
      expect(detectCrisis('annem ölmek istiyorum dedi').level).toBe('high');
    });
  });

  describe('Türkçe karakter normalizasyonu', () => {
    it('büyük I harfini Türkçe kurallarına göre küçültür', () => {
      expect(toLowerCaseTr('öLÜM')).toBe('ölüm');
      expect(toLowerCaseTr('İSTANBUL')).toBe('istanbul');
    });

    it('aksanları eşleme için ASCII indirger', () => {
      expect(normalizeText('Çok Yorgunum')).toBe('cok yorgunum');
      expect(normalizeText('  yalnız   hissediyorum ')).toBe('yalniz hissediyorum');
    });

    it('büyük harfle yazılmış ifadeyi de yakalar', () => {
      expect(detectCrisis('KENDIMI OLDURMEK ISTIYORUM').level).toBe('high');
    });
  });
});