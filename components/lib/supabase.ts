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

export const viewPdf = async (path: string) => {
  if (!path) return;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    window.open(path, '_blank');
    return;
  }
  if (!supabase) return;

  let cleanPath = path;
  if (cleanPath.startsWith('ValidationPdfs/')) {
    cleanPath = cleanPath.replace('ValidationPdfs/', '');
  } else if (cleanPath.startsWith('validation-pdfs/')) {
    cleanPath = cleanPath.replace('validation-pdfs/', '');
  }

  try {
    // Generate a cryptographically signed URL valid for 60 seconds
    const { data, error } = await supabase.storage
      .from('ValidationPdfs')
      .createSignedUrl(cleanPath, 60);

    if (error) {
      console.error('Error creating signed URL:', error);
      alert(`Could not retrieve PDF: ${error.message}`);
      return;
    }

    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  } catch (err: any) {
    console.error('Failed to view PDF:', err);
    alert('Failed to retrieve PDF document.');
  }
};

