import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import ScreeningCodeScreen from '../app/screening/[code]';
import { callFunction } from '../lib/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() }),
  useLocalSearchParams: () => ({ code: 'PHQ9' }),
  useSegments: () => [],
}));

jest.mock('../lib/api', () => ({
  callFunction: jest.fn(),
  deleteAllMyData: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const callFunctionMock = callFunction as jest.MockedFunction<typeof callFunction>;

const SCORE_WORDS = /hafif|orta_seviye|siddetli|minimal|screening_suspect|\bskor\b/i;

async function renderScreening() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <ScreeningCodeScreen />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

/** PHQ-9'un dokuz sorusunu yanıtlar; sonuncusu isteğe bağlı olarak farklı. */
async function answerAll(lastLabel: string) {
  for (let i = 0; i < 8; i += 1) {
    await fireEvent.press(screen.getByText('Hiç değil'));
  }
  await fireEvent.press(screen.getByText(lastLabel));
  await fireEvent.press(screen.getByRole('button', { name: 'Tamamla' }));
}

beforeEach(() => {
  callFunctionMock.mockReset();
});

describe('PHQ-9 anketi', () => {
  it('dokuz soru yanıtlanınca yalnızca tamamlandı mesajını gösterir', async () => {
    callFunctionMock.mockResolvedValue({ completed: true, needsSupportCard: false } as never);

    await renderScreening();
    await answerAll('Hiç değil');

    expect(await screen.findByText('Anket tamamlandı.')).toBeTruthy();
    expect(screen.getByText('DEVA bunu sakladı.')).toBeTruthy();
    expect(callFunctionMock).toHaveBeenCalledWith('screening', {
      instrumentCode: 'PHQ9',
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    });
  });

  it('sonuç ekranında skor ya da şiddet kelimesi göstermez', async () => {
    callFunctionMock.mockResolvedValue({ completed: true, needsSupportCard: false } as never);

    await renderScreening();
    await answerAll('Hemen hemen her gün');

    await screen.findByText('Anket tamamlandı.');

    expect(screen.queryByText(SCORE_WORDS)).toBeNull();
    expect(screen.queryByText(/27/)).toBeNull();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(SCORE_WORDS);
  });

  it('dokuzuncu soru sık işaretliyse destek kartını gösterir', async () => {
    callFunctionMock.mockResolvedValue({ completed: true, needsSupportCard: true } as never);

    await renderScreening();
    await answerAll('Yarıdan fazla gün');

    expect(
      await screen.findByText('Bu soruyu işaretlemen önemli. İstersen konuşabiliriz.'),
    ).toBeTruthy();
    expect(screen.getByText('DEVA ile konuş')).toBeTruthy();
    expect(screen.getByText('Kriz ekranı')).toBeTruthy();
    expect(callFunctionMock).toHaveBeenCalledWith('screening', {
      instrumentCode: 'PHQ9',
      answers: [0, 0, 0, 0, 0, 0, 0, 0, 2],
    });
  });

  it('dokuzuncu soru yalnızca birkaç gün işaretliyse destek kartı çıkmaz', async () => {
    callFunctionMock.mockResolvedValue({ completed: true, needsSupportCard: false } as never);

    await renderScreening();
    await answerAll('Birkaç gün');

    await screen.findByText('Anket tamamlandı.');
    expect(screen.queryByText('Kriz ekranı')).toBeNull();
  });

  it('dokuzuncu soru boş bırakılırsa destek kartı çıkmaz', async () => {
    callFunctionMock.mockResolvedValue({ completed: true, needsSupportCard: false } as never);

    await renderScreening();
    await answerAll('Hiç değil');

    await screen.findByText('Anket tamamlandı.');
    expect(screen.queryByText('Kriz ekranı')).toBeNull();
  });
});