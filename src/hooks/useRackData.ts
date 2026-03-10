import { useState, useEffect } from 'react';
import { RackData } from '../types';
import { groupRacksByCountry, filterRacks } from '../utils/dataProcessing';
import { supabase } from '../utils/supabaseClient';

interface UseRackDataOptions {
  forceShowAllRacks?: boolean;
}

interface SonarError {
  error: string;
  timestamp: Date;
  alertReason?: string;
  type?: string;
}

interface UseRackDataReturn {
  racks: RackData[];
  groupedRacks: { [country: string]: { [site: string]: { [dc: string]: { [gwKey: string]: RackData[][] } } } };
  originalRackGroups: RackData[][];
  maintenanceRacks: Set<string>;
  sonarErrors: { [rackId: string]: SonarError };
  loading: boolean;
  error: string | null;
  expandedCountryIds: Set<string>;
  expandedSiteIds: Set<string>;
  expandedDcIds: Set<string>;
  expandedGwIds: Set<string>;
  activeStatusFilter: 'all' | 'critical' | 'warning' | 'normal' | 'maintenance';
  activeCountryFilter: string;
  activeSiteFilter: string;
  activeDcFilter: string;
  activeGwFilter: string;
  availableCountries: string[];
  availableSites: string[];
  availableDcs: string[];
  availableGateways: string[];
  activeMetricFilter: string;
  toggleCountryExpansion: (country: string) => void;
  toggleSiteExpansion: (site: string) => void;
  toggleDcExpansion: (dc: string) => void;
  toggleGwExpansion: (gwKey: string) => void;
  setActiveStatusFilter: (filter: 'all' | 'critical' | 'warning' | 'normal' | 'maintenance') => void;
  setActiveCountryFilter: (country: string) => void;
  setActiveSiteFilter: (site: string) => void;
  setActiveDcFilter: (dc: string) => void;
  setActiveGwFilter: (gwKey: string) => void;
  setActiveMetricFilter: (metric: string) => void;
  refreshData: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchField: string;
  setSearchField: (field: string) => void;
}

export function useRackData(options: UseRackDataOptions = {}): UseRackDataReturn {
  const { forceShowAllRacks = false } = options;
  
  const [racks, setRacks] = useState<RackData[]>([]);
  const [originalRackGroups, setOriginalRackGroups] = useState<RackData[][]>([]);
  const [maintenanceRacks, setMaintenanceRacks] = useState<Set<string>>(new Set());
  const [sonarErrors, setSonarErrors] = useState<{ [rackId: string]: SonarError }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCountryIds, setExpandedCountryIds] = useState<Set<string>>(new Set());
  const [expandedSiteIds, setExpandedSiteIds] = useState<Set<string>>(new Set());
  const [expandedDcIds, setExpandedDcIds] = useState<Set<string>>(new Set());
  const [expandedGwIds, setExpandedGwIds] = useState<Set<string>>(new Set());
  const [activeStatusFilter, setActiveStatusFilter] = useState<'all' | 'critical' | 'warning' | 'normal' | 'maintenance'>('all');
  const [activeCountryFilter, setActiveCountryFilter] = useState<string>('all');
  const [activeSiteFilter, setActiveSiteFilter] = useState<string>('all');
  const [activeDcFilter, setActiveDcFilter] = useState<string>('all');
  const [activeGwFilter, setActiveGwFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchField, setSearchField] = useState<string>('all');
  const [activeMetricFilter, setActiveMetricFilter] = useState<string>('all');

  const fetchRacks = async () => {
    try {
      setLoading(true);
      setError(null);

      const timestamp = new Date().getTime();
      const response = await fetch(`/api/racks/energy?t=${timestamp}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (response.status === 401) {
        setLoading(false);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        console.warn('API backend no disponible, mostrando sin datos de racks');
        setRacks([]);
        setOriginalRackGroups([]);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch rack data');
      }

      const currentSonarErrors = data.sonarErrors || {};
      setSonarErrors(currentSonarErrors);

      const sonarSentRacks = new Set<string>(data.sonarSentRacks || []);

      const rackGroups = Array.isArray(data.data) ? data.data : [];
      setOriginalRackGroups(rackGroups);

      const flatRacks: RackData[] = [];
      if (Array.isArray(rackGroups)) {
        rackGroups.forEach((rackGroup: RackData[]) => {
          if (Array.isArray(rackGroup)) {
            rackGroup.forEach(rack => {
              const rackId = rack.rackId || rack.id;
              if (rackId && currentSonarErrors[rackId]) {
                rack.sonarError = currentSonarErrors[rackId].error;
              }
              if (rackId && sonarSentRacks.has(rackId)) {
                rack.sonarSent = true;
              }
            });
            flatRacks.push(...rackGroup);
          }
        });
      }

      flatRacks.forEach(rack => {
        rack.country = 'Espana';
      });

      flatRacks.forEach(rack => {
        if (rack.site && rack.site.toLowerCase().includes('cantabria')) {
          rack.site = 'Cantabria';
        }
      });

      setRacks(flatRacks);
    } catch (err) {
      console.warn('Backend API no disponible:', err);
      setRacks([]);
      setOriginalRackGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceRacks = async () => {
    try {
      const { data: details, error: fetchError } = await supabase
        .from('maintenance_rack_details')
        .select('rack_id, name');

      if (fetchError) {
        console.error('Error fetching maintenance racks:', fetchError);
        return;
      }

      const maintenanceSet = new Set<string>();
      (details || []).forEach((rack) => {
        if (rack.rack_id) {
          const rackIdStr = String(rack.rack_id).trim();
          if (rackIdStr) maintenanceSet.add(rackIdStr);
        }
        if (rack.name) {
          const rackNameStr = String(rack.name).trim();
          if (rackNameStr && rackNameStr !== rack.rack_id) maintenanceSet.add(rackNameStr);
        }
      });

      setMaintenanceRacks(maintenanceSet);
    } catch (err) {
      console.error('Error fetching maintenance racks:', err);
    }
  };

  const fetchAllData = async () => {
    // Fetch both racks and maintenance data in parallel, but wait for both to complete
    await Promise.all([
      fetchRacks(),
      fetchMaintenanceRacks()
    ]);
  };

  useEffect(() => {
    // Small delay to ensure component is fully mounted and authenticated
    const initTimer = setTimeout(() => {
      fetchAllData();
    }, 100);

    // Auto-refresh after initial load - only once
    const autoRefreshTimer = setTimeout(() => {
      fetchAllData();
    }, 3000);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(autoRefreshTimer);
    };
  }, []);

  const toggleCountryExpansion = (country: string) => {
    setExpandedCountryIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(country)) {
        newSet.delete(country);
      } else {
        newSet.add(country);
      }
      return newSet;
    });
  };

  const toggleSiteExpansion = (site: string) => {
    setExpandedSiteIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(site)) {
        newSet.delete(site);
      } else {
        newSet.add(site);
      }
      return newSet;
    });
  };

  const toggleDcExpansion = (dc: string) => {
    setExpandedDcIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(dc)) {
        newSet.delete(dc);
      } else {
        newSet.add(dc);
      }
      return newSet;
    });
  };

  const toggleGwExpansion = (gwKey: string) => {
    setExpandedGwIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(gwKey)) {
        newSet.delete(gwKey);
      } else {
        newSet.add(gwKey);
      }
      return newSet;
    });
  };

  const handleStatusFilterChange = (filter: 'all' | 'critical' | 'warning') => {
    if (activeStatusFilter === filter) {
      setActiveStatusFilter('all'); // Toggle off if already active
    } else {
      setActiveStatusFilter(filter);
    }
  };

  const handleCountryFilterChange = (country: string) => {
    setActiveCountryFilter(country);
    setActiveSiteFilter('all');
    setActiveDcFilter('all');
    setActiveGwFilter('all');
  };

  const handleSiteFilterChange = (site: string) => {
    setActiveSiteFilter(site);
    setActiveDcFilter('all');
    setActiveGwFilter('all');
  };

  const handleDcFilterChange = (dc: string) => {
    setActiveDcFilter(dc);
    setActiveGwFilter('all');
  };

  const handleGwFilterChange = (gwKey: string) => {
    setActiveGwFilter(gwKey);
  };

  // Derive available filter options dynamically
  const availableCountries = Array.from(new Set(racks.map(rack => rack.country || 'N/A'))).sort();
  
  const availableSites = Array.from(new Set(
    racks
      .filter(rack => activeCountryFilter === 'all' || rack.country === activeCountryFilter)
      .map(rack => rack.site || 'N/A')
  )).sort();
  
  const availableDcs = Array.from(new Set(
    racks
      .filter(rack =>
        (activeCountryFilter === 'all' || rack.country === activeCountryFilter) &&
        (activeSiteFilter === 'all' || rack.site === activeSiteFilter)
      )
      .map(rack => rack.dc || 'N/A')
  )).sort();

  const availableGateways = Array.from(new Set(
    racks
      .filter(rack =>
        (activeCountryFilter === 'all' || rack.country === activeCountryFilter) &&
        (activeSiteFilter === 'all' || rack.site === activeSiteFilter) &&
        (activeDcFilter === 'all' || rack.dc === activeDcFilter)
      )
      .map(rack => {
        const gwName = rack.gwName || 'N/A';
        const gwIp = rack.gwIp || 'N/A';
        return `${gwName}-${gwIp}`;
      })
  )).sort();

  // Filter and group the racks
  const filteredRacks = filterRacks(
    racks,
    activeStatusFilter,
    activeCountryFilter,
    activeSiteFilter,
    activeDcFilter,
    activeGwFilter,
    searchQuery,
    searchField,
    activeMetricFilter,
    forceShowAllRacks,
    maintenanceRacks
  );
  const groupedRacks = groupRacksByCountry(filteredRacks);

  return {
    racks,
    originalRackGroups,
    maintenanceRacks,
    sonarErrors,
    groupedRacks,
    loading,
    error,
    expandedCountryIds,
    expandedSiteIds,
    expandedDcIds,
    expandedGwIds,
    activeStatusFilter,
    activeCountryFilter,
    activeSiteFilter,
    activeDcFilter,
    activeGwFilter,
    availableCountries,
    availableSites,
    availableDcs,
    availableGateways,
    toggleCountryExpansion,
    toggleSiteExpansion,
    toggleDcExpansion,
    toggleGwExpansion,
    setActiveStatusFilter: handleStatusFilterChange,
    setActiveCountryFilter: handleCountryFilterChange,
    setActiveSiteFilter: handleSiteFilterChange,
    setActiveDcFilter: handleDcFilterChange,
    setActiveGwFilter: handleGwFilterChange,
    activeMetricFilter,
    setActiveMetricFilter,
    searchQuery,
    setSearchQuery,
    searchField,
    setSearchField,
    refreshData: fetchAllData,
  };
}