import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import GuideScreen from '../app/(tabs)/guide';
import { callFunction } from '../lib/api';

jest.mock('../lib/api', () => ({
  callFunction: jest.fn(),
  deleteAllMyData: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const callFunctionMock = callFunction as jest.MockedFunction<typeof callFunction>;

const REASON = 'Konuştuğumuz şeyler psikolojik destek için uygun görünüyor; bir psikolog seninle çalışabilir.';
const SCORE_WORDS = /hafif|orta_seviye|siddetli|minimal|screening_suspect|\bskor\b|\bşiddet\b/i;

async function renderGuide() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <GuideScreen />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  callFunctionMock.mockReset();
});

describe('Yönlendirme ekranı', () => {
  it('tek uzmanı ve sıcak gerekçeyi gösterir', async () => {
    callFunctionMock.mockResolvedValue({ type: 'psychologist', reason: REASON } as never);

    await renderGuide();

    expect(await screen.findByText('Psikolog öneriyoruz')).toBeTruthy();
    expect(screen.getByText(REASON)).toBeTruthy();
    expect(callFunctionMock).toHaveBeenCalledWith('triage', { conversationId: undefined });
  });

  it('psikiyatrist önerisinde başlığı buna göre değiştirir', async () => {
    callFunctionMock.mockResolvedValue({
      type: 'psychiatrist',
      reason:
        'Son bir süredir kendine zarar düşüncesinden bahsediyorsun; bu konuda bir psikiyatrist (tıp doktoru) ile konuşmak daha doğru olur.',
    } as never);

    await renderGuide();

    expect(await screen.findByText('Psikiyatrist (tıp doktoru) öneriyoruz')).toBeTruthy();
    expect(screen.queryByText('Psikolog öneriyoruz')).toBeNull();
  });

  it('diyetisyen önerisinde başlığı buna göre değiştirir', async () => {
    callFunctionMock.mockResolvedValue({ type: 'dietitian', reason: REASON } as never);

    await renderGuide();

    expect(await screen.findByText('Diyetisyen öneriyoruz')).toBeTruthy();
  });

  it('ekranda skor ya da şiddet dili göstermez', async () => {
    callFunctionMock.mockResolvedValue({ type: 'psychologist', reason: REASON } as never);

    await renderGuide();
    await screen.findByText('Psikolog öneriyoruz');

    expect(JSON.stringify(screen.toJSON())).not.toMatch(SCORE_WORDS);
  });

  it('yönlendirme için veri yoksa sohbete davet eder', async () => {
    callFunctionMock.mockRejectedValue(new Error('network'));

    await renderGuide();

    expect(
      await screen.findByText('Yönlendirme için biraz konuşmamız gerekiyor'),
    ).toBeTruthy();
  });
});