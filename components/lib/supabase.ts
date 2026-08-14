import { createClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

const getSupabaseInstance = () => {
  if (supabaseInstance) return supabaseInstance;
  if ((window as any).__supabaseInstance) {
    supabaseInstance = (window as any).__supabaseInstance;
    return supabaseInstance;
  }

  const env = (window as any)._env_ || {};
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL || '';
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || '';

  if (supabaseUrl && supabaseKey) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey);
      (window as any).__supabaseInstance = supabaseInstance;
    } catch (e) {
      console.error("[Supabase Proxy] Init error:", e);
    }
  }
  return supabaseInstance;
};

export const supabase = new Proxy({}, {
  get(target, prop) {
    const instance = getSupabaseInstance();
    if (!instance) {
      // If supabase is not yet configured, return a dummy function/object to prevent crashing
      return (...args: any[]) => {
        const nextInstance = getSupabaseInstance();
        if (nextInstance && typeof nextInstance[prop] === 'function') {
          return nextInstance[prop](...args);
        }
        return {
          from: () => ({
            select: () => ({
              ilike: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null })
                })
              }),
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [], error: null })
                })
              })
            })
          }),
          storage: {
            from: () => ({
              upload: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') }),
              createSignedUrl: () => Promise.resolve({ data: null, error: new Error('Supabase not configured') })
            })
          }
        };
      };
    }
    const value = instance[prop];
    if (typeof value === 'function') {
      return value.bind(instance);
    }
    return value;
  }
}) as any;

export const resolvePdfUrl = async (pathOrIdentifier: string): Promise<string | null> => {
  if (!pathOrIdentifier) return null;

  // 1. Direct URL or base64 data URI
  if (pathOrIdentifier.startsWith('http://') || pathOrIdentifier.startsWith('https://') || pathOrIdentifier.startsWith('data:')) {
    return pathOrIdentifier;
  }

  if (!supabase) {
    return null;
  }

  let targetPath = pathOrIdentifier
    .replace(/^(validationPdfs\/|ValidationPdfs\/|validation-pdfs\/)/i, '')
    .trim();

  // 2. CHECK THE kdb_validations TABLE IN SUPABASE FIRST
  try {
    // Exact match lookup first to avoid PostgREST syntax errors with spaces/special characters
    const { data: records, error: dbError } = await supabase
      .from('kdb_validations')
      .select('pdf_path, raw_data, id, premise_name, validation_period')
      .eq('pdf_path', targetPath)
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

  // 3. CHECK STORAGE BUCKETS (validationPdfs / ValidationPdfs) IN SUPABASE
  for (const bucketName of ['validationPdfs', 'ValidationPdfs', 'validation-pdfs']) {
    try {
      const { data: signedData, error: signedError } = await supabase.storage
        .from(bucketName)
        .createSignedUrl(targetPath, 3600);

      if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
      }

      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(targetPath);

      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }

      const { data: filesList, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 100 });

      if (!listError && filesList && filesList.length > 0) {
        const searchKey = targetPath.toLowerCase().replace(/[^a-z0-9]/g, '');
        const matchedFile = filesList.find((f: any) => {
          const fileNameKey = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          return fileNameKey.includes(searchKey) || (searchKey.length >= 4 && searchKey.includes(fileNameKey));
        });

        if (matchedFile) {
          const { data: matchedSigned, error: matchError } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(matchedFile.name, 3600);

          if (!matchError && matchedSigned?.signedUrl) {
            return matchedSigned.signedUrl;
          }
        }
      }
    } catch (err) {
      console.warn(`[PDF Lookup] ${bucketName} storage bucket check warning:`, err);
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

