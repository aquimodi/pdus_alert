import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Save, X, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface UserProfile {
  id: string;
  usuario: string;
  rol: string;
  sitios_asignados: string[] | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

const AVAILABLE_SITES = [
  'Derio', 'Zamudio', 'Cantabria DC1', 'Cantabria DC2', 'Barcelona', 'Madrid'
];

function toEmail(usuario: string): string {
  return `${usuario.toLowerCase().replace(/\s+/g, '_')}@energy.local`;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  const [formData, setFormData] = useState({
    usuario: '',
    password: '',
    rol: 'Operador' as string,
    sitios_asignados: [] as string[],
    activo: true
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setUsers(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      usuario: '',
      password: '',
      rol: 'Operador',
      sitios_asignados: [],
      activo: true
    });
    setShowCreateModal(true);
  };

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setFormData({
      usuario: user.usuario,
      password: '',
      rol: user.rol,
      sitios_asignados: user.sitios_asignados || [],
      activo: user.activo
    });
    setShowEditModal(true);
  };

  const handleDelete = async (user: UserProfile) => {
    if (!confirm(`Seguro de eliminar al usuario "${user.usuario}"?`)) return;

    try {
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (deleteError) throw deleteError;

      setSuccess('Usuario eliminado exitosamente');
      setTimeout(() => setSuccess(null), 5000);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar usuario');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const email = toEmail(formData.usuario);

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: formData.password,
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('No se pudo crear el usuario');

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: signUpData.user.id,
          usuario: formData.usuario,
          rol: formData.rol,
          sitios_asignados: formData.sitios_asignados,
          activo: true,
        });

      if (profileError) throw profileError;

      setSuccess('Usuario creado exitosamente');
      setTimeout(() => setSuccess(null), 5000);
      setShowCreateModal(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear usuario');
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUser) return;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          usuario: formData.usuario,
          rol: formData.rol,
          sitios_asignados: formData.sitios_asignados,
          activo: formData.activo,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedUser.id);

      if (updateError) throw updateError;

      setSuccess('Usuario actualizado exitosamente');
      setTimeout(() => setSuccess(null), 5000);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar usuario');
    }
  };

  const getRolBadgeColor = (rol: string) => {
    switch (rol) {
      case 'Administrador':
        return 'bg-red-100 text-red-800';
      case 'Operador':
        return 'bg-blue-100 text-blue-800';
      case 'Tecnico':
        return 'bg-green-100 text-green-800';
      case 'Observador':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 flex items-center">
          <Users className="h-6 w-6 mr-2 text-blue-600" />
          Gestion de Usuarios
        </h2>

        <button
          onClick={handleCreate}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Usuario
        </button>
      </div>

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
              <h3 className="text-sm font-medium text-green-800">Exito</h3>
              <p className="mt-1 text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Cargando usuarios...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rol
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sitios Asignados
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha Creacion
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.usuario}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRolBadgeColor(user.rol)}`}>
                      {user.rol}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.sitios_asignados && user.sitios_asignados.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.sitios_asignados.map((sitio, idx) => (
                          <span key={idx} className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded">
                            {sitio}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 italic">Todos los sitios</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      user.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-blue-600 hover:text-blue-900 mr-3"
                      title="Editar usuario"
                    >
                      <Edit2 className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar usuario"
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {users.length === 0 && (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No hay usuarios registrados</p>
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Crear Nuevo Usuario</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contrasena</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Operador">Operador</option>
                  <option value="Tecnico">Tecnico</option>
                  <option value="Observador">Observador</option>
                </select>

                <div className="mt-3 p-3 bg-gray-50 rounded-md border border-gray-200">
                  <p className="text-xs font-semibold text-gray-700 mb-2">Permisos por rol:</p>
                  <div className="space-y-2 text-xs text-gray-600">
                    <div className={`p-2 rounded ${formData.rol === 'Administrador' ? 'bg-red-50 border border-red-200' : ''}`}>
                      <span className="font-semibold text-red-700">Administrador:</span> Acceso total. Gestiona usuarios, umbrales, exporta y maneja mantenimientos.
                    </div>
                    <div className={`p-2 rounded ${formData.rol === 'Operador' ? 'bg-blue-50 border border-blue-200' : ''}`}>
                      <span className="font-semibold text-blue-700">Operador:</span> Gestiona umbrales, exporta y maneja mantenimientos.
                    </div>
                    <div className={`p-2 rounded ${formData.rol === 'Tecnico' ? 'bg-green-50 border border-green-200' : ''}`}>
                      <span className="font-semibold text-green-700">Tecnico:</span> Exporta alertas y maneja mantenimientos.
                    </div>
                    <div className={`p-2 rounded ${formData.rol === 'Observador' ? 'bg-gray-50 border border-gray-300' : ''}`}>
                      <span className="font-semibold text-gray-700">Observador:</span> Solo lectura.
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sitios Asignados</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                      <input
                        type="checkbox"
                        id="select-all-sites-create"
                        checked={formData.sitios_asignados.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, sitios_asignados: [] });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="select-all-sites-create" className="ml-2 block text-sm font-semibold text-gray-900">
                        Todos los sitios
                      </label>
                    </div>
                    {AVAILABLE_SITES.map((site) => (
                      <div key={site} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`site-create-${site}`}
                          checked={formData.sitios_asignados.includes(site)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, sitios_asignados: [...formData.sitios_asignados, site] });
                            } else {
                              setFormData({ ...formData, sitios_asignados: formData.sitios_asignados.filter(s => s !== site) });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`site-create-${site}`} className="ml-2 block text-sm text-gray-700">{site}</label>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-500">Dejar sin seleccion para dar acceso a todos los sitios</p>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 inline mr-1" />
                  Crear
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Editar Usuario</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={formData.usuario}
                  onChange={(e) => setFormData({ ...formData, usuario: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={formData.rol}
                  onChange={(e) => setFormData({ ...formData, rol: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Operador">Operador</option>
                  <option value="Tecnico">Tecnico</option>
                  <option value="Observador">Observador</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sitios Asignados</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-48 overflow-y-auto">
                  <div className="space-y-2">
                    <div className="flex items-center mb-2 pb-2 border-b border-gray-200">
                      <input
                        type="checkbox"
                        id="select-all-sites-edit"
                        checked={formData.sitios_asignados.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, sitios_asignados: [] });
                          }
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="select-all-sites-edit" className="ml-2 block text-sm font-semibold text-gray-900">
                        Todos los sitios
                      </label>
                    </div>
                    {AVAILABLE_SITES.map((site) => (
                      <div key={site} className="flex items-center">
                        <input
                          type="checkbox"
                          id={`site-edit-${site}`}
                          checked={formData.sitios_asignados.includes(site)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ ...formData, sitios_asignados: [...formData.sitios_asignados, site] });
                            } else {
                              setFormData({ ...formData, sitios_asignados: formData.sitios_asignados.filter(s => s !== site) });
                            }
                          }}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor={`site-edit-${site}`} className="ml-2 block text-sm text-gray-700">{site}</label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="activo"
                  checked={formData.activo}
                  onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="activo" className="ml-2 block text-sm text-gray-700">Usuario activo</label>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  <Save className="h-4 w-4 inline mr-1" />
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
