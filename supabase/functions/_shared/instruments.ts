export type InstrumentCode = 'PHQ9' | 'GAD7' | 'SCOFF';
export type AnswerScale = 'freq0_3' | 'yesno';

export interface InstrumentItem {
  id: string;
  text: string;
}

export interface Instrument {
  code: InstrumentCode;
  title: string;
  intro: string;
  scale: AnswerScale;
  items: InstrumentItem[];
  /** Kullanıcıya destek kartı gösterilecek maddenin sıfır tabanlı indeksi. */
  sensitiveIndex?: number;
}

const freqItems = (prefix: string, texts: string[]): InstrumentItem[] =>
  texts.map((text, i) => ({ id: `${prefix}${i + 1}`, text }));

export const PHQ9: Instrument = {
  code: 'PHQ9',
  title: 'PHQ-9',
  intro: 'Son iki hafta içinde bu sorular seni ne sıklıkla rahatsız etti?',
  scale: 'freq0_3',
  sensitiveIndex: 8,
  items: freqItems('phq9_', [
    'İşine/derslerine ilginin ya da konsantrasyonunun kaybolması',
    'Normalde yaptığın işleri yapmakta zorlanma',
    'İyi bir şey beklemekten çok kendini kötü hissetme',
    'Kendini değersiz hissetme — kendini yeterince iyi görmeme',
    'Boşluğa düşmeden oturmak istememe',
    'Kendine zarar vereceğinden korkma',
    'Yemek yemekte ya da uyumakta zorlanma',
    'Enerjinin çok düşük olması — hiçbir şeye heves etmeme',
    'Kendine zarar verme ya da hayatına son verme düşüncesi',
  ]),
};

export const GAD7: Instrument = {
  code: 'GAD7',
  title: 'GAD-7',
  intro: 'Son iki hafta içinde seni ne sıklıkla rahatsız etti?',
  scale: 'freq0_3',
  items: freqItems('gad7_', [
    'Kaygılı ya da huzursuz hissetme',
    'Bir şey üzerinde endişelenmekte ya da kontrol etmekte zorlanma',
    'Endişe ya da korku nedeniyle çok fazla endişelenme',
    'Rahatlamakta ya da sakinleşmekte zorlanma',
    'Sürekli hareketlilik ya da tedirginlik nedeniyle durmakta zorlanma',
    'Sinirinin fazla çıkması ya da kolay kızman',
    'Korkutucu bir şey olduğunda çok korkma',
  ]),
};

export const SCOFF: Instrument = {
  code: 'SCOFF',
  title: 'SCOFF',
  intro: 'Aşağıdaki ifadelerden son bir ay içinde sende ne kadar sık oldu?',
  scale: 'yesno',
  items: freqItems('scoff_', [
    'Korktuğun ya da kaygılandığın zamanlarda yemek yiyor musun',
    'Hiç yemek yemeden geçen günler oldu mu',
    'Kilo vermek için daha fazla spor ya da hareket yapıyor musun',
    'Kilon ya da şeklin konusunda kendini suçlu hissediyor musun',
    'Yeme alışkanlıklarının kontrolünü kaybettiğini hissettin mi',
  ]),
};

export const INSTRUMENTS: readonly Instrument[] = [PHQ9, GAD7, SCOFF];

export const INSTRUMENT_CODES: readonly InstrumentCode[] = ['PHQ9', 'GAD7', 'SCOFF'];

export function findInstrument(code: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.code === code);
}