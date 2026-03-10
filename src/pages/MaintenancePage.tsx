import { useState, useEffect } from 'react';
import { Wrench, Calendar, User, MapPin, Server, AlertCircle, X, Trash2, ChevronDown, ChevronUp, Upload, XCircle, Download } from 'lucide-react';
import ImportMaintenanceModal from '../components/ImportMaintenanceModal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

interface RackDetail {
  rack_id: string;
  name: string;
  country: string;
  site: string;
  dc: string;
  phase: string;
  chain: string;
  node: string;
  gwName?: string;
  gwIp?: string;
}

interface MaintenanceEntry {
  id: string;
  entry_type: 'individual_rack' | 'chain';
  rack_id: string | null;
  chain: string | null;
  site: string | null;
  dc: string;
  reason: string;
  user: string;
  started_at: string;
  started_by: string;
  created_at: string;
  racks: RackDetail[];
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const [maintenanceEntries, setMaintenanceEntries] = useState<MaintenanceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingEntryId, setRemovingEntryId] = useState<string | null>(null);
  const [removingRackId, setRemovingRackId] = useState<string | null>(null);
  const [removingAll, setRemovingAll] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleDownloadTemplate = async () => {
    try {
      setDownloadingTemplate(true);
      alert('La plantilla de importacion no esta disponible en este modo. Use la funcion de importacion directa.');
    } catch (err) {
      console.error('Error downloading template:', err);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Check if user can finish maintenance for a specific site
  const canUserFinishMaintenance = (siteName: string | null | undefined): boolean => {
    if (!siteName) return false;

    // Administrators have access to all sites
    if (user?.rol === 'Administrador') {
      return true;
    }

    if (!user?.sitios_asignados || user.sitios_asignados.length === 0) {
      return true; // No restrictions
    }

    // Check if user has direct access
    if (user.sitios_asignados.includes(siteName)) {
      return true;
    }

    // Check if this is a Cantabria site and user has any Cantabria access
    const normalizedSite = siteName.toLowerCase().includes('cantabria') ? 'Cantabria' : siteName;
    if (normalizedSite === 'Cantabria') {
      return user.sitios_asignados.some(assignedSite =>
        assignedSite.toLowerCase().includes('cantabria')
      );
    }

    return false;
  };

  const toggleExpanded = (entryId: string) => {
    setExpandedEntries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entryId)) {
        newSet.delete(entryId);
      } else {
        newSet.add(entryId);
      }
      return newSet;
    });
  };

  const fetchMaintenanceEntries = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: entries, error: fetchError } = await supabase
        .from('maintenance_entries')
        .select('*')
        .order('started_at', { ascending: false });

      if (fetchError) throw fetchError;

      const entriesWithRacks: MaintenanceEntry[] = [];
      for (const entry of entries || []) {
        const { data: racks } = await supabase
          .from('maintenance_rack_details')
          .select('*')
          .eq('entry_id', entry.id);

        entriesWithRacks.push({
          id: entry.id,
          entry_type: entry.entry_type,
          rack_id: entry.rack_id,
          chain: entry.chain,
          site: entry.site,
          dc: entry.dc,
          reason: entry.reason,
          user: entry.started_by,
          started_at: entry.started_at,
          started_by: entry.started_by,
          created_at: entry.created_at,
          racks: (racks || []).map(r => ({
            rack_id: r.rack_id,
            name: r.name,
            country: r.country,
            site: r.site,
            dc: r.dc,
            phase: r.phase,
            chain: r.chain,
            node: r.node,
            gwName: r.gw_name,
            gwIp: r.gw_ip,
          })),
        });
      }

      setMaintenanceEntries(entriesWithRacks);
    } catch (err) {
      console.error('Error fetching maintenance entries:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaintenanceEntries();

    const interval = setInterval(fetchMaintenanceEntries, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoveEntry = async (entryId: string, entryType: string, identifier: string, entrySite?: string) => {
    // Check if user has permission
    if (user?.rol === 'Observador') {
      alert('No tienes permisos para finalizar mantenimientos.');
      return;
    }

    const confirmMessage = entryType === 'chain'
      ? `¿Seguro que quieres sacar toda la chain "${identifier}" de mantenimiento?`
      : `¿Seguro que quieres sacar el rack "${identifier}" de mantenimiento?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setRemovingEntryId(entryId);

      const { error: deleteError } = await supabase
        .from('maintenance_entries')
        .delete()
        .eq('id', entryId);

      if (deleteError) throw deleteError;

      await fetchMaintenanceEntries();
    } catch (err) {
      console.error('Error removing entry from maintenance:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRemovingEntryId(null);
    }
  };

  const handleRemoveIndividualRack = async (rackId: string, entryType: string, rackSite?: string) => {
    // Check if user has permission
    if (user?.rol === 'Observador') {
      alert('No tienes permisos para finalizar mantenimientos.');
      return;
    }

    const confirmMessage = entryType === 'chain'
      ? `¿Seguro que quieres sacar solo este rack "${rackId}" de mantenimiento? (La chain seguirá en mantenimiento)`
      : `¿Seguro que quieres sacar el rack "${rackId}" de mantenimiento?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setRemovingRackId(rackId);

      const { error: deleteError } = await supabase
        .from('maintenance_rack_details')
        .delete()
        .eq('rack_id', rackId);

      if (deleteError) throw deleteError;

      await fetchMaintenanceEntries();
    } catch (err) {
      console.error('Error removing rack from maintenance:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRemovingRackId(null);
    }
  };

  const handleRemoveAll = async () => {
    // Check if user has permission
    if (user?.rol === 'Observador') {
      alert('No tienes permisos para finalizar mantenimientos.');
      return;
    }

    if (maintenanceEntries.length === 0) {
      return;
    }

    const confirmMessage = `¿Estás COMPLETAMENTE SEGURO de que quieres sacar TODOS los ${totalRacks} racks de mantenimiento?\n\nEsta acción eliminará ${maintenanceEntries.length} ${maintenanceEntries.length === 1 ? 'entrada' : 'entradas'} de mantenimiento y no se puede deshacer.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    // Double confirmation for safety
    if (!confirm('Última confirmación: ¿Realmente deseas eliminar TODAS las entradas de mantenimiento?')) {
      return;
    }

    try {
      setRemovingAll(true);

      const { error: deleteError } = await supabase
        .from('maintenance_entries')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      alert('Todas las entradas de mantenimiento han sido eliminadas');
      await fetchMaintenanceEntries();
    } catch (err) {
      console.error('Error removing all maintenance entries:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setRemovingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-red-600" />
              <div>
                <h3 className="font-semibold text-red-900">Error al cargar datos</h3>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No filtering - show all maintenance entries
  const filteredMaintenanceEntries = maintenanceEntries;

  // Count UNIQUE physical racks across all maintenance entries
  // Multiple entries can have the same rack_id, so we use a Set to ensure uniqueness
  // This matches the counting logic used in the main dashboard (App.tsx)
  const uniqueRackIds = new Set<string>();
  let totalRackRecords = 0;

  filteredMaintenanceEntries.forEach(entry => {
    entry.racks.forEach(rack => {
      totalRackRecords++;
      if (rack.rack_id) {
        const rackIdStr = String(rack.rack_id).trim();
        if (rackIdStr) {
          uniqueRackIds.add(rackIdStr);
        }
      }
    });
  });

  const totalRacks = uniqueRackIds.size;

  // Debug logging
  console.log('🔍 Maintenance Page Rack Count:', {
    entries: filteredMaintenanceEntries.length,
    totalRackRecords,
    uniqueRacks: totalRacks,
    sampleRackIds: Array.from(uniqueRackIds).slice(0, 5)
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Wrench className="w-8 h-8 text-amber-600" />
              <h1 className="text-3xl font-bold text-slate-900">Modo Mantenimiento</h1>
            </div>
            <div className="flex items-center gap-3">
              {maintenanceEntries.length > 0 && user?.rol !== 'Observador' && (
                <button
                  onClick={handleRemoveAll}
                  disabled={removingAll}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Sacar todos los racks de mantenimiento"
                >
                  {removingAll ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      Finalizar Todo
                    </>
                  )}
                </button>
              )}
              <button
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descargar plantilla Excel para importar racks"
              >
                {downloadingTemplate ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    Descargando...
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    Plantilla
                  </>
                )}
              </button>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Upload className="w-5 h-5" />
                Importar desde Excel
              </button>
            </div>
          </div>
          <p className="text-slate-600">
            Equipos actualmente en mantenimiento (no generan alertas)
          </p>

          {/* Info banner for users with site restrictions (not for Administrators) */}
          {user?.rol !== 'Administrador' && user?.sitios_asignados && user.sitios_asignados.length > 0 && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">Permisos de Mantenimiento</p>
                  <p>
                    Puedes ver <strong>todos los equipos en mantenimiento</strong> del sistema. El filtro se inicia en tus sitios asignados:{' '}
                    <span className="font-semibold">{user.sitios_asignados.join(', ')}</span>, pero puedes cambiar los filtros para ver otros sitios.
                  </p>
                  <p className="mt-2 text-blue-700">
                    Solo puedes <strong>finalizar mantenimientos</strong> de equipos pertenecientes a tus sitios asignados.
                  </p>
                </div>
              </div>
            </div>
          )}

          {maintenanceEntries.length > 0 && (
            <div className="mt-4 flex gap-6 text-sm">
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-900">{filteredMaintenanceEntries.length}</span>
                <span className="text-slate-600 ml-2">
                  {filteredMaintenanceEntries.length === 1 ? 'entrada' : 'entradas'} de mantenimiento
                </span>
              </div>
              <div className="bg-white px-4 py-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-900">{totalRacks}</span>
                <span className="text-slate-600 ml-2">
                  {totalRacks === 1 ? 'rack' : 'racks'} en total
                </span>
              </div>
            </div>
          )}
        </div>

        {filteredMaintenanceEntries.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center">
            <Wrench className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">
              No hay equipos en mantenimiento
            </h3>
            <p className="text-slate-500">
              Todos los equipos están activos y generando alertas normalmente
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredMaintenanceEntries.map(entry => {
              const isChainEntry = entry.entry_type === 'chain';
              // For individual racks, use the rack name from the first rack detail if available
              const rackName = !isChainEntry && entry.racks.length > 0
                ? (entry.racks[0].name || entry.rack_id)
                : entry.rack_id;
              const displayTitle = isChainEntry
                ? `Chain ${entry.chain} - Sala ${entry.dc}`
                : rackName;

              const bgColor = isChainEntry ? 'from-amber-50 to-amber-100 border-amber-200' : 'from-blue-50 to-blue-100 border-blue-200';
              const iconColor = isChainEntry ? 'text-amber-700' : 'text-blue-700';
              const textColor = isChainEntry ? 'text-amber-900' : 'text-blue-900';
              const isExpanded = expandedEntries.has(entry.id);

              // Check if user can finish this maintenance entry
              const canFinishMaintenance = canUserFinishMaintenance(entry.site);

              return (
                <div
                  key={entry.id}
                  className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                >
                  <div
                    className={`bg-gradient-to-r ${bgColor} border-b p-6 cursor-pointer transition-colors ${
                      isChainEntry
                        ? 'hover:from-amber-100 hover:to-amber-150'
                        : 'hover:from-blue-100 hover:to-blue-150'
                    }`}
                    onClick={() => toggleExpanded(entry.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Server className={`w-6 h-6 ${iconColor}`} />
                          <h2 className={`text-2xl font-bold ${textColor}`}>
                            {displayTitle}
                          </h2>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            isChainEntry
                              ? 'bg-amber-200 text-amber-800'
                              : 'bg-blue-200 text-blue-800'
                          }`}>
                            {isChainEntry ? 'Chain Completa' : 'Rack Individual'}
                          </span>
                          <div className={`ml-2 p-2 rounded-lg ${iconColor}`}>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5" />
                            ) : (
                              <ChevronDown className="w-5 h-5" />
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          {(() => {
                            const rackData = entry.racks.length > 0 ? entry.racks[0] : null;
                            const isValidValue = (val: string | null | undefined) => val && val !== 'unknown' && val !== 'Unknown' && val.trim() !== '';
                            const displaySite = isValidValue(rackData?.site) ? rackData?.site : (isValidValue(entry.site) ? entry.site : null);
                            const displayDc = isValidValue(rackData?.dc) ? rackData?.dc : (isValidValue(entry.dc) ? entry.dc : null);
                            return (
                              <>
                                {displaySite && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <MapPin className={`w-4 h-4 ${iconColor}`} />
                                    <span className="font-medium">Sitio:</span>
                                    <span>{displaySite}</span>
                                  </div>
                                )}
                                {displayDc && (
                                  <div className="flex items-center gap-2 text-slate-700">
                                    <Server className={`w-4 h-4 ${iconColor}`} />
                                    <span className="font-medium">Sala:</span>
                                    <span>{displayDc}</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {isChainEntry && (
                            <div className="flex items-center gap-2 text-slate-700">
                              <Server className={`w-4 h-4 ${iconColor}`} />
                              <span className="font-medium">Chain:</span>
                              <span>{entry.chain}</span>
                            </div>
                          )}
                        </div>

                        {!isChainEntry && entry.racks.length > 0 && (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            {entry.racks[0].gwName && entry.racks[0].gwName !== 'N/A' && (
                              <div className="flex items-center gap-2 text-slate-700">
                                <Server className={`w-4 h-4 ${iconColor}`} />
                                <span className="font-medium">Gateway:</span>
                                <span>{entry.racks[0].gwName}</span>
                              </div>
                            )}
                            {entry.racks[0].gwIp && entry.racks[0].gwIp !== 'N/A' && (
                              <div className="flex items-center gap-2 text-slate-700">
                                <Server className={`w-4 h-4 ${iconColor}`} />
                                <span className="font-medium">IP Gateway:</span>
                                <span>{entry.racks[0].gwIp}</span>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="mt-4 space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-600">
                            <Calendar className="w-4 h-4" />
                            <span className="font-medium">Inicio:</span>
                            <span>{new Date(entry.started_at).toLocaleString('es-ES')}</span>
                          </div>

                          {entry.user && (
                            <div className="flex items-center gap-2 text-slate-600">
                              <User className="w-4 h-4" />
                              <span className="font-medium">Usuario:</span>
                              <span>{entry.user}</span>
                            </div>
                          )}

                          {entry.reason && (
                            <div className="flex items-start gap-2 text-slate-700">
                              <AlertCircle className="w-4 h-4 mt-0.5" />
                              <div>
                                <span className="font-medium">Razón:</span> {entry.reason}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {user?.rol !== 'Observador' && canFinishMaintenance && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveEntry(
                              entry.id,
                              entry.entry_type,
                              isChainEntry ? `${entry.chain} (Sala ${entry.dc})` : entry.rack_id || '',
                              entry.site || undefined
                            );
                          }}
                          disabled={removingEntryId === entry.id}
                          className="ml-4 px-4 py-2 font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white"
                        >
                          {removingEntryId === entry.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                              Procesando...
                            </>
                          ) : (
                            <>
                              <Wrench className="w-4 h-4" />
                              Finalizar Mantenimiento
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-6">
                      <h3 className="font-semibold text-slate-900 mb-4">
                        {isChainEntry ? `Racks en esta chain (${entry.racks.length})` : 'Detalle del Rack'}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {entry.racks.map(rack => {
                          // Check if user can finish this specific rack's maintenance
                          const canFinishRackMaintenance = canUserFinishMaintenance(rack.site);

                          return (
                        <div
                          key={rack.rack_id}
                          className="border border-slate-200 rounded-lg p-4 bg-slate-50 relative group"
                        >
                          {isChainEntry && user?.rol !== 'Observador' && canFinishRackMaintenance && (
                            <button
                              onClick={() => handleRemoveIndividualRack(rack.rack_id, entry.entry_type, rack.site)}
                              disabled={removingRackId === rack.rack_id}
                              className="absolute top-2 right-2 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 bg-red-100 hover:bg-red-200 text-red-700"
                              title="Sacar solo este rack de mantenimiento"
                            >
                              {removingRackId === rack.rack_id ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-700 border-t-transparent"></div>
                              ) : (
                                <X className="w-4 h-4" />
                              )}
                            </button>
                          )}

                          <div className="font-medium text-slate-900 mb-2">
                            {rack.name || rack.rack_id}
                          </div>
                          <div className="space-y-1 text-sm text-slate-600">
                            <div>
                              <span className="font-medium">Rack ID:</span> {rack.rack_id}
                            </div>
                            {rack.country && (
                              <div>
                                <span className="font-medium">País:</span> España
                              </div>
                            )}
                            {rack.site && (
                              <div>
                                <span className="font-medium">Sitio:</span> {rack.site}
                              </div>
                            )}
                            {rack.dc && (
                              <div>
                                <span className="font-medium">Sala:</span> {rack.dc}
                              </div>
                            )}
                            {rack.chain && (
                              <div>
                                <span className="font-medium">Chain:</span> {rack.chain}
                              </div>
                            )}
                            {rack.phase && (
                              <div>
                                <span className="font-medium">Fase:</span> {rack.phase}
                              </div>
                            )}
                            {rack.node && (
                              <div>
                                <span className="font-medium">Node:</span> {rack.node}
                              </div>
                            )}
                          </div>
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <ImportMaintenanceModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onImportComplete={() => {
            fetchMaintenanceEntries();
          }}
        />
      </div>
    </div>
  );
}
