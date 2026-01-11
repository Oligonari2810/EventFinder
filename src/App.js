import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Calendar as CalendarIcon,
  MapPin,
  Loader2,
  Star,
  Trash2,
  RefreshCw,
  Bell,
  StickyNote,
  Users,
  PlusCircle,
  Download,
  Upload,
  CalendarDays,
  CheckCircle,
  XCircle,
  HelpCircle,
  History as HistoryIcon,
} from 'lucide-react';

/**
 * EventFinderEnhanced extends the simple event search app with a number of
 * personal‑organiser features. Users can search for upcoming events in
 * Turks and Caicos, save them to their personal agenda, annotate them with
 * notes, statuses and contacts, set reminders, view a simple calendar
 * grouping, enable automatic searches on a schedule and import/export
 * their agenda. The implementation relies only on React state and
 * standard browser APIs – no additional dependencies are required.
 */
export default function EventFinderEnhanced() {
  // core search state
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('todos');

  // agenda state
  const [savedEvents, setSavedEvents] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('search'); // search, saved, calendar, history

  // event types, including custom categories
  const [eventTypes, setEventTypes] = useState([
    { id: 'todos', label: 'Todos los Eventos' },
    { id: 'sociales', label: 'Eventos Sociales' },
    { id: 'culturales', label: 'Culturales/Arte' },
    { id: 'deportivos', label: 'Deportivos' },
    { id: 'gastronomicos', label: 'Gastronómicos' },
    { id: 'musicales', label: 'Música/Conciertos' },
    { id: 'negocios', label: 'Networking/Negocios' },
  ]);
  const [newCategory, setNewCategory] = useState('');

  // automatic search state
  const [autoSearchEnabled, setAutoSearchEnabled] = useState(false);
  const [autoSearchInterval, setAutoSearchInterval] = useState(0); // minutes
  const autoSearchRef = useRef(null);

  // helper: parse a date string of the form DD/MM/YYYY and return a Date
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    // take first date in case of ranges
    const part = dateStr.split(/\s*-\s*/)[0];
    const [day, month, year] = part.split('/');
    if (!day || !month || !year) return null;
    return new Date(`${year}-${month}-${day}`);
  };

  // search events from API
  const searchEvents = async () => {
    setLoading(true);
    try {
      const typeQuery = searchType === 'todos' ? 'eventos' : `eventos ${searchType}`;
      // make request to the user’s model (we cannot include API keys; this is conceptual)
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `Busca información actualizada sobre ${typeQuery} en Turks and Caicos para las próximas 2-4 semanas. Incluye fechas, lugares, descripciones breves y cómo participar. Formatea la respuesta SOLO como JSON válido con este formato exacto (sin texto adicional, sin preamble, sin markdown): [ { "titulo": "Nombre del evento", "fecha": "DD/MM/YYYY o rango de fechas", "ubicacion": "Lugar específico", "tipo": "social/cultural/deportivo/etc", "descripcion": "Descripción breve", "fuente": "De dónde obtuviste la info" } ]`,
            },
          ],
          tools: [
            {
              type: 'web_search_20250305',
              name: 'web_search',
            },
          ],
        }),
      });
      const data = await response.json();
      const textContent = data.content
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join('\n');
      let cleanText = textContent
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const parsed = JSON.parse(cleanText);
      // initialise events without additional properties yet
      setEvents(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.error('Error:', error);
      setEvents([
        {
          titulo: 'Error al buscar eventos',
          fecha: '',
          ubicacion: '',
          tipo: 'error',
          descripcion: 'Hubo un problema al buscar eventos. Por favor intenta nuevamente.',
          fuente: '',
        },
      ]);
    }
    setLoading(false);
  };

  /**
   * Save an event to the personal agenda. Adds additional fields for
   * annotations, status, contacts, reminders and categories. Prevents
   * duplicates based on title.
   */
  const saveEvent = (event) => {
    if (!savedEvents.find((e) => e.titulo === event.titulo)) {
      setSavedEvents([
        ...savedEvents,
        {
          ...event,
          notas: '',
          estado: '',
          contactos: [],
          reminder: null,
          category: event.tipo || '',
        },
      ]);
    }
  };

  /**
   * Update a field of a saved event identified by title. Accepts field name and
   * new value. This helper simplifies updates to notes, status, contacts and
   * reminder times.
   */
  const updateSavedEvent = (titulo, field, value) => {
    setSavedEvents(
      savedEvents.map((e) => (e.titulo === titulo ? { ...e, [field]: value } : e)),
    );
  };

  /**
   * Remove an event from the personal agenda.
   */
  const removeEvent = (titulo) => {
    setSavedEvents(savedEvents.filter((e) => e.titulo !== titulo));
  };

  /**
   * Mark an event as attended and move it to the history tab.
   */
  const markAsAttended = (titulo) => {
    const event = savedEvents.find((e) => e.titulo === titulo);
    if (event) {
      // update state: remove from savedEvents and add to historyEvents
      setSavedEvents(savedEvents.filter((e) => e.titulo !== titulo));
      setHistoryEvents([...historyEvents, { ...event, estado: 'asistido' }]);
    }
  };

  /**
   * Add a new custom category to the list of event types. Ensures
   * whitespace is trimmed and id is slugified. Duplicate ids are ignored.
   */
  const addCustomCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/\s+/g, '-');
    if (eventTypes.find((t) => t.id === id)) {
      setNewCategory('');
      return;
    }
    setEventTypes([...eventTypes, { id, label: trimmed }]);
    setNewCategory('');
  };

  /**
   * Set up or clear the automatic search interval based on user settings.
   */
  useEffect(() => {
    if (autoSearchRef.current) {
      clearInterval(autoSearchRef.current);
      autoSearchRef.current = null;
    }
    if (autoSearchEnabled && autoSearchInterval > 0) {
      // convert minutes to milliseconds
      autoSearchRef.current = setInterval(() => {
        searchEvents();
      }, autoSearchInterval * 60 * 1000);
    }
    return () => {
      if (autoSearchRef.current) {
        clearInterval(autoSearchRef.current);
      }
    };
  }, [autoSearchEnabled, autoSearchInterval]);

  /**
   * Schedule reminders for events when their reminder field changes. Each
   * reminder is a timeout that triggers an alert before the event. The
   * browser Notification API could be used instead of alert, but alert is
   * universally supported. Reminders are rescheduled whenever the saved
   * events list changes.
   */
  useEffect(() => {
    const now = Date.now();
    const timers = [];
    savedEvents.forEach((event) => {
      if (!event.reminder) return;
      const eventDate = parseDate(event.fecha);
      if (!eventDate) return;
      const remindAt = new Date(eventDate.getTime() - event.reminder);
      const delay = remindAt.getTime() - now;
      if (delay > 0) {
        const timer = setTimeout(() => {
          alert(`Recordatorio: el evento "${event.titulo}" será el ${event.fecha}`);
        }, delay);
        timers.push(timer);
      }
    });
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [savedEvents]);

  /**
   * Export the current agenda (saved and history) as a JSON file. The file
   * contains all event objects with their annotations and can be imported
   * later. Creates a Blob and triggers a download in the browser.
   */
  const exportAgenda = () => {
    const dataStr = JSON.stringify({ savedEvents, historyEvents }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'agenda-events.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  /**
   * Import an agenda from a JSON file. Expects the JSON structure created
   * by exportAgenda. Adds the imported events to the current state.
   */
  const importAgenda = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target.result);
        if (json.savedEvents) {
          setSavedEvents((prev) => [...prev, ...json.savedEvents]);
        }
        if (json.historyEvents) {
          setHistoryEvents((prev) => [...prev, ...json.historyEvents]);
        }
      } catch (err) {
        alert('Error al importar el archivo. Asegúrate de seleccionar un JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  /**
   * Group events by date for calendar view. Returns an object with
   * keys formatted as DD/MM/YYYY and arrays of events.
   */
  const groupEventsByDate = (eventList) => {
    const grouped = {};
    eventList.forEach((e) => {
      const dateKey = e.fecha.split(/\s*-\s*/)[0];
      if (!grouped[dateKey]) grouped[dateKey] = [];
      grouped[dateKey].push(e);
    });
    return grouped;
  };

  // Render the component
  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 to-blue-600 p-8 text-white">
            <h1 className="text-4xl font-bold mb-2">🏝️ Eventos en Turks and Caicos</h1>
            <p className="text-cyan-100">Mantente informado de toda la vida social de las islas</p>
          </div>
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'search'
                  ? 'bg-white text-cyan-600 border-b-2 border-cyan-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Search className="inline mr-2" size={20} />
              Buscar
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'saved'
                  ? 'bg-white text-cyan-600 border-b-2 border-cyan-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Star className="inline mr-2" size={20} />
              Guardados ({savedEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'calendar'
                  ? 'bg-white text-cyan-600 border-b-2 border-cyan-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <CalendarDays className="inline mr-2" size={20} />
              Calendario
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-4 px-6 font-semibold transition ${
                activeTab === 'history'
                  ? 'bg-white text-cyan-600 border-b-2 border-cyan-600'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <HistoryIcon className="inline mr-2" size={20} />
              Historial ({historyEvents.length})
            </button>
          </div>
          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="p-8">
              {/* Event type selection */}
              <div className="mb-6">
                <label className="block text-gray-700 font-semibold mb-3">
                  Tipo de Evento
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {eventTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSearchType(type.id)}
                      className={`py-2 px-3 rounded-lg font-medium transition ${
                        searchType === type.id
                          ? 'bg-cyan-600 text-white shadow-lg'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
                {/* Add custom category */}
                <div className="flex items-center gap-2 mb-6">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Nueva categoría"
                    className="flex-1 py-2 px-3 border border-gray-300 rounded-lg"
                  />
                  <button
                    onClick={addCustomCategory}
                    className="flex items-center gap-1 bg-cyan-600 hover:bg-cyan-700 text-white px-3 py-2 rounded-lg"
                  >
                    <PlusCircle size={16} /> Añadir
                  </button>
                </div>
                {/* Automatic search controls */}
                <div className="flex items-center gap-3 mb-6">
                  <label className="font-semibold text-gray-700">Búsqueda automática:</label>
                  <input
                    type="number"
                    min={0}
                    value={autoSearchInterval}
                    onChange={(e) => setAutoSearchInterval(parseInt(e.target.value, 10) || 0)}
                    className="w-20 py-1 px-2 border border-gray-300 rounded-lg"
                  />
                  <span className="text-gray-600 text-sm">minutos</span>
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={autoSearchEnabled}
                      onChange={() => setAutoSearchEnabled(!autoSearchEnabled)}
                      className="mr-1"
                    />
                    Activar
                  </label>
                </div>
                {/* Search button */}
                <button
                  onClick={searchEvents}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-cyan-700 hover:to-blue-700 transition disabled:opacity-50 shadow-lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="inline mr-2 animate-spin" size={24} /> Buscando eventos...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="inline mr-2" size={24} /> Buscar Eventos
                    </>
                  )}
                </button>
              </div>
              {/* Events list */}
              <div className="space-y-4">
                {events.length === 0 && !loading && (
                  <div className="text-center py-12 text-gray-500">
                    <CalendarIcon size={64} className="mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">Haz clic en "Buscar Eventos" para ver los eventos actuales</p>
                  </div>
                )}
                {events.map((event, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-white to-cyan-50 border border-cyan-200 rounded-xl p-6 hover:shadow-lg transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{event.titulo}</h3>
                        <div className="flex flex-wrap gap-3 mb-2 text-sm">
                          <span className="flex items-center text-cyan-700">
                            <CalendarIcon size={16} className="mr-1" /> {event.fecha}
                          </span>
                          <span className="flex items-center text-cyan-700">
                            <MapPin size={16} className="mr-1" /> {event.ubicacion}
                          </span>
                          {event.tipo && (
                            <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-xs font-semibold">
                              {event.tipo}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{event.descripcion}</p>
                        {event.fuente && (
                          <p className="text-xs text-gray-500 italic">Fuente: {event.fuente}</p>
                        )}
                      </div>
                      <button
                        onClick={() => saveEvent(event)}
                        className="ml-4 p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition"
                        title="Guardar evento"
                      >
                        <Star size={24} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Saved Tab */}
          {activeTab === 'saved' && (
            <div className="p-8 space-y-6">
              {savedEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Star size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No tienes eventos guardados</p>
                  <p className="text-sm mt-2">Guarda eventos desde la pestaña de búsqueda</p>
                </div>
              ) : (
                savedEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-white to-yellow-50 border border-yellow-200 rounded-xl p-6 hover:shadow-lg transition"
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{event.titulo}</h3>
                        <div className="flex flex-wrap gap-3 mb-2 text-sm">
                          <span className="flex items-center text-yellow-700">
                            <CalendarIcon size={16} className="mr-1" /> {event.fecha}
                          </span>
                          <span className="flex items-center text-yellow-700">
                            <MapPin size={16} className="mr-1" /> {event.ubicacion}
                          </span>
                          {event.category && (
                            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-semibold">
                              {event.category}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{event.descripcion}</p>
                        {event.fuente && (
                          <p className="text-xs text-gray-500 italic">Fuente: {event.fuente}</p>
                        )}
                        {/* Notes */}
                        <div className="mt-3">
                          <label className="flex items-center text-sm font-semibold text-gray-700 mb-1">
                            <StickyNote size={16} className="mr-1" /> Notas
                          </label>
                          <textarea
                            value={event.notas}
                            onChange={(e) => updateSavedEvent(event.titulo, 'notas', e.target.value)}
                            placeholder="Añade tus notas personales"
                            className="w-full border border-gray-300 rounded-lg p-2 text-sm"
                          />
                        </div>
                        {/* Status */}
                        <div className="mt-3 flex flex-col md:flex-row md:items-center md:gap-2">
                          <label className="flex items-center text-sm font-semibold text-gray-700">
                            Estado:
                          </label>
                          <select
                            value={event.estado}
                            onChange={(e) => updateSavedEvent(event.titulo, 'estado', e.target.value)}
                            className="mt-1 md:mt-0 border border-gray-300 rounded-lg p-1 text-sm"
                          >
                            <option value="">Sin confirmar</option>
                            <option value="confirmado">Confirmado</option>
                            <option value="tal vez">Tal vez</option>
                            <option value="asistido">Asistido</option>
                            <option value="cancelado">Cancelado</option>
                          </select>
                        </div>
                        {/* Reminder */}
                        <div className="mt-3 flex flex-col md:flex-row md:items-center md:gap-2">
                          <label className="flex items-center text-sm font-semibold text-gray-700">
                            <Bell size={16} className="mr-1" /> Recordatorio:
                          </label>
                          <select
                            value={event.reminder || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              updateSavedEvent(event.titulo, 'reminder', value ? parseInt(value, 10) : null);
                            }}
                            className="mt-1 md:mt-0 border border-gray-300 rounded-lg p-1 text-sm"
                          >
                            <option value="">Sin recordatorio</option>
                            <option value={60 * 60 * 1000}>1 hora antes</option>
                            <option value={24 * 60 * 60 * 1000}>1 día antes</option>
                            <option value={7 * 24 * 60 * 60 * 1000}>1 semana antes</option>
                          </select>
                        </div>
                        {/* Contacts */}
                        <div className="mt-3">
                          <label className="flex items-center text-sm font-semibold text-gray-700 mb-1">
                            <Users size={16} className="mr-1" /> Contactos
                          </label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {event.contactos.map((c, i) => (
                              <span
                                key={i}
                                className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs flex items-center gap-1"
                              >
                                {c}
                                <button
                                  onClick={() => {
                                    const updated = event.contactos.filter((_, idx) => idx !== i);
                                    updateSavedEvent(event.titulo, 'contactos', updated);
                                  }}
                                  className="ml-1 text-yellow-900 hover:text-red-600"
                                  title="Eliminar"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="Añadir contacto"
                              className="flex-1 border border-gray-300 rounded-lg p-2 text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && e.target.value.trim()) {
                                  const updated = [...event.contactos, e.target.value.trim()];
                                  updateSavedEvent(event.titulo, 'contactos', updated);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <button
                          onClick={() => markAsAttended(event.titulo)}
                          className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition"
                          title="Marcar como asistido"
                        >
                          <CheckCircle size={24} />
                        </button>
                        <button
                          onClick={() => removeEvent(event.titulo)}
                          className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                          title="Eliminar evento"
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {/* Export/Import controls */}
              {savedEvents.length > 0 && (
                <div className="flex flex-wrap gap-4 items-center mt-4">
                  <button
                    onClick={exportAgenda}
                    className="flex items-center gap-1 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg shadow"
                  >
                    <Download size={18} /> Exportar agenda
                  </button>
                  <label className="flex items-center gap-1 cursor-pointer bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg shadow">
                    <Upload size={18} />
                    Importar
                    <input type="file" accept="application/json" onChange={importAgenda} className="hidden" />
                  </label>
                </div>
              )}
            </div>
          )}
          {/* Calendar Tab */}
          {activeTab === 'calendar' && (
            <div className="p-8 overflow-x-auto">
              {savedEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <CalendarIcon size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No hay eventos en tu agenda para mostrar en el calendario</p>
                </div>
              ) : (
                (() => {
                  const grouped = groupEventsByDate(savedEvents);
                  const dates = Object.keys(grouped).sort((a, b) => {
                    const da = parseDate(a);
                    const db = parseDate(b);
                    return (da || 0) - (db || 0);
                  });
                  return (
                    <div className="space-y-6">
                      {dates.map((dateKey) => (
                        <div key={dateKey} className="border-l-4 border-cyan-500 pl-4">
                          <h4 className="text-lg font-bold text-cyan-700 mb-2">{dateKey}</h4>
                          <div className="space-y-2">
                            {grouped[dateKey].map((event, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-cyan-200 rounded-lg p-4 flex justify-between items-start hover:shadow-md transition"
                              >
                                <div className="flex-1">
                                  <h5 className="font-semibold text-gray-800">{event.titulo}</h5>
                                  <p className="text-sm text-gray-600">{event.descripcion}</p>
                                </div>
                                <button
                                  onClick={() => setActiveTab('saved')}
                                  className="ml-4 text-cyan-600 hover:text-cyan-700"
                                  title="Ver detalles"
                                >
                                  Ver
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          )}
          {/* History Tab */}
          {activeTab === 'history' && (
            <div className="p-8 space-y-6">
              {historyEvents.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <HistoryIcon size={64} className="mx-auto mb-4 text-gray-300" />
                  <p className="text-lg">No hay eventos en tu historial</p>
                </div>
              ) : (
                historyEvents.map((event, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-800 mb-1">{event.titulo}</h3>
                        <div className="flex flex-wrap gap-3 mb-2 text-sm">
                          <span className="flex items-center text-gray-700">
                            <CalendarIcon size={16} className="mr-1" /> {event.fecha}
                          </span>
                          <span className="flex items-center text-gray-700">
                            <MapPin size={16} className="mr-1" /> {event.ubicacion}
                          </span>
                          {event.category && (
                            <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-full text-xs font-semibold">
                              {event.category}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mb-2">{event.descripcion}</p>
                        {event.notas && (
                          <p className="text-sm text-gray-600 mb-1"><strong>Notas:</strong> {event.notas}</p>
                        )}
                        {event.contactos && event.contactos.length > 0 && (
                          <p className="text-sm text-gray-600 mb-1">
                            <strong>Contactos:</strong> {event.contactos.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        {/* Instructions */}
        <div className="mt-6 bg-white rounded-xl p-6 shadow-lg">
          <h3 className="font-bold text-gray-800 mb-3">📋 Cómo usar esta aplicación:</h3>
          <ul className="space-y-2 text-gray-700 text-sm">
            <li>• <strong>Selecciona el tipo de evento</strong> que te interesa o crea una nueva categoría personalizada.</li>
            <li>• <strong>Activa la búsqueda automática</strong> y elige el intervalo en minutos para recibir los eventos más recientes sin intervención.</li>
            <li>• <strong>Haz clic en "Buscar Eventos"</strong> para obtener información actualizada en tiempo real.</li>
            <li>• <strong>Guarda eventos</strong> que te interesen usando el ícono de estrella, añade notas, contactos, estados y recordatorios.</li>
            <li>• <strong>Consulta la pestaña Calendario</strong> para ver tus eventos agrupados por fecha.</li>
            <li>• <strong>Marca eventos como asistidos</strong> para moverlos al Historial y llevar un registro.</li>
            <li>• <strong>Exporta o importa</strong> tu agenda completa para realizar copias de seguridad o trasladarla a otro dispositivo.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}