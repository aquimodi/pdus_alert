import React, { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertTriangle, CheckCircle, Database, X, Users } from 'lucide-react';
import { ThresholdData } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';
import UserManagement from './UserManagement';

interface ThresholdManagerProps {
  thresholds: ThresholdData[];
  onSaveSuccess: () => void;
  onClose: () => void;
}

export default function ThresholdManager({ thresholds, onSaveSuccess, onClose }: ThresholdManagerProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'thresholds' | 'users'>('thresholds');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempValues, setTempValues] = useState<Record<string, number | string>>({});

  // Define supported threshold keys (must match backend validKeys)
  const supportedKeys = [
    // Temperature thresholds
    'critical_temperature_low', 'critical_temperature_high', 
    'warning_temperature_low', 'warning_temperature_high',
    // Humidity thresholds
    'critical_humidity_low', 'critical_humidity_high',
    'warning_humidity_low', 'warning_humidity_high',
    // Amperage thresholds - Single Phase
    'critical_amperage_low_single_phase', 'critical_amperage_high_single_phase',
    'warning_amperage_low_single_phase', 'warning_amperage_high_single_phase',
    // Amperage thresholds - 3-Phase
    'critical_amperage_low_3_phase', 'critical_amperage_high_3_phase',
    'warning_amperage_low_3_phase', 'warning_amperage_high_3_phase',
    // Voltage thresholds
    'critical_voltage_low', 'critical_voltage_high',
    'warning_voltage_low', 'warning_voltage_high'
  ];

  // Initialize temporary values when thresholds change
  useEffect(() => {
    // Only initialize if we don't have temp values or no thresholds
    if (Object.keys(tempValues).length === 0 || thresholds.length === 0) {
      const initialValues: Record<string, number | string> = {};
      // Only include supported threshold keys
      thresholds.forEach(threshold => {
        if (supportedKeys.includes(threshold.key)) {
          initialValues[threshold.key] = threshold.value;
        }
      });
      setTempValues(initialValues);
    }
  }, [thresholds]);

  const saveThresholds = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const filteredValues: Record<string, number> = {};
      Object.entries(tempValues).forEach(([key, value]) => {
        if (supportedKeys.includes(key)) {
          const numericValue = parseFloat(String(value));
          if (!isNaN(numericValue)) {
            filteredValues[key] = numericValue;
          }
        }
      });

      let updatedCount = 0;
      for (const [key, value] of Object.entries(filteredValues)) {
        const { error: upsertError } = await supabase
          .from('threshold_configs')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('threshold_key', key);

        if (upsertError) throw upsertError;
        updatedCount++;
      }

      setSuccess(`${updatedCount} umbrales actualizados correctamente`);
      setTimeout(() => setSuccess(null), 5000);

      setSaving(false);
      onSaveSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar los umbrales');
      setSaving(false);
    }
  };

  const handleValueChange = (key: string, value: string) => {
    setTempValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetValues = () => {
    const resetValues: Record<string, number | string> = {};
    // Only reset supported threshold keys
    thresholds.forEach(threshold => {
      if (supportedKeys.includes(threshold.key)) {
        resetValues[threshold.key] = threshold.value;
      }
    });
    setTempValues(resetValues);
    setSuccess(null);
    setError(null);
  };

  const hasChanges = () => {
    // Only check for changes in supported threshold keys
    return thresholds.some(threshold => {
      if (!supportedKeys.includes(threshold.key)) {
        return false; // Ignore unsupported keys
      }
      const tempValue = tempValues[threshold.key];
      // Convert tempValue to number for comparison
      const numericTempValue = parseFloat(String(tempValue));
      return !isNaN(numericTempValue) && numericTempValue !== threshold.value;
    });
  };

  const getThresholdLabel = (key: string) => {
    const labels: { [key: string]: string } = {
      // Temperature thresholds
      'critical_temperature_low': 'Temperatura Crítica Mínima',
      'critical_temperature_high': 'Temperatura Crítica Máxima',
      'warning_temperature_low': 'Temperatura Advertencia Mínima',
      'warning_temperature_high': 'Temperatura Advertencia Máxima',
      // Humidity thresholds
      'critical_humidity_low': 'Humedad Crítica Mínima',
      'critical_humidity_high': 'Humedad Crítica Máxima',
      'warning_humidity_low': 'Humedad Advertencia Mínima',
      'warning_humidity_high': 'Humedad Advertencia Máxima',
      // Amperage thresholds - Single Phase
      'critical_amperage_low_single_phase': 'Amperaje Crítico Mínimo (Monofásico)',
      'critical_amperage_high_single_phase': 'Amperaje Crítico Máximo (Monofásico)',
      'warning_amperage_low_single_phase': 'Amperaje Advertencia Mínimo (Monofásico)',
      'warning_amperage_high_single_phase': 'Amperaje Advertencia Máximo (Monofásico)',
      // Amperage thresholds - 3-Phase
      'critical_amperage_low_3_phase': 'Amperaje Crítico Mínimo (Trifásico)',
      'critical_amperage_high_3_phase': 'Amperaje Crítico Máximo (Trifásico)',
      'warning_amperage_low_3_phase': 'Amperaje Advertencia Mínimo (Trifásico)',
      'warning_amperage_high_3_phase': 'Amperaje Advertencia Máximo (Trifásico)',
      // Voltage thresholds
      'critical_voltage_low': 'Voltaje Crítico Mínimo',
      'critical_voltage_high': 'Voltaje Crítico Máximo',
      'warning_voltage_low': 'Voltaje Advertencia Mínimo',
      'warning_voltage_high': 'Voltaje Advertencia Máximo'
    };
    return labels[key] || key;
  };

  const getThresholdGroup = (key: string) => {
    if (key.includes('temperature')) return 'temperature';
    if (key.includes('humidity')) return 'humidity';
    if (key.includes('amperage')) return 'amperage';
    if (key.includes('voltage')) return 'voltage';
    return 'other';
  };

  const getThresholdCategory = (key: string) => {
    return key.startsWith('critical_') ? 'critical' : 'warning';
  };

  const isAdmin = user?.rol === 'Administrador';
  const isReadOnly = user?.rol === 'Observador';

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 relative">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center mb-6">
          <Settings className="h-6 w-6 mr-2 text-blue-600" />
          Configuración
        </h2>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
          title="Cerrar Configuración"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex space-x-4">
            <button
              onClick={() => setActiveTab('thresholds')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'thresholds'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Database className="h-4 w-4 inline mr-2" />
              Umbrales Generales
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Gestión de Usuarios
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {activeTab === 'users' && isAdmin ? (
        <UserManagement />
      ) : (
        <>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Umbrales Generales del Sistema
            </h3>
          </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex">
            <CheckCircle className="h-5 w-5 text-green-400 mr-2 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-green-800">Éxito</h3>
              <p className="mt-1 text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <button
            onClick={resetValues}
            disabled={!hasChanges()}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Restablecer
          </button>
        </div>

        <button
          onClick={saveThresholds}
          disabled={saving || !hasChanges() || isReadOnly}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className={`h-4 w-4 mr-2 ${saving ? 'animate-pulse' : ''}`} />
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Thresholds Grid */}
      {thresholds.length === 0 ? (
        <div className="text-center py-8">
          <Settings className="mx-auto h-8 w-8 text-gray-400" />
          <p className="mt-2 text-sm text-gray-500">No hay umbrales configurados</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Temperature Thresholds */}
          {thresholds.some(t => getThresholdGroup(t.key) === 'temperature') && (
            <div>
              <h3 className="text-lg font-semibold text-orange-700 mb-3 flex items-center">
                <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
                Umbrales de Temperatura
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {thresholds
                  .filter(threshold => getThresholdGroup(threshold.key) === 'temperature')
                  .map((threshold) => {
                    const isCritical = getThresholdCategory(threshold.key) === 'critical';
                    const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
                    const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';
                    const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';
                    const inputColor = isCritical ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500';
                    
                    return (
                      <div key={threshold.key} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                        <label className={`block text-sm font-medium ${textColor} mb-2`}>
                          {getThresholdLabel(threshold.key)}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={tempValues[threshold.key] ?? ''}
                            onChange={(e) => handleValueChange(threshold.key, e.target.value)}
                            className={`flex-1 block w-full rounded-md shadow-sm text-sm ${inputColor}`}
                            step="0.1"
                            min="0"
                            disabled={isReadOnly}
                          />
                          {threshold.unit && (
                            <span className={`text-sm font-medium ${textColor}`}>
                              {threshold.unit}
                            </span>
                          )}
                        </div>
                        {threshold.description && (
                          <p className={`mt-1 text-xs ${textColor}`}>{threshold.description}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Humidity Thresholds */}
          {thresholds.some(t => getThresholdGroup(t.key) === 'humidity') && (
            <div>
              <h3 className="text-lg font-semibold text-blue-700 mb-3 flex items-center">
                <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                Umbrales de Humedad
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {thresholds
                  .filter(threshold => getThresholdGroup(threshold.key) === 'humidity')
                  .map((threshold) => {
                    const isCritical = getThresholdCategory(threshold.key) === 'critical';
                    const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
                    const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';
                    const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';
                    const inputColor = isCritical ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500';
                    
                    return (
                      <div key={threshold.key} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                        <label className={`block text-sm font-medium ${textColor} mb-2`}>
                          {getThresholdLabel(threshold.key)}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={tempValues[threshold.key] ?? ''}
                            onChange={(e) => handleValueChange(threshold.key, e.target.value)}
                            className={`flex-1 block w-full rounded-md shadow-sm text-sm ${inputColor}`}
                            step="0.1"
                            min="0"
                            disabled={isReadOnly}
                          />
                          {threshold.unit && (
                            <span className={`text-sm font-medium ${textColor}`}>
                              {threshold.unit}
                            </span>
                          )}
                        </div>
                        {threshold.description && (
                          <p className={`mt-1 text-xs ${textColor}`}>{threshold.description}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}



          {/* Amperage Thresholds by Phase */}
          {thresholds.some(t => getThresholdGroup(t.key) === 'amperage') && (
            <div>
              <h3 className="text-lg font-semibold text-indigo-700 mb-3 flex items-center">
                <div className="w-3 h-3 bg-indigo-500 rounded-full mr-2"></div>
                Umbrales de Amperaje por Fase
              </h3>
              {['single_phase', '3_phase'].map(phase => {
                const phaseThresholds = thresholds.filter(t => 
                  getThresholdGroup(t.key) === 'amperage' && t.key.includes(`_${phase}`)
                );
                
                if (phaseThresholds.length === 0) return null;
                
                const phaseLabel = phase === 'single_phase' ? 'Monofásico (Single Phase)' : 'Trifásico (3-Phase)';
                
                return (
                  <div key={phase} className="mb-4">
                    <h4 className="text-md font-semibold text-purple-600 mb-2">
                      {phaseLabel}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {phaseThresholds.map((threshold) => {
                        const isCritical = getThresholdCategory(threshold.key) === 'critical';
                        const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
                        const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';
                        const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';
                        const inputColor = isCritical ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500';
                        
                        return (
                          <div key={threshold.key} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                            <label className={`block text-sm font-medium ${textColor} mb-2`}>
                              {getThresholdLabel(threshold.key)}
                            </label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                value={tempValues[threshold.key] ?? ''}
                                onChange={(e) => handleValueChange(threshold.key, e.target.value)}
                                className={`flex-1 block w-full rounded-md shadow-sm text-sm ${inputColor}`}
                                step="0.1"
                                min="0"
                              />
                              {threshold.unit && (
                                <span className={`text-sm font-medium ${textColor}`}>
                                  {threshold.unit}
                                </span>
                              )}
                            </div>
                            {threshold.description && (
                              <p className={`mt-1 text-xs ${textColor}`}>{threshold.description}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Voltage Thresholds */}
          {thresholds.some(t => getThresholdGroup(t.key) === 'voltage') && (
            <div>
              <h3 className="text-lg font-semibold text-green-700 mb-3 flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                Umbrales de Voltaje
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {thresholds
                  .filter(threshold => getThresholdGroup(threshold.key) === 'voltage')
                  .map((threshold) => {
                    const isCritical = getThresholdCategory(threshold.key) === 'critical';
                    const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
                    const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';
                    const textColor = isCritical ? 'text-red-800' : 'text-yellow-800';
                    const inputColor = isCritical ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-yellow-300 focus:border-yellow-500 focus:ring-yellow-500';

                    return (
                      <div key={threshold.key} className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
                        <label className={`block text-sm font-medium ${textColor} mb-2`}>
                          {getThresholdLabel(threshold.key)}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type="number"
                            value={tempValues[threshold.key] ?? ''}
                            onChange={(e) => handleValueChange(threshold.key, e.target.value)}
                            className={`flex-1 block w-full rounded-md shadow-sm text-sm ${inputColor}`}
                            step="0.1"
                            min="0"
                            disabled={isReadOnly}
                          />
                          {threshold.unit && (
                            <span className={`text-sm font-medium ${textColor}`}>
                              {threshold.unit}
                            </span>
                          )}
                        </div>
                        {threshold.description && (
                          <p className={`mt-1 text-xs ${textColor}`}>{threshold.description}</p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {!isReadOnly && hasChanges() && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            ⚠️ Hay cambios sin guardar. Haz clic en "Guardar Cambios" para aplicarlos.
          </p>
        </div>
      )}
        </>
      )}
    </div>
  );
}