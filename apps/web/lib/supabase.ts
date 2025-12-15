// Supabase REST API client - direct API calls, no dependencies needed
// This replaces Prisma and the Supabase client library
// Lazy load config to prevent build-time errors during module evaluation
const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.SUPABASE_PROJECT_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_PROJECT_URL ||
    '';

  // In server-side contexts (workers, API routes), prefer service role key to bypass RLS
  // Service role key bypasses RLS policies, which is needed for workers
  const isServerSide = typeof window === 'undefined';
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (isServerSide && hasServiceRoleKey) {
    // Use service role key in server context (workers, API routes)
    // This bypasses RLS policies
  }
  
  const key = (isServerSide && hasServiceRoleKey)
    ? process.env.SUPABASE_SERVICE_ROLE_KEY!
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_API_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_API_KEY ||
      '';

  return { url, key };
};



export interface SupabaseResponse<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface QueryOptions {
  select?: string;
  eq?: { column: string; value: string | number | boolean }[]; // Support multiple
  in?: { column: string; values: (string | number | boolean)[] };
  contains?: { column: string; value: unknown }[];
  gt?: { column: string; value: string | number | boolean }[];
  gte?: { column: string; value: string | number | boolean }[];
  lt?: { column: string; value: string | number | boolean }[];
  lte?: { column: string; value: string | number | boolean }[];
  order?: { column: string; ascending?: boolean };
  limit?: number;
  single?: boolean;
  upsert?: boolean;
  onConflict?: string;
  body?: unknown;
}

async function supabaseRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  table: string,
  options: QueryOptions = {}
): Promise<SupabaseResponse<T>> {
  const { url: baseUrl, key } = getSupabaseConfig();

  if (!baseUrl || !key) {
    console.error('Supabase Env Vars Missing');
    return { data: null, error: { message: 'Missing Supabase Configuration. Please check your environment variables.' } };
  }

  const url = new URL(`${baseUrl}/rest/v1/${table}`);

  if (options.select) {
    url.searchParams.set('select', options.select);
  }
  // ... (rest of the params logic is fine, we just need to update the headers usage below)

  if (options.eq) {
    options.eq.forEach(filter => {
      url.searchParams.set(`${filter.column}`, `eq.${filter.value}`);
    });
  }
  if (options.in) {
    url.searchParams.set(`${options.in.column}`, `in.(${options.in.values.join(',')})`);
  }
  if (options.contains) {
    options.contains.forEach(filter => {
      const val = Array.isArray(filter.value) ? `{${filter.value.join(',')}}` : JSON.stringify(filter.value);
      url.searchParams.set(`${filter.column}`, `cs.${val}`);
    });
  }
  if (options.gt) {
    options.gt.forEach(filter => {
      url.searchParams.set(`${filter.column}`, `gt.${filter.value}`);
    });
  }
  if (options.gte) {
    options.gte.forEach(filter => {
      url.searchParams.set(`${filter.column}`, `gte.${filter.value}`);
    });
  }
  if (options.lt) {
    options.lt.forEach(filter => {
      url.searchParams.set(`${filter.column}`, `lt.${filter.value}`);
    });
  }
  if (options.lte) {
    options.lte.forEach(filter => {
      url.searchParams.set(`${filter.column}`, `lte.${filter.value}`);
    });
  }
  if (options.order) {
    url.searchParams.set('order', `${options.order.column}.${options.order.ascending ? 'asc' : 'desc'}`);
  }
  if (options.limit) {
    url.searchParams.set('limit', options.limit.toString());
  }

  try {
    const headers: Record<string, string> = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    };

    if (options.upsert) {
      headers['Prefer'] = `resolution=merge-duplicates,return=representation${options.onConflict ? `,on_conflict=${options.onConflict}` : ''}`;
    } else if (options.single || method === 'POST' || method === 'PATCH') {
      headers['Prefer'] = 'return=representation';
    }

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return { data: null, error: { message: error.message || response.statusText, code: response.status.toString() } };
    }

    const data = await response.json();
    // If single is requested, ensure we return one item (Supabase might return array of 1)
    // But with return=representation and single=true (header?), Supabase returns object.
    // Actually header for single is `Prefer: return=representation,count=none` + `Accept: application/vnd.pgrst.object+json` usually.
    // For now we handle array/object mismatch manually if needed.
    return { data: options.single && Array.isArray(data) ? data[0] : data, error: null };
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

class SupabaseQueryBuilder<T> {
  private options: QueryOptions = {};
  private method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET';

  constructor(private table: string) { }

  select(columns = '*') {
    this.options.select = columns;
    // If method was not set (default GET), keep GET.
    // If it was POST/PATCH (insert/update), select modifies the return.
    return this;
  }

  insert(data: unknown) {
    this.method = 'POST';
    this.options.body = data;
    return this;
  }

  update(data: unknown) {
    this.method = 'PATCH';
    this.options.body = data;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  upsert(data: unknown, config?: { onConflict?: string }) {
    this.method = 'POST';
    this.options.body = data;
    this.options.upsert = true;
    this.options.onConflict = config?.onConflict;
    return this;
  }

  eq(column: string, value: string | number | boolean) {
    if (!this.options.eq) this.options.eq = [];
    this.options.eq.push({ column, value });
    return this;
  }

  in(column: string, values: (string | number | boolean)[]) {
    this.options.in = { column, values };
    return this;
  }

  contains(column: string, value: unknown) {
    if (!this.options.contains) this.options.contains = [];
    this.options.contains.push({ column, value });
    return this;
  }

  gt(column: string, value: string | number | boolean) {
    if (!this.options.gt) this.options.gt = [];
    this.options.gt.push({ column, value });
    return this;
  }

  gte(column: string, value: string | number | boolean) {
    if (!this.options.gte) this.options.gte = [];
    this.options.gte.push({ column, value });
    return this;
  }

  lt(column: string, value: string | number | boolean) {
    if (!this.options.lt) this.options.lt = [];
    this.options.lt.push({ column, value });
    return this;
  }

  lte(column: string, value: string | number | boolean) {
    if (!this.options.lte) this.options.lte = [];
    this.options.lte.push({ column, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.options.order = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(limit: number) {
    this.options.limit = limit;
    return this;
  }

  single() {
    this.options.single = true;
    return this;
  }

  // Make it thenable to await directly
  then<TResult1 = SupabaseResponse<T | T[]>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseResponse<T | T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return supabaseRequest<T | T[]>(this.method, this.table, this.options).then(onfulfilled, onrejected);
  }
}

export const supabase = {
  from: <T = any>(table: string) => new SupabaseQueryBuilder<T>(table),
};
