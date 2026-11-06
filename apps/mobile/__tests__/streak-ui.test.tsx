import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import { ChatScreen } from '../components/chat/ChatScreen';
import { useStreak } from '../lib/supabase-hooks';

jest.mock('../lib/stream', () => ({
  streamChat: jest.fn(async () => undefined),
}));

jest.mock('../lib/supabase-hooks', () => {
  const actual = jest.requireActual('../lib/supabase-hooks');
  return {
    ...actual,
    useStreak: jest.fn(),
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

const useStreakMock = useStreak as jest.MockedFunction<typeof useStreak>;

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

beforeEach(() => {
  useStreakMock.mockReset();
});

describe('Seri (streak) gösterimi', () => {
  it('seri sıfırlandığında seri çipi ve uyarı metni göstermez', async () => {
    useStreakMock.mockReturnValue({
      streak: { current_streak: 0, longest_streak: 6, last_chat_date: '2026-09-20' },
      refresh: jest.fn(),
    });

    await renderChat();

    expect(await screen.findByText('DEVA tanı koymaz.')).toBeTruthy();
    expect(screen.queryByText(/Serin:/)).toBeNull();
    expect(screen.queryByText(/koptu|kaçırdın|bir daha konuş|serin bozuldu/i)).toBeNull();
  });

  it('seri sürerken yalnızca nötr çip gösterir', async () => {
    useStreakMock.mockReturnValue({
      streak: { current_streak: 5, longest_streak: 6, last_chat_date: '2026-10-03' },
      refresh: jest.fn(),
    });

    await renderChat();

    expect(await screen.findByText('Serin: 5 gün')).toBeTruthy();
    expect(screen.queryByText(/Bugün de buradaydın/)).toBeNull();
  });

  it('seri hiç yokken de ekran sakin kalır', async () => {
    useStreakMock.mockReturnValue({ streak: null, refresh: jest.fn() });

    await renderChat();

    expect(await screen.findByText('DEVA tanı koymaz.')).toBeTruthy();
    expect(screen.queryByText(/Serin:/)).toBeNull();
  });
});