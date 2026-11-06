import type { Session, User } from '@supabase/supabase-js';
import { wipeUserData } from './localDb';
import { seedFacilitiesIfEmpty } from './seed';

/**
 * Yerel mod kimliği: gerçek auth devre dışıdır; her zaman oturum açmış tek bir
 * cihaz yerel kullanıcısı vardır. Onboarding'den sonra uygulama doğrudan açılır.
 */

const LOCAL_USER_ID = '00000000-0000-4000-8000-000000000001';

let localEmail = 'yerel@deva.app';

function localUser(): User {
  return {
    id: LOCAL_USER_ID,
    app_metadata: { provider: 'local' },
    user_metadata: {},
    aud: 'local',
    created_at: new Date(0).toISOString(),
    email: localEmail,
  } as unknown as User;
}

function localSession(): Session {
  return {
    access_token: 'local',
    refresh_token: 'local',
    expires_in: 3600,
    expires_at: Number.MAX_SAFE_INTEGER,
    token_type: 'bearer',
    user: localUser(),
  } as unknown as Session;
}

const listeners = new Set<(event: string, session: Session | null) => void>();

export const localAuth = {
  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    await seedFacilitiesIfEmpty();
    return { data: { session: localSession() }, error: null };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: null }> {
    return { data: { user: localUser() }, error: null };
  },

  async signOut(): Promise<{ error: null }> {
    // Yerel modda çıkış = tüm yerel veriyi silip temiz profile dönmek.
    await wipeUserData();
    await seedFacilitiesIfEmpty();
    for (const listener of listeners) listener('SIGNED_OUT', null);
    listeners.clear();
    return { error: null };
  },

  async updateUser(patch: { email?: string }): Promise<{ error: null }> {
    if (patch.email !== undefined) localEmail = patch.email;
    for (const listener of listeners) listener('USER_UPDATED', localSession());
    return { error: null };
  },
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } }; error: null } {
    listeners.add(callback);
    return {
      data: { subscription: { unsubscribe: () => listeners.delete(callback) } },
      error: null,
    };
  },
};

export const LOCAL_USER_ID_EXPORT = LOCAL_USER_ID;
