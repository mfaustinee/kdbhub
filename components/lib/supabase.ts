import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;
let initPromise: Promise<SupabaseClient | null> | null = null;

export const initSupabase = async (): Promise<SupabaseClient | null> => {
  if (supabaseInstance) return supabaseInstance;
  if ((window as any).__supabaseInstance) {
    supabaseInstance = (window as any).__supabaseInstance;
    return supabaseInstance;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      let env = (window as any)._env_;
      if (!env) {
        try {
          const res = await fetch('/api/config');
          if (res.ok) {
            env = await res.json();
            (window as any)._env_ = env;
          }
        } catch (fetchErr) {
          console.warn('[Supabase] Config fetch error:', fetchErr);
        }
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || env?.VITE_SUPABASE_URL || '';
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '';

      if (supabaseUrl && supabaseKey) {
        supabaseInstance = createClient(supabaseUrl, supabaseKey);
        (window as any).__supabaseInstance = supabaseInstance;
        console.log('[Supabase] Client initialized successfully:', supabaseUrl);
        return supabaseInstance;
      } else {
        console.warn('[Supabase] Missing credentials:', { url: !!supabaseUrl, key: !!supabaseKey });
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

