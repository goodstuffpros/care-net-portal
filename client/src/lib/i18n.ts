/**
 * Care Net Portal — i18n (English / Spanish)
 *
 * Usage:
 *   const { t, lang, setLang } = useLang();
 *   <p>{t("dashboard.greeting", { name: "Becky" })}</p>
 *
 * Interpolation: use {{key}} in strings, pass values as second arg object.
 */

export type Lang = "en" | "es";

// ─── TRANSLATION DICTIONARY ───────────────────────────────────────────────────

export const translations = {
  en: {

    // ── Global / Nav ──────────────────────────────────────────────────────────
    "nav.dashboard": "Dashboard",
    "nav.schedule": "Schedule",
    "nav.activity": "Care Log",
    "nav.notes": "Misc. Notes",
    "nav.messages": "Messages",
    "nav.media": "Media",
    "nav.outings": "Outings",
    "nav.archive": "Archives",
    "nav.trends": "Wellness Trends",
    "nav.handoff": "Shift Handoff",
    "nav.caregivers": "Care Team",
    "nav.portal": "Client Profile",
    "nav.documents": "Documents",
    "nav.medications": "Medications",
    "nav.vitals": "Vitals & Health",
    "nav.badges": "Care Badge",
    "nav.thoughts": "Collection of Thoughts",
    "nav.wellbeing": "My Wellbeing",
    "nav.university": "Care Net University",
    "nav.myProfile": "My Public Profile",
    "nav.careScope": "Care Scope",
    "nav.patterns": "Health Patterns",
    "nav.emergency": "Emergency Info",
    "nav.activeClient": "ACTIVE CLIENT",

    // ── Clock in/out ─────────────────────────────────────────────────────────
    "shift.clockIn": "Clock In",
    "shift.clockOut": "Clock Out",
    "shift.clockingIn": "Clocking in...",
    "shift.clockingOut": "Clocking out...",
    "shift.onShift": "On Shift",
    "shift.clockedIn.title": "Clocked in",
    "shift.clockedIn.desc": "Your shift has started. Time is being tracked.",
    "shift.clockedOut.title": "Clocked out",
    "shift.clockedOut.desc": "Shift ended. Great work today!",

    // ── Dashboard ────────────────────────────────────────────────────────────
    "dashboard.greeting.morning": "Good morning, {{name}}",
    "dashboard.greeting.afternoon": "Good afternoon, {{name}}",
    "dashboard.greeting.evening": "Good evening, {{name}}",
    "dashboard.viewing": "Viewing care updates for",
    "dashboard.doneToday": "Done Today",
    "dashboard.pendingToday": "Pending Today",
    "dashboard.urgentFlags": "Urgent Flags",
    "dashboard.logEntries": "Log Entries",
    "dashboard.upcomingSchedule": "Upcoming Schedule",
    "dashboard.recentActivity": "Care Log",
    "dashboard.viewAll": "View all",
    "dashboard.noUpcoming": "No upcoming events",
    "dashboard.noActivity": "No recent activity",
    "dashboard.listen": "Listen",

    // ── Schedule ─────────────────────────────────────────────────────────────
    "schedule.title": "Schedule",
    "schedule.subtitle": "Care events · Medications · Appointments",
    "schedule.addEvent": "Add Event",
    "schedule.noEvents": "No events scheduled",
    "schedule.completed": "Completed",
    "schedule.markComplete": "Mark complete",
    "schedule.eventTitle": "Event Title",
    "schedule.eventType": "Event Type",
    "schedule.dateTime": "Date & Time",
    "schedule.notes": "Notes",
    "schedule.priority": "Priority",
    "schedule.recurrence": "Recurrence",
    "schedule.location": "Location",
    "schedule.save": "Add to Schedule",
    "schedule.saving": "Saving...",
    "schedule.types.task": "Task",
    "schedule.types.medication": "Medication",
    "schedule.types.appointment": "Appointment",
    "schedule.types.exercise": "Exercise",
    "schedule.types.other": "Other",
    "schedule.responsible.label": "Caregiver Responsible",
    "schedule.responsible.hint": "Toggle off if family is handling this",
    "schedule.responsible.noteLabel": "Responsibility Note",
    "schedule.responsible.notePlaceholder": "e.g. Family will drive Dad to this appointment.",
    "schedule.responsible.familyHandling": "Family handling",

    // ── Activity Log ──────────────────────────────────────────────────────────
    "activity.title": "Care Log",
    "activity.subtitle": "Daily care documentation",
    "activity.addEntry": "Add Entry",
    "activity.noEntries": "No entries yet",
    "activity.entryTitle": "Entry Title",
    "activity.category": "Category",
    "activity.description": "Description",
    "activity.save": "Save Entry",
    "activity.saving": "Saving...",
    "activity.late": "Late Entry",
    "activity.excused": "Excused",
    "activity.excuse": "Excuse",
    "activity.excuseReason": "Reason for late entry",
    "activity.excuseConfirm": "Save & Excuse",
    "activity.excused.toast": "Entry excused",
    "activity.loggedAt": "Logged at",
    "activity.scheduledAt": "Scheduled",

    // ── Messages ─────────────────────────────────────────────────────────────
    "messages.title": "Messages",
    "messages.subtitle": "Care team communications",
    "messages.newThread": "New Thread",
    "messages.typeMessage": "Type a message or use voice...",
    "messages.send": "Send",
    "messages.closed": "This thread has been closed",
    "messages.priority.green": "Normal",
    "messages.priority.yellow": "Important",
    "messages.priority.red": "Urgent",
    "messages.urgent.title": "Sending an Urgent Message",
    "messages.urgent.body": "The caregiver may be busy providing care right now. If this is a true emergency, a phone call is faster and recommended.",
    "messages.urgent.preview": "Message preview",
    "messages.urgent.cancel": "Cancel",
    "messages.urgent.send": "Send Urgent",
    "messages.noThreads": "No message threads yet",

    // ── Notes ─────────────────────────────────────────────────────────────────
    "notes.title": "Misc. Notes",
    "notes.subtitle": "Free-form observations and reminders",
    "notes.add": "Add Note",
    "notes.noNotes": "No notes yet",
    "notes.placeholder": "Write a note or use voice...",

    // ── Media ─────────────────────────────────────────────────────────────────
    "media.title": "Media",
    "media.subtitle": "Photos and videos",
    "media.upload": "Upload",
    "media.noMedia": "No media yet",

    // ── Outings ───────────────────────────────────────────────────────────────
    "outings.title": "Outings",
    "outings.subtitle": "Documented outings and activities",
    "outings.add": "Log Outing",
    "outings.noOutings": "No outings logged yet",

    // ── Archive ───────────────────────────────────────────────────────────────
    "archive.title": "Archives",
    "archive.subtitle": "Monthly summaries · Care history",
    "archive.generateSummary": "Generate Summary",
    "archive.exportDoctor": "Export for Doctor",
    "archive.noArchive": "No archived summaries yet",

    // ── Wellness Trends ───────────────────────────────────────────────────────
    "trends.title": "Wellness Trends",
    "trends.subtitle": "Health metrics over time",
    "trends.7days": "7 Days",
    "trends.30days": "30 Days",
    "trends.90days": "90 Days",

    // ── Shift Handoff ─────────────────────────────────────────────────────────
    "handoff.title": "Shift Handoff",
    "handoff.subtitle": "End-of-shift summary",
    "handoff.submit": "Submit Handoff",

    // ── Care Team ─────────────────────────────────────────────────────────────
    "caregivers.title": "Care Team",
    "caregivers.subtitle": "Caregivers and contacts",
    "caregivers.add": "Add Member",

    // ── Client Profile ────────────────────────────────────────────────────────
    "portal.title": "Client Profile",
    "portal.subtitle": "Profile · Family access · Contacts",
    "portal.edit": "Edit",
    "portal.save": "Save",
    "portal.cancel": "Cancel",
    "portal.caregiverRating": "Caregiver Rating",
    "portal.ratingExcellent": "Excellent",
    "portal.ratingGood": "Good",
    "portal.ratingAttention": "Needs Attention",
    "portal.ratingFormula": "Score = 100 − (yellow × 3) − (red × 8) · 30-day rolling window · excused flags excluded",
    "portal.publicBadge": "public badge",
    "portal.yellowFlags": "Yellow flags",
    "portal.redFlags": "Red flags",
    "portal.excused": "Excused",
    "portal.careFlags": "Care Flags",
    "portal.active": "active",
    "portal.noFlags": "No active flags",
    "portal.noFlagsDesc": "All care tasks are on track for this period.",
    "portal.excuseFlag": "Excuse this Flag",
    "portal.excuseFlag.desc": "This flag will be removed from the rating calculation.",
    "portal.excuseNote": "Reason for excuse",
    "portal.excuseConfirm": "Save & Excuse",
    "portal.excused.toast": "Flag excused",
    "portal.flagsReviewedBy": "Flags are reviewed and excused by the Main Contact.",
    "portal.accessLevels": "Access Levels",
    "portal.familyContacts": "Family Contacts",
    "portal.redFlagLabel": "Red Flag",

    // ── Documents ─────────────────────────────────────────────────────────────
    "documents.title": "Documents",
    "documents.subtitle": "Care files and records",
    "documents.upload": "Upload",
    "documents.noDocuments": "No documents yet",

    // ── Emergency ─────────────────────────────────────────────────────────────
    "emergency.title": "Emergency Info",
    "emergency.subtitle": "Critical information · Always accessible",

    // ── Common ────────────────────────────────────────────────────────────────
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.close": "Close",
    "common.loading": "Loading...",
    "common.error": "Something went wrong",
    "common.required": "Required",
    "common.optional": "Optional",
    "common.today": "Today",
    "common.yesterday": "Yesterday",
    "common.viewAll": "View all",
    "common.noData": "No data available",
    "common.add": "Add",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.all": "All",
    "common.routine": "Normal",
    "common.important": "Important",
    "common.urgent": "Urgent",
    "common.role.caregiver": "Primary Caregiver",
    "common.role.multi_caregiver": "Multi-Client Caregiver",
    "common.role.temp_caregiver": "Temp Caregiver",
    "common.role.primary_family": "Main Contact",
    "common.role.secondary_family": "Secondary Family Member",
    "common.role.facilitator": "Facilitator",

    // ── Voice / HFM ───────────────────────────────────────────────────────────
    "voice.hfm.label": "Hands-Free Mode",
    "voice.hfm.armed": "Listening for \"Hey Carenet\"",
    "voice.hfm.triggered": "Listening for command...",
    "voice.hfm.activate": "Activate Hands-Free Mode",
    "voice.hfm.deactivate": "Deactivate Hands-Free Mode",
    "voice.hfm.toast.on": "Hands-Free Mode activated",
    "voice.hfm.toast.on.desc": "Say \"Hey Carenet\" followed by a command.",
    "voice.hfm.toast.off": "Hands-Free Mode deactivated",
    "voice.tap.label": "Voice Command",
    "voice.tap.listening": "Listening... say a command",
    "voice.tap.cancel": "Cancel",
    "voice.unsupported": "Voice commands require Chrome or Edge.",
    "voice.logged": "Activity logged",
    "voice.sent": "Message sent",
    "voice.unknown": "Didn't catch that. Try: \"log activity: [description]\" or \"go to schedule\"",
    "voice.hint": "Say \"Hey Carenet\" to log hands-free",

    // ── Settings / Language ───────────────────────────────────────────────────
    "settings.language": "Language",
    "settings.language.en": "English",
    "settings.language.es": "Español",
    "settings.theme": "Theme",
    "settings.theme.light": "Light",
    "settings.theme.dark": "Dark",
  },

  es: {
    // ── Global / Nav ──────────────────────────────────────────────────────────
    "nav.dashboard": "Panel Principal",
    "nav.schedule": "Calendario",
    "nav.activity": "Registro de Cuidado",
    "nav.notes": "Notas Varias",
    "nav.messages": "Mensajes",
    "nav.media": "Multimedia",
    "nav.outings": "Salidas",
    "nav.archive": "Archivos",
    "nav.trends": "Tendencias de Salud",
    "nav.handoff": "Traspaso de Turno",
    "nav.caregivers": "Equipo de Cuidado",
    "nav.portal": "Perfil del Cliente",
    "nav.documents": "Documentos",
    "nav.medications": "Medicamentos",
    "nav.vitals": "Signos Vitales",
    "nav.badges": "Insignia de Cuidado",
    "nav.thoughts": "Colección de Pensamientos",
    "nav.wellbeing": "Mi Bienestar",
    "nav.university": "Care Net Universidad",
    "nav.myProfile": "Mi Perfil Público",
    "nav.careScope": "Alcance del Cuidado",
    "nav.patterns": "Patrones de Salud",
    "nav.emergency": "Emergencia",
    "nav.activeClient": "CLIENTE ACTIVO",

    // ── Clock in/out ─────────────────────────────────────────────────────────
    "shift.clockIn": "Iniciar Turno",
    "shift.clockOut": "Finalizar Turno",
    "shift.clockingIn": "Iniciando turno...",
    "shift.clockingOut": "Finalizando turno...",
    "shift.onShift": "En Turno",
    "shift.clockedIn.title": "Turno iniciado",
    "shift.clockedIn.desc": "Tu turno ha comenzado. El tiempo está siendo registrado.",
    "shift.clockedOut.title": "Turno finalizado",
    "shift.clockedOut.desc": "Turno terminado. ¡Buen trabajo hoy!",

    // ── Dashboard ────────────────────────────────────────────────────────────
    "dashboard.greeting.morning": "Buenos días, {{name}}",
    "dashboard.greeting.afternoon": "Buenas tardes, {{name}}",
    "dashboard.greeting.evening": "Buenas noches, {{name}}",
    "dashboard.viewing": "Viendo actualizaciones de cuidado de",
    "dashboard.doneToday": "Completado Hoy",
    "dashboard.pendingToday": "Pendiente Hoy",
    "dashboard.urgentFlags": "Alertas Urgentes",
    "dashboard.logEntries": "Entradas en Registro",
    "dashboard.upcomingSchedule": "Próximas Actividades",
    "dashboard.recentActivity": "Registro de Cuidados",
    "dashboard.viewAll": "Ver todo",
    "dashboard.noUpcoming": "No hay actividades próximas",
    "dashboard.noActivity": "No hay actividad reciente",
    "dashboard.listen": "Escuchar",

    // ── Schedule ─────────────────────────────────────────────────────────────
    "schedule.title": "Calendario",
    "schedule.subtitle": "Eventos de cuidado · Medicamentos · Citas",
    "schedule.addEvent": "Agregar Evento",
    "schedule.noEvents": "No hay eventos programados",
    "schedule.completed": "Completado",
    "schedule.markComplete": "Marcar como completo",
    "schedule.eventTitle": "Título del Evento",
    "schedule.eventType": "Tipo de Evento",
    "schedule.dateTime": "Fecha y Hora",
    "schedule.notes": "Notas",
    "schedule.priority": "Prioridad",
    "schedule.recurrence": "Recurrencia",
    "schedule.location": "Ubicación",
    "schedule.save": "Agregar al Calendario",
    "schedule.saving": "Guardando...",
    "schedule.types.task": "Tarea",
    "schedule.types.medication": "Medicamento",
    "schedule.types.appointment": "Cita Médica",
    "schedule.types.exercise": "Ejercicio",
    "schedule.types.other": "Otro",
    "schedule.responsible.label": "Responsabilidad del Cuidador",
    "schedule.responsible.hint": "Desactivar si la familia se encargará de esto",
    "schedule.responsible.noteLabel": "Nota de Responsabilidad",
    "schedule.responsible.notePlaceholder": "Ej. La familia llevará a papá a esta cita.",
    "schedule.responsible.familyHandling": "A cargo de la familia",

    // ── Activity Log ──────────────────────────────────────────────────────────
    "activity.title": "Registro de Cuidado",
    "activity.subtitle": "Documentación diaria de cuidado",
    "activity.addEntry": "Nueva Entrada",
    "activity.noEntries": "No hay entradas aún",
    "activity.entryTitle": "Título",
    "activity.category": "Categoría",
    "activity.description": "Descripción",
    "activity.save": "Guardar Entrada",
    "activity.saving": "Guardando...",
    "activity.late": "Entrada Tardía",
    "activity.excused": "Justificada",
    "activity.excuse": "Justificar",
    "activity.excuseReason": "Razón para la entrada tardía",
    "activity.excuseConfirm": "Guardar y Justificar",
    "activity.excused.toast": "Entrada justificada",
    "activity.loggedAt": "Registrado a las",
    "activity.scheduledAt": "Programado",

    // ── Messages ─────────────────────────────────────────────────────────────
    "messages.title": "Mensajes",
    "messages.subtitle": "Comunicaciones del equipo de cuidado",
    "messages.newThread": "Nuevo Hilo",
    "messages.typeMessage": "Escribe un mensaje o usa el micrófono...",
    "messages.send": "Enviar",
    "messages.closed": "Este hilo ha sido cerrado",
    "messages.priority.green": "Normal",
    "messages.priority.yellow": "Importante",
    "messages.priority.red": "Urgente",
    "messages.urgent.title": "Enviando un Mensaje Urgente",
    "messages.urgent.body": "El cuidador puede estar ocupado brindando atención en este momento. Si es una emergencia real, una llamada telefónica es más rápida y recomendada.",
    "messages.urgent.preview": "Vista previa del mensaje",
    "messages.urgent.cancel": "Cancelar",
    "messages.urgent.send": "Enviar Urgente",
    "messages.noThreads": "No hay hilos de mensajes aún",

    // ── Notes ─────────────────────────────────────────────────────────────────
    "notes.title": "Notas Varias",
    "notes.subtitle": "Observaciones y recordatorios libres",
    "notes.add": "Agregar Nota",
    "notes.noNotes": "No hay notas aún",
    "notes.placeholder": "Escribe una nota o usa el micrófono...",

    // ── Media ─────────────────────────────────────────────────────────────────
    "media.title": "Multimedia",
    "media.subtitle": "Fotos y videos",
    "media.upload": "Subir",
    "media.noMedia": "No hay multimedia aún",

    // ── Outings ───────────────────────────────────────────────────────────────
    "outings.title": "Salidas",
    "outings.subtitle": "Salidas y actividades documentadas",
    "outings.add": "Registrar Salida",
    "outings.noOutings": "No hay salidas registradas aún",

    // ── Archive ───────────────────────────────────────────────────────────────
    "archive.title": "Archivos",
    "archive.subtitle": "Resúmenes mensuales · Historial de cuidado",
    "archive.generateSummary": "Generar Resumen",
    "archive.exportDoctor": "Exportar para Médico",
    "archive.noArchive": "No hay resúmenes archivados aún",

    // ── Wellness Trends ───────────────────────────────────────────────────────
    "trends.title": "Tendencias de Salud",
    "trends.subtitle": "Métricas de salud a lo largo del tiempo",
    "trends.7days": "7 Días",
    "trends.30days": "30 Días",
    "trends.90days": "90 Días",

    // ── Shift Handoff ─────────────────────────────────────────────────────────
    "handoff.title": "Traspaso de Turno",
    "handoff.subtitle": "Resumen de fin de turno",
    "handoff.submit": "Enviar Resumen",

    // ── Care Team ─────────────────────────────────────────────────────────────
    "caregivers.title": "Equipo de Cuidado",
    "caregivers.subtitle": "Cuidadores y contactos",
    "caregivers.add": "Agregar Miembro",

    // ── Client Profile ────────────────────────────────────────────────────────
    "portal.title": "Perfil del Cliente",
    "portal.subtitle": "Perfil · Acceso familiar · Contactos",
    "portal.edit": "Editar",
    "portal.save": "Guardar",
    "portal.cancel": "Cancelar",
    "portal.caregiverRating": "Calificación del Cuidador",
    "portal.ratingExcellent": "Excelente",
    "portal.ratingGood": "Bueno",
    "portal.ratingAttention": "Requiere Atención",
    "portal.ratingFormula": "Puntaje = 100 − (amarillas × 3) − (rojas × 8) · Ventana de 30 días · Banderas justificadas excluidas",
    "portal.publicBadge": "insignia pública",
    "portal.yellowFlags": "Banderas amarillas",
    "portal.redFlags": "Banderas rojas",
    "portal.excused": "Justificadas",
    "portal.careFlags": "Banderas de Cuidado",
    "portal.active": "activas",
    "portal.noFlags": "Sin banderas activas",
    "portal.noFlagsDesc": "Todas las tareas de cuidado están al día en este período.",
    "portal.excuseFlag": "Justificar esta Bandera",
    "portal.excuseFlag.desc": "Esta bandera será removida del cálculo de calificación.",
    "portal.excuseNote": "Motivo de justificación",
    "portal.excuseConfirm": "Guardar y Justificar",
    "portal.excused.toast": "Bandera justificada",
    "portal.flagsReviewedBy": "Las banderas son revisadas y justificadas por el Contacto Familiar Principal.",
    "portal.accessLevels": "Niveles de Acceso",
    "portal.familyContacts": "Contactos Familiares",
    "portal.redFlagLabel": "Bandera Roja",

    // ── Documents ─────────────────────────────────────────────────────────────
    "documents.title": "Documentos",
    "documents.subtitle": "Archivos y registros de cuidado",
    "documents.upload": "Subir",
    "documents.noDocuments": "No hay documentos aún",

    // ── Emergency ─────────────────────────────────────────────────────────────
    "emergency.title": "Información de Emergencia",
    "emergency.subtitle": "Información crítica · Siempre accesible",

    // ── Common ────────────────────────────────────────────────────────────────
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.delete": "Eliminar",
    "common.edit": "Editar",
    "common.close": "Cerrar",
    "common.loading": "Cargando...",
    "common.error": "Algo salió mal",
    "common.required": "Requerido",
    "common.optional": "Opcional",
    "common.today": "Hoy",
    "common.yesterday": "Ayer",
    "common.viewAll": "Ver todo",
    "common.noData": "No hay datos disponibles",
    "common.add": "Agregar",
    "common.search": "Buscar",
    "common.filter": "Filtrar",
    "common.all": "Todos",
    "common.routine": "Normal",
    "common.important": "Importante",
    "common.urgent": "Urgente",
    "common.role.caregiver": "Cuidador Principal",
    "common.role.multi_caregiver": "Cuidador Multi-Cliente",
    "common.role.temp_caregiver": "Cuidador Temporal",
    "common.role.primary_family": "Contacto Principal",
    "common.role.secondary_family": "Miembro Familiar Secundario",
    "common.role.facilitator": "Facilitador",

    // ── Voice / HFM ───────────────────────────────────────────────────────────
    "voice.hfm.label": "Modo Manos Libres",
    "voice.hfm.armed": "Escuchando \"Hola Carenet\"",
    "voice.hfm.triggered": "Escuchando comando...",
    "voice.hfm.activate": "Activar Modo Manos Libres",
    "voice.hfm.deactivate": "Desactivar Modo Manos Libres",
    "voice.hfm.toast.on": "Modo Manos Libres activado",
    "voice.hfm.toast.on.desc": "Di \"Hola Carenet\" seguido de un comando.",
    "voice.hfm.toast.off": "Modo Manos Libres desactivado",
    "voice.tap.label": "Comando de Voz",
    "voice.tap.listening": "Escuchando... di un comando",
    "voice.tap.cancel": "Cancelar",
    "voice.unsupported": "Los comandos de voz requieren Chrome o Edge.",
    "voice.logged": "Actividad registrada",
    "voice.sent": "Mensaje enviado",
    "voice.unknown": "No entendí. Intenta: \"registrar actividad: [descripción]\" o \"ir a calendario\"",
    "voice.hint": "Di \"Hola Carenet\" para registrar sin manos",

    // ── Settings / Language ───────────────────────────────────────────────────
    "settings.language": "Idioma",
    "settings.language.en": "English",
    "settings.language.es": "Español",
    "settings.theme": "Tema",
    "settings.theme.light": "Claro",
    "settings.theme.dark": "Oscuro",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// ─── INTERPOLATION ─────────────────────────────────────────────────────────────

function interpolate(str: string, vars?: Record<string, string>): string {
  if (!vars) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

// ─── TRANSLATION FUNCTION ──────────────────────────────────────────────────────

export function translate(lang: Lang, key: TranslationKey, vars?: Record<string, string>): string {
  const dict = translations[lang] as Record<string, string>;
  const fallback = translations.en as Record<string, string>;
  const str = dict[key] ?? fallback[key] ?? key;
  return interpolate(str, vars);
}
