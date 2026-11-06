import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../components/ThemeProvider';
import { Card, PrimaryButton, SectionTitle } from '../components/ui';
import { getNearbyEmergency, type EmergencyService } from '../lib/nearbyEmergency';

const TITLE = 'Yalnız değilsin';
const FINE_PRINT = "DEVA bir sağlık hizmeti değildir; acil yardım için 112'yi arayabilirsin.";
const QUERY_FAILED = "Acil servisi şu an sorgulayamadım. 112'yi arayabilirsin.";
const LOCATION_DENIED = 'Konum izni verilmediği için yakınındaki acil servisi arayamadım.';

export default function CrisisScreen() {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<EmergencyService[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const findNearby = async () => {
    setBusy(true);
    setResults(null);
    setMessage(null);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage(LOCATION_DENIED);
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearby = await getNearbyEmergency(
        position.coords.latitude,
        position.coords.longitude,
      );

      if (nearby === null) {
        setMessage(QUERY_FAILED);
        return;
      }

      setResults(nearby);
      if (nearby.length === 0) setMessage('Yakınlıkta kayıtlı bir acil servis bulunamadı.');
    } catch {
      setMessage(QUERY_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.xl },
      ]}
    >
      <Text style={{ color: theme.colors.text, fontSize: theme.type.title, fontWeight: '700' }}>
        {TITLE}
      </Text>
      <Text
        style={[
          styles.intro,
          { color: theme.colors.muted, fontSize: theme.type.body, lineHeight: theme.type.bodyLineHeight },
        ]}
      >
        Yardım hattını arayabilir ya da yakınındaki bir acil servise gidebilirsin.
      </Text>

      <View style={styles.callButtons}>
        <PrimaryButton
          theme={theme}
          label="ALO 182 — Ara"
          onPress={() => {
            void Linking.openURL('tel:182');
          }}
        />
        <PrimaryButton
          theme={theme}
          label="112 — Ara"
          onPress={() => {
            void Linking.openURL('tel:112');
          }}
        />
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <SectionTitle theme={theme}>Acil servis</SectionTitle>
        <PrimaryButton
          theme={theme}
          label="En yakın acil servisi bul"
          variant="secondary"
          busy={busy}
          onPress={() => {
            void findNearby();
          }}
        />

        {message ? (
          <Text style={[styles.resultNote, { color: theme.colors.muted, fontSize: theme.type.caption }]}>
            {message}
          </Text>
        ) : null}

        {results && results.length > 0 ? (
          <View style={styles.results}>
            {results.map((service) => (
              <Card key={service.id} theme={theme}>
                <Text style={{ color: theme.colors.text, fontSize: theme.type.body, fontWeight: '600' }}>
                  {service.name}
                </Text>
                {service.address ? (
                  <Text
                    style={{
                      color: theme.colors.muted,
                      fontSize: theme.type.caption,
                      marginTop: 4,
                    }}
                  >
                    {service.address}
                  </Text>
                ) : null}
                <Text
                  style={{ color: theme.colors.primary, fontSize: theme.type.caption, marginTop: 4 }}
                >
                  {`${service.distanceKm.toFixed(1).replace('.', ',')} km`}
                </Text>
              </Card>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: theme.spacing.xl }}>
        <PrimaryButton
          theme={theme}
          label="DEVA ile konuşmaya devam et"
          variant="secondary"
          onPress={() => router.back()}
        />
      </View>

      <Text
        style={[styles.finePrint, { color: theme.colors.muted, fontSize: theme.type.caption }]}
      >
        {FINE_PRINT}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  intro: {
    marginTop: 8,
  },
  callButtons: {
    gap: 12,
    marginTop: 24,
  },
  resultNote: {
    marginTop: 12,
    lineHeight: 18,
  },
  results: {
    gap: 12,
    marginTop: 12,
  },
  finePrint: {
    textAlign: 'center',
    marginTop: 24,
    lineHeight: 17,
  },
});