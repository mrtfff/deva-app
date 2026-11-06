import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../components/ThemeProvider';
import OnboardingScreen from '../app/onboarding';

/**
 * Native Picker yerine seçilebilir düğmeler. Listeye bilerek 18 yaş altına
 * denk gelen bir yıl ekleniyor: seçim sözleşmeyi zaten engelliyor, ama
 * bileşendeki savunma hattı bu sözleşme dışı girdiye karşı da sınanmalı.
 */
jest.mock('@react-native-picker/picker', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } = jest.requireActual<typeof import('react-native')>('react-native');

  const Item = (props: { label: string; value: number }) => props;

  return {
    Picker: ({
      children,
      onValueChange,
    }: {
      children: React.ReactNode;
      onValueChange: (value: number, index: number) => void;
    }) => {
      const items = React.Children.toArray(children) as React.ReactElement<ReturnType<typeof Item>>[];
      const options = [...items.map((item) => item.props), { label: '2016', value: 2016 }];
      return (
        <View testID="birth-year-picker">
          {options.map((option, index) => (
            <Pressable
              key={String(option.value)}
              accessibilityLabel={`year-${option.value}`}
              onPress={() => onValueChange(option.value, index)}
            >
              <Text>{String(option.label)}</Text>
            </Pressable>
          ))}
        </View>
      );
    },
    PickerItem: Item,
  };
});

const currentYear = new Date().getFullYear();

async function renderOnboarding() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <AuthProvider>
        <ThemeProvider>
          <OnboardingScreen />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>,
  );
}

const continueButton = () => screen.getByRole('button', { name: 'Devam et' });

async function goToProfileStep() {
  await fireEvent.press(continueButton());
  await fireEvent.press(await screen.findByLabelText('Okudum, kabul ediyorum.'));
  await fireEvent.press(continueButton());
}

describe('Onboarding', () => {
  it('ilk adımda karşılama ve kalıcı uyarı metnini gösterir', async () => {
    await renderOnboarding();
    expect(await screen.findByText('DEVA burada seni dinlemek için var.')).toBeTruthy();
    expect(screen.getByText('DEVA tanı koymaz, tedavi yerine geçmez.')).toBeTruthy();
    expect(continueButton()).toBeEnabled();
  });

  it('uyarı onayı işaretlenmeden ilerlenemez', async () => {
    await renderOnboarding();
    await fireEvent.press(continueButton());

    expect(await screen.findByText('Okudum, kabul ediyorum.')).toBeTruthy();
    expect(continueButton()).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('Okudum, kabul ediyorum.'));
    expect(continueButton()).toBeEnabled();
  });

  it('doğum yılı seçilmeden profilden ilerlenemez', async () => {
    await renderOnboarding();
    await goToProfileStep();

    expect(await screen.findByPlaceholderText('Nasıl hitap edeyim?')).toBeTruthy();
    expect(continueButton()).toBeDisabled();
  });

  it('18 yaş altına denk gelen bir doğum yılı listede bulunmaz', async () => {
    await renderOnboarding();
    await goToProfileStep();

    // En yeni yıl 18 yaşına denk gelir; daha yeni hiçbir yıl sunulmaz.
    expect(screen.getByLabelText(`year-${currentYear - 18}`)).toBeTruthy();
    expect(screen.queryByLabelText(`year-${currentYear - 17}`)).toBeNull();
    expect(screen.queryByLabelText(`year-${currentYear - 10}`)).not.toBeNull();
  });

  it('18 yaşından küçük doğum yılını reddeder ve adımda kalır', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderOnboarding();
    await goToProfileStep();

    // Savunma hattı: sözleşme dışı (18 yaş altı) bir yıl seçilmiş gibi davran.
    await fireEvent.press(screen.getByLabelText(`year-${currentYear - 10}`));
    await fireEvent.press(continueButton());

    expect(alertSpy).toHaveBeenCalledWith(
      'DEVA 18 yaş ve üzeri kullanıcılar içindir.',
      expect.any(String),
    );
    // Hâlâ profil adımındayız.
    expect(screen.getByPlaceholderText('Nasıl hitap edeyim?')).toBeTruthy();

    alertSpy.mockRestore();
  });

  it('18 yaşına uygun doğum yılıyla bildirim adımına geçer', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    await renderOnboarding();
    await goToProfileStep();

    await fireEvent.press(screen.getByLabelText(`year-${currentYear - 30}`));
    await fireEvent.press(continueButton());

    expect(
      await screen.findByText("Her akşam sana 'nasılsın?' diye soralım mı?"),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bitir' })).toBeTruthy();
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });
});