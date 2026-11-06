import { router, useLocalSearchParams } from 'expo-router';
import { ChatScreen } from '../../components/chat/ChatScreen';

/** Sohbet geçmişinden açılan konuşma; aktif sohbetle aynı bileşeni kullanır. */
export default function ChatConversationScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const raw = params.id;
  const conversationId = Array.isArray(raw) ? raw[0] : raw;

  return (
    <ChatScreen
      conversationId={conversationId}
      onOpenHistory={() => router.push('/chat/history')}
    />
  );
}