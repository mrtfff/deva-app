import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Gerçek Supabase'in yerine geçen, AsyncStorage üzerinde çalışan sorgu motoru.
 * Yalnızca uygulamanın kullandığı PostgREST alt kümesini uygular:
 * from/select/insert/update/upsert/delete + eq/in/gte/order/limit + single/maybeSingle,
 * gömülü `facilities(name)` join'i ve `nearby_facilities` / `delete_my_data` RPC'leri.
 */

export type Row = Record<string, unknown>;

const KEY_PREFIX = 'localdb:';

const TABLES = [
  'profiles',
  'user_settings',
  'conversations',
  'messages',
  'memory_notes',
  'screening_results',
  'crisis_events',
  'facilities',
  'appointments',
  'daily_usage',
  'streaks',
  'consent',
] as const;

/** Sunucu tarafında varsayılan olan sütunlar insert'te burada doldurulur. */
function withDefaults(table: string, row: Row): Row {
  const now = new Date().toISOString();
  const next = { ...row };
  if (table !== 'facilities' && next.id === undefined) next.id = uuid();
  if (table === 'conversations') {
    if (next.created_at === undefined) next.created_at = now;
    if (next.last_message_at === undefined) next.last_message_at = now;
    if (next.archived === undefined) next.archived = false;
    if (next.title === undefined) next.title = null;
  }
  if (table === 'messages' && next.created_at === undefined) next.created_at = now;
  if (table === 'screening_results' && next.completed_at === undefined) {
    next.completed_at = now;
  }
  if (table === 'memory_notes') {
    if (next.is_active === undefined) next.is_active = true;
    if (next.created_at === undefined) next.created_at = now;
    if (next.updated_at === undefined) next.updated_at = now;
  }
  if (table === 'streaks') {
    if (next.current_streak === undefined) next.current_streak = 0;
    if (next.longest_streak === undefined) next.longest_streak = 0;
    if (next.last_chat_date === undefined) next.last_chat_date = null;
  }
  if (table === 'appointments' && next.created_at === undefined) next.created_at = now;
  return next;
}

function uuid(): string {
  const hex = '0123456789abcdef';
  const part = (n: number) =>
    Array.from({ length: n }, () => hex[Math.floor(Math.random() * 16)]).join('');
  return `${part(8)}-${part(4)}-4${part(3)}-${part(4)}-${part(12)}`;
}

interface ApiResult {
  data: Row[] | Row | null;
  error: null;
}

interface Filter {
  type: 'eq' | 'in' | 'gte';
  column: string;
  value: unknown;
  values?: unknown[];
}

type Mutation =
  | { kind: 'insert' | 'upsert'; values: Row | Row[] }
  | { kind: 'update'; patch: Row }
  | { kind: 'delete' };

class Query implements PromiseLike<ApiResult> {
  #table: string;
  #filters: Filter[] = [];
  #orderColumn: string | null = null;
  #orderAscending = true;
  #limitCount: number | null = null;
  mode: 'all' | 'single' | 'maybeSingle' = 'all';
  #selectColumns: string | null = null;
  #mutation: Mutation | null = null;

  constructor(table: string) {
    this.#table = table;
  }

  select(columns?: string): this {
    this.#selectColumns = columns ?? '*';
    return this;
  }

  eq(column: string, value: unknown): this {
    this.#filters.push({ type: 'eq', column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.#filters.push({ type: 'in', column, value: undefined, values });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.#filters.push({ type: 'gte', column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.#orderColumn = column;
    this.#orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number): this {
    this.#limitCount = count;
    return this;
  }

  single(): PromiseLike<{ data: Row | null; error: null }> {
    this.mode = 'single';
    return this.#thenable() as PromiseLike<{ data: Row | null; error: null }>;
  }

  maybeSingle(): PromiseLike<{ data: Row | null; error: null }> {
    this.mode = 'maybeSingle';
    return this.#thenable() as PromiseLike<{ data: Row | null; error: null }>;
  }

  insert(values: Row | Row[]): this {
    this.#mutation = { kind: 'insert', values };
    return this;
  }

  update(patch: Row): this {
    this.#mutation = { kind: 'update', patch };
    return this;
  }

  upsert(values: Row | Row[]): this {
    this.#mutation = { kind: 'upsert', values };
    return this;
  }

  delete(): this {
    this.#mutation = { kind: 'delete' };
    return this;
  }

  #thenable(): PromiseLike<ApiResult> {
    return {
      then: <TResult1 = ApiResult, TResult2 = never>(
        onfulfilled?: ((value: ApiResult) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
      ): PromiseLike<TResult1 | TResult2> =>
        this.#resolve().then(onfulfilled, onrejected),
    };
  }

  then<TResult1 = ApiResult, TResult2 = never>(
    onfulfilled?: ((value: ApiResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.#thenable().then(onfulfilled, onrejected);
  }

  async #resolve(): Promise<ApiResult> {
    if (this.#mutation?.kind === 'insert') {
      return shape(await this.#insertRows(this.#mutation.values), this);
    }
    if (this.#mutation?.kind === 'upsert') {
      return shape(await this.#upsertRows(this.#mutation.values), this);
    }
    if (this.#mutation?.kind === 'update') {
      const patch = this.#mutation.patch;
      const table = await loadTable(this.#table);
      for (const row of table) {
        if (matches(row, this.#filters)) Object.assign(row, patch, maybeUpdatedAt(this.#table));
      }
      await saveTable(this.#table, table);
      return { data: null, error: null };
    }
    if (this.#mutation?.kind === 'delete') {
      const table = await loadTable(this.#table);
      const kept = table.filter((row) => !matches(row, this.#filters));
      await saveTable(this.#table, kept);
      return { data: null, error: null };
    }
    let rows = await loadTable(this.#table);
    rows = rows.filter((row) => matches(row, this.#filters));
    if (this.#orderColumn) {
      const column = this.#orderColumn;
      const ascending = this.#orderAscending;
      rows = [...rows].sort((a, b) => {
        const av = a[column];
        const bv = b[column];
        if (av === bv) return 0;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const result = av < bv ? -1 : 1;
        return ascending ? result : -result;
      });
    }
    if (this.#limitCount !== null) rows = rows.slice(0, this.#limitCount);
    if (this.#selectColumns?.includes('facilities(')) {
      const facilities = await loadTable('facilities');
      rows = rows.map((row) => {
        const facility = facilities.find((item) => item.id === row.facility_id);
        return { ...row, facilities: facility ? { name: facility.name } : null };
      });
    }
    return shape(rows, this);
  }

  async #insertRows(values: Row | Row[]): Promise<Row[]> {
    const rows = (Array.isArray(values) ? values : [values]).map((row) =>
      withDefaults(this.#table, row),
    );
    const table = await loadTable(this.#table);
    table.push(...rows);
    await saveTable(this.#table, table);
    return rows;
  }

  async #upsertRows(values: Row | Row[]): Promise<Row[]> {
    const incoming = Array.isArray(values) ? values : [values];
    const table = await loadTable(this.#table);
    const upserted: Row[] = [];
    for (const raw of incoming) {
      const row = withDefaults(this.#table, raw);
      // Çakışma anahtarı: id varsa id, yoksa user_id.
      const keyColumn = row.id !== undefined ? 'id' : 'user_id';
      const keyValue = row[keyColumn];
      const index =
        keyValue !== undefined
          ? table.findIndex((existing) => existing[keyColumn] === keyValue)
          : -1;
      if (index >= 0) {
        table[index] = { ...table[index], ...row, ...maybeUpdatedAt(this.#table) };
        upserted.push(table[index]);
      } else {
        table.push(row);
        upserted.push(row);
      }
    }
    await saveTable(this.#table, table);
    return upserted;
  }
}

function maybeUpdatedAt(table: string): Row {
  return table === 'profiles' || table === 'user_settings' || table === 'memory_notes'
    ? { updated_at: new Date().toISOString() }
    : {};
}

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((filter) => {
    const value = row[filter.column];
    switch (filter.type) {
      case 'eq':
        return value === filter.value;
      case 'in':
        return (filter.values ?? []).some((item) => item === value);
      case 'gte':
        return (
          typeof value === 'string' &&
          typeof filter.value === 'string' &&
          value >= filter.value
        );
    }
  });
}

function shape(rows: Row[], query: Query): ApiResult {
  if (query.mode === 'single') {
    return { data: (rows[0] as Row | undefined) ?? null, error: null };
  }
  if (query.mode === 'maybeSingle') {
    return { data: (rows[0] as Row | undefined) ?? null, error: null };
  }
  return { data: rows, error: null };
}

export async function loadTable(table: string): Promise<Row[]> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + table);
  return raw ? (JSON.parse(raw) as Row[]) : [];
}

async function saveTable(table: string, rows: Row[]): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + table, JSON.stringify(rows));
}

export async function wipeUserData(): Promise<void> {
  for (const table of TABLES) {
    if (table === 'facilities') continue;
    await AsyncStorage.removeItem(KEY_PREFIX + table);
  }
}

export function from(table: string): Query {
  return new Query(table);
}

export async function rpc(name: string, params?: Row): Promise<ApiResult> {
  if (name === 'delete_my_data') {
    await wipeUserData();
    return { data: null, error: null };
  }
  if (name === 'nearby_facilities') {
    const { nearbyFacilities } = await import('./nearby');
    const rows = await nearbyFacilities({
      lat: params?.p_lat as number,
      lng: params?.p_lng as number,
      types: (params?.p_types as string[] | null) ?? null,
      ownership: (params?.p_ownership as string | null) ?? null,
      limit: (params?.p_limit as number | undefined) ?? 50,
    });
    return { data: rows as unknown as Row[], error: null };
  }
  return { data: null, error: null };
}
