import { useState, useEffect, useCallback } from 'react';
import { ThresholdData } from '../types';
import { supabase } from '../utils/supabaseClient';

interface UseThresholdsOptions {
  rackId?: string;
}

interface UseThresholdsReturn {
  thresholds: ThresholdData[];
  rackSpecificThresholds: ThresholdData[];
  globalThresholds: ThresholdData[];
  loading: boolean;
  error: string | null;
  refreshThresholds: () => Promise<void>;
}

export function useThresholds(options: UseThresholdsOptions = {}): UseThresholdsReturn {
  const { rackId } = options;
  const [globalThresholds, setGlobalThresholds] = useState<ThresholdData[]>([]);
  const [rackSpecificThresholds, setRackSpecificThresholds] = useState<ThresholdData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchThresholds = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: globalData, error: globalError } = await supabase
        .from('threshold_configs')
        .select('*')
        .order('threshold_key');

      if (globalError) throw globalError;

      const globals: ThresholdData[] = (globalData || []).map(row => ({
        key: row.threshold_key,
        value: Number(row.value),
        unit: row.unit || '',
        description: row.description || '',
      }));
      setGlobalThresholds(globals);

      if (rackId) {
        const { data: overrides, error: overridesError } = await supabase
          .from('rack_threshold_overrides')
          .select('*')
          .eq('rack_id', rackId);

        if (overridesError) throw overridesError;

        const rackOverrides: ThresholdData[] = (overrides || []).map(row => ({
          key: row.threshold_key,
          value: Number(row.value),
          unit: row.unit || '',
          description: row.description || '',
        }));
        setRackSpecificThresholds(rackOverrides);
      } else {
        setRackSpecificThresholds([]);
      }
    } catch (err) {
      console.error('Error fetching thresholds:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar umbrales');
    } finally {
      setLoading(false);
    }
  }, [rackId]);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const mergedThresholds = globalThresholds.map(global => {
    const override = rackSpecificThresholds.find(r => r.key === global.key);
    return override || global;
  });

  return {
    thresholds: rackId ? mergedThresholds : globalThresholds,
    rackSpecificThresholds,
    globalThresholds,
    loading,
    error,
    refreshThresholds: fetchThresholds,
  };
}
