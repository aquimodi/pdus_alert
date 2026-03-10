import { useState, useRef } from 'react';
import { X, Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabaseClient';

interface ImportSummary {
  total: number;
  successful: number;
  alreadyInMaintenance: number;
  failed: number;
  errors: Array<{
    row?: number;
    rackName?: string;
    error: string;
    type: string;
  }>;
}

interface ImportMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function ImportMaintenanceModal({ isOpen, onClose, onImportComplete }: ImportMaintenanceModalProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [defaultReason, setDefaultReason] = useState('Mantenimiento');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!isUploading) {
      setFile(null);
      setUploadComplete(false);
      setSummary(null);
      setError(null);
      setDefaultReason('Mantenimiento');
      onClose();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls'))) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Solo se permiten archivos Excel (.xlsx, .xls)');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleDownloadTemplate = async () => {
    setError('La plantilla no esta disponible en este modo.');
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      setError('La importacion Excel requiere procesamiento del lado del servidor que no esta disponible en este modo. Puede agregar entradas de mantenimiento manualmente desde el panel principal.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-slate-900">Importar Racks desde Excel</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!uploadComplete ? (
            <>
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Instrucciones:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>Descarga la plantilla Excel haciendo clic en el boton de abajo</li>
                    <li>Rellena los datos de los racks (rackName es obligatorio)</li>
                    <li>Guarda el archivo y subelo aqui</li>
                    <li>Los racks se anadiran automaticamente a mantenimiento</li>
                  </ol>
                </div>

                <button
                  onClick={handleDownloadTemplate}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Descargar Plantilla Excel
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo por defecto
                </label>
                <div className="mb-2 text-sm text-slate-600">
                  Usuario: <span className="font-medium">{user?.usuario || 'Sistema'}</span>
                </div>
                <input
                  type="text"
                  value={defaultReason}
                  onChange={(e) => setDefaultReason(e.target.value)}
                  placeholder="Mantenimiento"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={isUploading}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Se usará si no hay razón específica en el Excel
                </p>
              </div>

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-300 hover:border-slate-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />

                {file ? (
                  <div className="mb-4">
                    <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5" />
                      <span className="font-medium">{file.name}</span>
                      <button
                        onClick={() => setFile(null)}
                        className="ml-2 text-green-600 hover:text-green-800"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-slate-500 mt-2">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-slate-700 font-medium mb-2">
                      Arrastra tu archivo Excel aquí
                    </p>
                    <p className="text-slate-500 text-sm mb-4">o</p>
                  </>
                )}

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                  disabled={isUploading}
                >
                  Seleccionar Archivo
                </button>

                <p className="text-xs text-slate-500 mt-4">
                  Solo archivos Excel (.xlsx, .xls) - Máximo 5MB
                </p>
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-red-900">Error</h4>
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  disabled={isUploading}
                  className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Importar Racks
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">
                  Importación Completada
                </h3>
                <p className="text-slate-600">
                  {summary?.successful} de {summary?.total} racks añadidos a mantenimiento
                </p>
              </div>

              {summary && (
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <div className="text-2xl font-bold text-slate-900">{summary.total}</div>
                      <div className="text-sm text-slate-600">Total</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                      <div className="text-2xl font-bold text-green-700">{summary.successful}</div>
                      <div className="text-sm text-green-600">Exitosos</div>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <div className="text-2xl font-bold text-yellow-700">{summary.alreadyInMaintenance}</div>
                      <div className="text-sm text-yellow-600">Ya en mantenimiento</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <div className="text-2xl font-bold text-red-700">{summary.failed}</div>
                      <div className="text-sm text-red-600">Fallidos</div>
                    </div>
                  </div>

                  {summary.errors && summary.errors.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-semibold text-amber-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Detalles de errores ({summary.errors.length})
                      </h4>
                      <div className="max-h-60 overflow-y-auto space-y-2">
                        {summary.errors.map((err, idx) => (
                          <div key={idx} className="text-sm bg-white rounded p-3 border border-amber-200">
                            <div className="flex items-start gap-2">
                              <span className="font-medium text-amber-900">
                                {err.row ? `Fila ${err.row}` : 'Error'}:
                              </span>
                              <span className="text-amber-700">{err.error}</span>
                            </div>
                            {err.rackName && (
                              <div className="text-xs text-amber-600 mt-1">
                                Rack: {err.rackName}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
