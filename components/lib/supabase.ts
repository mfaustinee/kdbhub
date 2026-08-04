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

export const viewPdf = async (pathOrIdentifier: string) => {
  if (!pathOrIdentifier) return;

  // 1. Direct URL or base64 data URI
  if (pathOrIdentifier.startsWith('http://') || pathOrIdentifier.startsWith('https://') || pathOrIdentifier.startsWith('data:')) {
    const win = window.open('', '_blank');
    if (win) {
      if (pathOrIdentifier.startsWith('data:application/pdf') || pathOrIdentifier.startsWith('data:image')) {
        win.document.write(`<iframe src="${pathOrIdentifier}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`);
      } else {
        win.location.href = pathOrIdentifier;
      }
    } else {
      window.location.href = pathOrIdentifier;
    }
    return;
  }

  if (!supabase) {
    alert('Supabase client is not initialized.');
    return;
  }

  let pdfFound = false;
  let targetPath = pathOrIdentifier
    .replace(/^(ValidationPdfs\/|validation-pdfs\/)/i, '')
    .trim();

  // 1. CHECK THE kdb_validations TABLE IN SUPABASE FIRST
  try {
    const { data: records, error: dbError } = await supabase
      .from('kdb_validations')
      .select('pdf_path, raw_data, id, premise_name, validation_period')
      .or(`pdf_path.eq.${targetPath},raw_data->>pdf_path.eq.${targetPath},raw_data->>pdfPath.eq.${targetPath},id.eq.${targetPath},premise_name.ilike.%${targetPath}%`)
      .limit(5);

    if (!dbError && records && records.length > 0) {
      for (const rec of records) {
        const raw = rec.raw_data || {};
        // Check if raw_data contains an inline base64/data URI PDF
        const inlinePdf = raw.pdf || raw.pdfData || raw.pdf_data;
        if (inlinePdf && typeof inlinePdf === 'string' && inlinePdf.startsWith('data:')) {
          pdfFound = true;
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(`<iframe src="${inlinePdf}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%; position:fixed;" allowfullscreen></iframe>`);
          } else {
            const link = document.createElement('a');
            link.href = inlinePdf;
            link.download = `${rec.premise_name || 'Validation'}_${rec.validation_period || 'Document'}.pdf`;
            link.click();
          }
          return;
        }

        // Check if table record contains a stored pdf_path for storage lookup
        const tablePdfPath = rec.pdf_path || raw.pdf_path || raw.pdfPath;
        if (tablePdfPath && typeof tablePdfPath === 'string' && !tablePdfPath.startsWith('data:')) {
          targetPath = tablePdfPath.replace(/^(ValidationPdfs\/|validation-pdfs\/)/i, '').trim();
          break;
        }
      }
    }
  } catch (err) {
    console.warn('[PDF Lookup] kdb_validations table check warning:', err);
  }

  // 2. CHECK THE STORAGE BUCKET (ValidationPdfs) IN SUPABASE
  try {
    // Attempt A: Direct signed URL request on the bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from('ValidationPdfs')
      .createSignedUrl(targetPath, 120);

    if (!signedError && signedData?.signedUrl) {
      pdfFound = true;
      window.open(signedData.signedUrl, '_blank');
      return;
    }

    // Attempt B: Search/List files in ValidationPdfs bucket to match premise or filename
    const { data: filesList, error: listError } = await supabase.storage
      .from('ValidationPdfs')
      .list('', { limit: 100 });

    if (!listError && filesList && filesList.length > 0) {
      const searchKey = targetPath.toLowerCase().replace(/[^a-z0-9]/g, '');
      const matchedFile = filesList.find((f: any) => {
        const fileNameKey = f.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        return fileNameKey.includes(searchKey) || (searchKey.length >= 4 && searchKey.includes(fileNameKey));
      });

      if (matchedFile) {
        const { data: matchedSigned, error: matchError } = await supabase.storage
          .from('ValidationPdfs')
          .createSignedUrl(matchedFile.name, 120);

        if (!matchError && matchedSigned?.signedUrl) {
          pdfFound = true;
          window.open(matchedSigned.signedUrl, '_blank');
          return;
        }
      }
    }
  } catch (err) {
    console.warn('[PDF Lookup] ValidationPdfs storage bucket check warning:', err);
  }

  if (!pdfFound) {
    alert(`Could not find PDF in either the Supabase 'kdb_validations' table or the 'ValidationPdfs' storage bucket for: "${pathOrIdentifier}"`);
  }
};

