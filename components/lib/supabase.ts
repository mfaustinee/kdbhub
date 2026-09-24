import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export const createSafeSupabaseClient = (supabaseUrl: string, supabaseKey: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Provide a non-blocking lock to bypass Navigator LockManager deadlock in iframes & sandbox environments
      lock: async (_name: string, _acquireTimeout: number, fn: () => Promise<any>) => {
        return await fn();
      },
    },
    global: {
      fetch: async (url: RequestInfo | URL, options?: RequestInit) => {
        try {
          return await fetch(url, options);
        } catch (err: any) {
          console.warn(`[Supabase] Network fetch notice (${err?.message || 'offline'}). Serving fallback.`);
          return new Response(
            JSON.stringify({
              error: "Service unavailable",
              message: err?.message || "Failed to fetch",
              data: null
            }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" }
            }
          );
        }
      }
    }
  });
};

export const isSupabaseDisabled = (): boolean => {
  if (typeof window !== 'undefined') {
    const w = window as any;
    if (w.__DISABLE_SUPABASE__ === true) return true;
    if (w._env_?.SUPABASE_DISABLED === true) return true;
  }
  const envDisabled = import.meta.env.VITE_DISABLE_SUPABASE;
  if (envDisabled === 'true' || envDisabled === true) return true;
  return false;
};

export const getStoredSupabaseCredentials = (): { url: string; key: string } => {
  if (typeof window === 'undefined') return { url: '', key: '' };
  const url = localStorage.getItem('kdb_supabase_url') || localStorage.getItem('VITE_SUPABASE_URL') || '';
  const key = localStorage.getItem('kdb_supabase_anon_key') || localStorage.getItem('VITE_SUPABASE_ANON_KEY') || '';
  return { url: url.trim(), key: key.trim() };
};

export const setCustomSupabaseCredentials = (url: string, key: string): SupabaseClient | null => {
  const cleanUrl = (url || '').trim();
  const cleanKey = (key || '').trim();
  if (typeof window !== 'undefined') {
    if (cleanUrl) {
      localStorage.setItem('kdb_supabase_url', cleanUrl);
      localStorage.setItem('VITE_SUPABASE_URL', cleanUrl);
    } else {
      localStorage.removeItem('kdb_supabase_url');
      localStorage.removeItem('VITE_SUPABASE_URL');
    }
    if (cleanKey) {
      localStorage.setItem('kdb_supabase_anon_key', cleanKey);
      localStorage.setItem('VITE_SUPABASE_ANON_KEY', cleanKey);
    } else {
      localStorage.removeItem('kdb_supabase_anon_key');
      localStorage.removeItem('VITE_SUPABASE_ANON_KEY');
    }
  }

  if (cleanUrl && cleanKey) {
    supabaseInstance = createSafeSupabaseClient(cleanUrl, cleanKey);
    if (typeof window !== 'undefined') {
      (window as any).__supabaseInstance = supabaseInstance;
    }
    initPromise = Promise.resolve(supabaseInstance);
    return supabaseInstance;
  }
  supabaseInstance = null;
  initPromise = null;
  return null;
};

export const initSupabase = async (): Promise<SupabaseClient | null> => {
  if (isSupabaseDisabled()) {
    console.info('[Supabase] Running in local offline mode (zero egress). Supabase client is disabled.');
    return null;
  }

  if (supabaseInstance) return supabaseInstance;
  if (typeof window !== 'undefined' && (window as any).__supabaseInstance) {
    supabaseInstance = (window as any).__supabaseInstance;
    return supabaseInstance;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let env = typeof window !== 'undefined' ? (window as any)._env_ : null;
      if (!env && typeof fetch !== 'undefined') {
        try {
          const res = await fetch('/api/config');
          if (res.ok) {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
              env = await res.json();
              if (typeof window !== 'undefined') {
                (window as any)._env_ = env;
              }
            }
          }
        } catch (fetchErr) {
          // Expected in purely static client-only deployments
        }
      }

      if (env?.SUPABASE_DISABLED) {
        console.info('[Supabase] Server configured to local offline mode.');
        return null;
      }

      const stored = getStoredSupabaseCredentials();

      const supabaseUrl = 
        import.meta.env.VITE_SUPABASE_URL || 
        env?.VITE_SUPABASE_URL || 
        env?.SUPABASE_URL || 
        stored.url || 
        '';

      const supabaseKey = 
        import.meta.env.VITE_SUPABASE_ANON_KEY || 
        env?.VITE_SUPABASE_ANON_KEY || 
        env?.SUPABASE_ANON_KEY || 
        stored.key || 
        '';

      if (supabaseUrl && supabaseKey) {
        supabaseInstance = createSafeSupabaseClient(supabaseUrl, supabaseKey);
        if (typeof window !== 'undefined') {
          (window as any).__supabaseInstance = supabaseInstance;
        }
        console.log('[Supabase] Client initialized successfully:', supabaseUrl);
        return supabaseInstance;
      } else {
        console.warn('[Supabase] Missing credentials or Supabase disabled:', { url: !!supabaseUrl, key: !!supabaseKey });
      }
    } catch (e) {
      console.error('[Supabase] Init error:', e);
    }
    return null;
  })();

  return initPromise;
};

// Start eager initialization immediately on import
if (typeof window !== 'undefined') {
  initSupabase();
}

export const getSupabase = async (): Promise<SupabaseClient | null> => {
  if (supabaseInstance) return supabaseInstance;
  return await initSupabase();
};

export const supabase = new Proxy({}, {
  get(target, prop) {
    if (supabaseInstance) {
      const val = (supabaseInstance as any)[prop];
      return typeof val === 'function' ? val.bind(supabaseInstance) : val;
    }
    if ((window as any).__supabaseInstance) {
      supabaseInstance = (window as any).__supabaseInstance;
      const val = (supabaseInstance as any)[prop];
      return typeof val === 'function' ? val.bind(supabaseInstance) : val;
    }

    // Dynamic chainable Proxy that handles any chain until awaited
    return (...args: any[]) => {
      const createAsyncChain = (chainFn: (client: SupabaseClient) => any) => {
        const handler: any = {
          get(chainTarget: any, nextProp: string) {
            if (nextProp === 'then') {
              return (resolve: any, reject: any) => {
                getSupabase().then(client => {
                  if (!client) {
                    resolve({ data: null, error: new Error('Supabase client unavailable') });
                    return;
                  }
                  try {
                    const result = chainFn(client);
                    if (result && typeof result.then === 'function') {
                      result.then(resolve, reject);
                    } else {
                      resolve({ data: result, error: null });
                    }
                  } catch (err) {
                    reject(err);
                  }
                }).catch(reject);
              };
            }
            return (...nextArgs: any[]) => {
              return createAsyncChain((client: SupabaseClient) => {
                const intermediate = chainFn(client);
                if (intermediate && typeof intermediate[nextProp] === 'function') {
                  return intermediate[nextProp](...nextArgs);
                }
                return intermediate;
              });
            };
          }
        };
        return new Proxy({}, handler);
      };

      return createAsyncChain((client: SupabaseClient) => {
        const fn = (client as any)[prop];
        return typeof fn === 'function' ? fn.apply(client, args) : fn;
      });
    };
  }
}) as any;

export const resolvePdfUrl = async (pathOrIdentifier: string): Promise<string | null> => {
  if (!pathOrIdentifier) return null;

  // 1. Direct URL or base64 data URI
  if (pathOrIdentifier.startsWith('http://') || pathOrIdentifier.startsWith('https://') || pathOrIdentifier.startsWith('data:')) {
    return pathOrIdentifier;
  }

  const client = await getSupabase();
  if (!client) {
    return null;
  }

  let targetPath = pathOrIdentifier
    .replace(/^(validationPdfs\/|ValidationPdfs\/|validation-pdfs\/)/i, '')
    .trim();

  // 2. CHECK THE kdb_validations TABLE IN SUPABASE FIRST
  try {
    const { data: records, error: dbError } = await client
      .from('kdb_validations')
      .select('pdf_path, raw_data, id, premise_name, validation_period')
      .or(`pdf_path.eq.${targetPath},id.eq.${targetPath}`)
      .limit(5);

    if (!dbError && records && records.length > 0) {
      for (const rec of records) {
        const raw = typeof rec.raw_data === 'string' ? JSON.parse(rec.raw_data) : (rec.raw_data || {});
        const inlinePdf = raw.pdf || raw.pdfData || raw.pdf_data;
        if (inlinePdf && typeof inlinePdf === 'string' && inlinePdf.startsWith('data:')) {
          return inlinePdf;
        }
        const tablePdfPath = rec.pdf_path || raw.pdf_path || raw.pdfPath;
        if (tablePdfPath && typeof tablePdfPath === 'string' && !tablePdfPath.startsWith('data:')) {
          targetPath = tablePdfPath.replace(/^(validationPdfs\/|ValidationPdfs\/|validation-pdfs\/)/i, '').trim();
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[PDF Lookup] kdb_validations table check warning:', err);
  }

  // 3. CHECK STORAGE BUCKETS (ValidationPdfs / validation-pdfs) IN SUPABASE
  for (const bucketName of ['ValidationPdfs', 'validationPdfs', 'validation-pdfs']) {
    try {
      const { data: signedData, error: signedError } = await client.storage
        .from(bucketName)
        .createSignedUrl(targetPath, 3600);

      if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
      }

      const { data: publicData } = client.storage
        .from(bucketName)
        .getPublicUrl(targetPath);

      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
    } catch (err) {
      // Continue to next bucket
    }
  }

  return null;
};

export const viewPdf = async (pathOrIdentifier: string) => {
  if (!pathOrIdentifier) return;
  const resolved = await resolvePdfUrl(pathOrIdentifier);
  if (resolved) {
    const win = window.open('', '_blank');
    if (win) {
      if (resolved.startsWith('data:application/pdf') || resolved.startsWith('data:image')) {
        win.document.write(`<iframe src="${resolved}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`);
      } else {
        win.location.href = resolved;
      }
    } else {
      window.location.href = resolved;
    }
  } else {
    alert(`Could not find PDF in either the Supabase 'kdb_validations' table or the 'ValidationPdfs' storage bucket for: "${pathOrIdentifier}"`);
  }
};

