import { router } from 'expo-router';
import { ChatScreen } from '../../components/chat/ChatScreen';

/**
 * Sohbet sekmesi. Aktif konuşmanın kendisi burada tutulur; geçmişten açılan
 * sohbet `app/chat/[id].tsx` ile aynı bileşeni kullanır.
 */
export default function ChatTab() {
  return <ChatScreen onOpenHistory={() => router.push('/chat/history')} />;
}