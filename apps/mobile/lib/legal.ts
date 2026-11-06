/**
 * Yasal metinler (Kullanım Şartları ve KVKK aydınlatma metni).
 * Bu metinler düz <Text> bileşeni içinde gösterilir; bu yüzden Markdown işareti kullanılmaz.
 */

/** Kullanım şartları sürümü. consent tablosuna bu değer yazılır. */
export const TERMS_VERSION = '1.0.0';

/** Sohbet ekranının altında kalıcı olarak görünen iki kelimelik not. */
export const TERMINAL_DISCLAIMER = 'DEVA tanı koymaz.';

/** Onboarding'in ikinci adımında gösterilen tek seferlik uyarı metni. */
export const DISCLAIMER: string =
  'DEVA bir sağlık hizmeti değildir. Tanı koymaz, tedavinin yerine geçmez, ilaç ya da terapi önermez. ' +
  'Seni dinler ve sana uygun bir uzman bulmaya yardımcı olur. ' +
  'Acil bir durumda 112’yi arayabilirsin. ' +
  'DEVA 18 yaş ve üzeri kullanıcılar içindir. ' +
  'Sohbetler sunucuda saklanır ve istediğin zaman kalıcı olarak silebilirsin.';

/** Kullanım şartları bölümü. */
export interface LegalSection {
  title: string;
  body: string;
}

export const TERMS_SECTIONS: ReadonlyArray<LegalSection> = [
  {
    title: 'Kullanım koşulları',
    body:
      'DEVA’yı yalnızca 18 yaş ve üzeri kişiler kullanabilir. ' +
      'DEVA bir sağlık hizmeti olmadığı için sana tıbbi tavsiye, tanı, ilaç veya tedavi önerisi verilmez. ' +
      'DEVA seni dinler ve uygun bir uzmana yönlendirme konusunda yardımcı olur. ' +
      'Bir uzmana gidip gitmeme kararı tamamen senindir.',
  },
  {
    title: 'Kriz ekranı',
    body:
      'Kriz ekranı; 112, ALO 182 ve yakınındaki acil servis bilgilerini gösterir. ' +
      'Ekran yalnızca bilgilendirme amaçlıdır ve profesyonel yardımın yerine geçmez. ' +
      'Kendine zarar verme düşüncesi olduğunda acil servise başvurman gerekir.',
  },
  {
    title: 'Ücretsiz kullanım',
    body:
      'DEVA v1 sürümünde herhangi bir ödeme alınmaz. ' +
      'Ücretsiz planda günlük mesaj sınırı vardır. ' +
      'Sınıra ulaşıldığında DEVA konuşmayı reddetmez; cevapları biraz daha kısa ve biraz daha az bağlamla verir.',
  },
  {
    title: 'Ödeme alınmaz',
    body:
      'Uygulamada ödeme sistemi kurulu değildir ve kart bilgisi toplanmaz. ' +
      'Ücretli kullanım, veritabanındaki is_pro alanı elle veya kampanya yoluyla açılır. ' +
      'Ek bir ödeme adımı ya da banka bilgisi istenmez.',
  },
];

export const KVKK_SECTIONS: ReadonlyArray<LegalSection> = [
  {
    title: 'Veri sorumlusu',
    body:
      'Kişisel verilerinin sorumlusu DEVA’dır. ' +
      'Veriler, yalnızca sana hizmet sunmak amacıyla işlenir. ' +
      'Verilerin üzerinde kanunlardan doğan hakların saklıdır.',
  },
  {
    title: 'İşleme amaçları',
    body:
      'Sohbet geçmişin, sana dinlenecek bir alan sunmak amacıyla saklanır. ' +
      'Anket sonuçların ve konuşmaların, sana uygun tek bir uzman önermek amacıyla birlikte değerlendirilir. ' +
      'Anket sonuçları sana gösterilmez, yalnızca yönlendirme için kullanılır.',
  },
  {
    title: 'Saklama süresi',
    body:
      'Verilerin, sen silene kadar sunucuda (Postgres) saklanır. ' +
      'Sohbet geçmişi, anket sonuçları ve notlar iptal edilene kadar tutulur. ' +
      'Verileri istediğin an kalıcı olarak silebilirsin.',
  },
  {
    title: 'Üçüncü tarafa aktarım',
    body:
      'Sohbetinde yazdığın mesaj metni, yanıt üretmek için yapılandırılmış yapay zekâ sağlayıcısına gönderilir. ' +
      'Başka hiçbir veri üçüncü taraflarla paylaşılmaz. ' +
      'v1 sürümünde varsayılan sağlayıcı yerel bir sahte modeldir, bu yüzden mesajların cihazından dışarı çıkmaz.',
  },
  {
    title: 'Haklarınız',
    body:
      'Kanunlara göre verilerine erişme ve kalıcı olarak silme hakkına sahipsin. ' +
      'Silme işlemi, Ayarlar bölümündeki “Tüm verilerimi sil” seçeneğiyle tek dokunuşta çalışır. ' +
      'Bu işlem geri alınamaz ve tüm sohbetler, anket sonuçları ve notlar kalıcı olarak yok edilir.',
  },
];
