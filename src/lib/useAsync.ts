import { useCallback, useEffect, useState, type DependencyList } from "react";
import { toError } from "./api";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Tek seferlik async fetch state makinesi — panellerdeki data/loading/error +
 * load() + useEffect tekrarını ortadan kaldırır. Unmount sonrası setState'i
 * (slide-back sırasında uçuşan fetch) yok sayarak React uyarısını engeller.
 *
 * @param fn   Çağrılacak async üretici (örn. () => listSmartDisks()).
 * @param deps fn'in bağlı olduğu değerler; değişince yeniden yüklenir (varsayılan []).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // reload tetikleyicisi — deps dışı manuel yeniden yükleme için sayaç.
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => {
        if (!ignore) setData(d);
      })
      .catch((e) => {
        if (!ignore) setError(toError(e).message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
    // fn deps'e göre yeniden bağlanır; nonce manuel reload'ı tetikler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, reload };
}
