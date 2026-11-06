import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import ProfileScreen from '../app/(tabs)/profile';
import { deleteAllMyData } from '../lib/api';
import { cancelAllNotifications } from '../lib/notifications';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() },
  useRouter: () => jest.requireMock('expo-router').router,
  useLocalSearchParams: () => ({}),
  useSegments: () => [],
}));

const mockRouter = jest.requireMock('expo-router').router as {
  push: jest.Mock;
  replace: jest.Mock;
};

jest.mock('../lib/api', () => ({
  callFunction: jest.fn(),
  deleteAllMyData: jest.fn(async () => undefined),
  ApiError: class ApiError extends Error {},
}));

jest.mock('../lib/notifications', () => ({
  cancelAllNotifications: jest.fn(async () => undefined),
  syncAllNotifications: jest.fn(async () => undefined),
}));

const deleteMock = deleteAllMyData as jest.MockedFunction<typeof deleteAllMyData>;
const cancelAllMock = cancelAllNotifications as jest.MockedFunction<
  typeof cancelAllNotifications
>;

async function renderProfile() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <ProfileScreen />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

/** Onay penceresindeki "Sil" düğmesini çalıştırır. */
async function confirmDelete(alertSpy: jest.SpyInstance) {
  const [, , actions] = alertSpy.mock.calls.at(-1) as unknown as [
    string,
    string,
    { text: string; onPress?: () => void }[],
  ];
  const destructive = actions.find((action) => action.text === 'Sil');
  expect(destructive).toBeDefined();
  await act(async () => {
    destructive!.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  deleteMock.mockResolvedValue(undefined);
  cancelAllMock.mockResolvedValue(undefined);
});

describe('Veri silme', () => {
  it('onay penceresini geri alınamaz uyarısıyla açar', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderProfile();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tüm verilerimi sil' }));

    expect(alertSpy).toHaveBeenCalledWith(
      'Tüm verilerini sil',
      expect.stringContaining('geri alınamaz'),
      expect.any(Array),
    );
    expect(deleteMock).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('onaylandığında RPC, bildirim temizliği ve çıkışı sırayla yapar', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const order: string[] = [];
    deleteMock.mockImplementation(async () => {
      order.push('rpc');
    });
    cancelAllMock.mockImplementation(async () => {
      order.push('notifications');
    });

    await renderProfile();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tüm verilerimi sil' }));
    await confirmDelete(alertSpy);

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(cancelAllMock).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['rpc', 'notifications']);
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');

    alertSpy.mockRestore();
  });

  it('RPC başarısız olursa çıkış yapmaz', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    deleteMock.mockRejectedValue(new Error('rpc_failed'));

    await renderProfile();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tüm verilerimi sil' }));
    await confirmDelete(alertSpy);

    expect(cancelAllMock).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalledWith('/onboarding');

    alertSpy.mockRestore();
  });
});