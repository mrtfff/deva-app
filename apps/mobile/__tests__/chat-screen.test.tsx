import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import { ChatScreen } from '../components/chat/ChatScreen';
import type { SseEvent } from '@shared/types';
import { CRISIS_WARN_TEXT } from '@shared/crisis';

type Emit = (event: SseEvent) => void;
let emit: Emit | null = null;

jest.mock('../lib/stream', () => ({
  streamChat: jest.fn(async (_body: unknown, onEvent: Emit) => {
    emit = onEvent;
  }),
}));

const QUOTA_TEXT =
  'Bugünlük sınırı doldu — DEVA biraz daha kısa cevap veriyor ama dinlemeye devam ediyor.';

async function renderChat() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <ChatScreen />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

// Sohbetin ilk mesajda bir konuşma kaydı açabilmesi için create() gerçek bir id döndürüyor.
jest.mock('../lib/supabase-hooks', () => {
  const actual = jest.requireActual('../lib/supabase-hooks');
  return {
    ...actual,
    useConversations: () => ({
      conversations: [],
      loading: false,
      refresh: jest.fn(async () => undefined),
      create: jest.fn(async () => 'conv-1'),
      remove: jest.fn(async () => undefined),
      setArchived: jest.fn(async () => undefined),
    }),
  };
});

async function send(text: string) {
  await fireEvent.changeText(await screen.findByPlaceholderText('Ne düşündüğünü yaz…'), text);
  await fireEvent.press(screen.getByLabelText('Gönder'));
}

/** Sahte akıştan bir olay yayar. */
async function streamEvent(event: SseEvent) {
  await act(async () => {
    emit!(event);
  });
}

beforeEach(() => {
  emit = null;
});

describe('ChatScreen', () => {
  it('sohbetin altında kalıcı uyarıyı gösterir', async () => {
    await renderChat();
    expect(await screen.findByText('DEVA tanı koymaz.')).toBeTruthy();
  });

  it('boş sohbette hızlı başlangıç butonlarını ve serbest yazma alanını birlikte gösterir', async () => {
    await renderChat();
    for (const label of [
      'İyi hissediyorum',
      'Kararsızım',
      'Çok kötüyüm',
      'Yalnız hissediyorum',
      'Uykusuzum',
      'Kızgınım',
    ]) {
      expect(await screen.findByText(label)).toBeTruthy();
    }
    expect(screen.getByText('Ya da buradan yaz')).toBeTruthy();
    expect(screen.getByText('Konuşmak istemiyorum')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ne düşündüğünü yaz…')).toBeTruthy();
  });

  it('ilk delta geldiğinde asistan metnini ekranda gösterir', async () => {
    await renderChat();
    await send('bugün çok yorgunum');

    expect(emit).not.toBeNull();
    emit!({ type: 'delta', text: 'Anlıyorum. Buradayım ve dinliyorum.' });

    expect(await screen.findByText('Anlıyorum. Buradayım ve dinliyorum.')).toBeTruthy();
  });

  it('kriz olayında uyarı mesajını ve tam iki butonu gösterir', async () => {
    await renderChat();
    await send('kendimi öldürmek istiyorum');

    await streamEvent({
      type: 'crisis',
      level: 'high',
      message: CRISIS_WARN_TEXT,
      messageId: 'm-1',
    });

    expect(await screen.findByText(CRISIS_WARN_TEXT)).toBeTruthy();
    expect(screen.getByText('Devam et')).toBeTruthy();
    expect(screen.getByText('Kriz ekranını aç')).toBeTruthy();
  });

  it('kota kısıldığında sakin uyarı şeridini tam metniyle gösterir', async () => {
    await renderChat();
    await send('merhaba');

    emit!({ type: 'quota', used: 31, limit: 30, degraded: true });

    expect(await screen.findByText(QUOTA_TEXT)).toBeTruthy();
  });

  it('kota sıradan olduğunda uyarı şeridi göstermez', async () => {
    await renderChat();
    await send('merhaba');

    emit!({ type: 'quota', used: 2, limit: 30, degraded: false });

    expect(screen.queryByText(QUOTA_TEXT)).toBeNull();
  });

  it('seri bozulduğunda kırmızı ya da uyarı metni göstermez', async () => {
    await renderChat();

    expect(await screen.findByText('DEVA tanı koymaz.')).toBeTruthy();
    expect(screen.queryByText(/serin: 0 gün/i)).toBeNull();
    expect(screen.queryByText(/koptu|kaçırdın|devam etmelisin/i)).toBeNull();
  });

  it('kutlama yalnızca artışta gösterilir', async () => {
    await renderChat();
    await send('merhaba');

    await streamEvent({
      type: 'done',
      messageId: 'm-2',
      celebrate: true,
      quota: { used: 3, limit: 30, degraded: false },
    });

    expect(await screen.findByText('Bugün de buradaydın, güzel.')).toBeTruthy();
  });
});