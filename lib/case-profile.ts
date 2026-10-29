// Perfil de caso: el régimen, la fecha de convocatoria y el objeto que la persona ya dio, para no reescribirlos en
// cada consulta. Es un dato de comodidad guardado en el navegador (localStorage), no un registro del servidor.
//
// Un perfil guardado condiciona el régimen que se aplica (una fecha de convocatoria anterior al 22-04-2025
// cambia de la Ley 32069 a la 30225), así que el riesgo real es que una fecha vieja siga mandando sin que nadie la
// vea. Por eso: (1) solo se guarda lo que el caso tiene en común entre preguntas —los HECHOS no, cada pregunta
// trae los suyos—; (2) el perfil activo se muestra siempre, con su antigüedad; (3) quitarlo vacía también los
// campos; y (4) lo leído del almacenamiento se valida como si fuera entrada de un tercero. Módulo puro.

import { caseFieldLimits, type CaseContext } from "./chat-case-context";

export const CASE_PROFILE_PREFIX = "ace-caso-activo:";
export const CASE_PROFILE_STALE_DAYS = 14;

export type CaseProfile = { regime: string; dates: string; object: string; savedAt: number };

const clean = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export const caseProfileKey = (ownerId: string) => `${CASE_PROFILE_PREFIX}${ownerId || "anonimo"}`;

/** Lo que se lee del almacenamiento: texto cualquiera. Devuelve un perfil válido o null; nunca lanza. */
export function parseCaseProfile(raw: string | null | undefined): CaseProfile | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const profile = {
      regime: clean(value.regime, caseFieldLimits.regime),
      dates: clean(value.dates, caseFieldLimits.dates),
      object: clean(value.object, caseFieldLimits.object),
      savedAt: typeof value.savedAt === "number" && Number.isFinite(value.savedAt) && value.savedAt > 0 ? value.savedAt : 0,
    };
    // Sin ningún dato no hay perfil; sin fecha de guardado no se sabe cuánto de viejo es, y eso se muestra.
    return profile.regime || profile.dates || profile.object ? profile : null;
  } catch {
    return null;
  }
}

/** El perfil a guardar a partir del formulario, o null si no hay nada que guardar. Los hechos nunca se guardan. */
export function serializeCaseProfile(context: CaseContext, now: number): string | null {
  const profile = { regime: clean(context.regime, caseFieldLimits.regime), dates: clean(context.dates, caseFieldLimits.dates), object: clean(context.object, caseFieldLimits.object), savedAt: now };
  return profile.regime || profile.dates || profile.object ? JSON.stringify(profile) : null;
}

/** El contexto del caso que corresponde a un perfil: lo común, sin hechos. */
export function profileToContext(profile: CaseProfile): CaseContext {
  return { regime: profile.regime, dates: profile.dates, object: profile.object || undefined, facts: "" };
}

/** ¿El formulario muestra exactamente el perfil guardado (ignorando los hechos)? */
export function matchesProfile(context: CaseContext, profile: CaseProfile): boolean {
  return clean(context.regime, caseFieldLimits.regime) === profile.regime && clean(context.dates, caseFieldLimits.dates) === profile.dates && clean(context.object, caseFieldLimits.object) === profile.object;
}

export function isEmptyCommonContext(context: CaseContext): boolean {
  return !clean(context.regime, 1) && !clean(context.dates, 1) && !clean(context.object, 1);
}

/** Días completos desde que se guardó. Sin fecha de guardado, se trata como antiguo. */
export function profileAgeDays(profile: CaseProfile, now: number): number {
  if (!profile.savedAt) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((now - profile.savedAt) / 86_400_000));
}

export function describeProfileAge(profile: CaseProfile, now: number): string {
  const days = profileAgeDays(profile, now);
  if (!Number.isFinite(days)) return "guardado hace tiempo";
  if (days === 0) return "guardado hoy";
  return days === 1 ? "guardado ayer" : `guardado hace ${days} días`;
}

export const isStaleProfile = (profile: CaseProfile, now: number) => profileAgeDays(profile, now) >= CASE_PROFILE_STALE_DAYS;

/** Una línea para el chip: «Obra · Convocado el 3 de marzo de 2025 · Ley 30225», recortada. */
export function describeProfile(profile: CaseProfile): string {
  const line = [profile.object, profile.dates, profile.regime].filter(Boolean).join(" · ");
  return line.length > 140 ? `${line.slice(0, 137)}…` : line;
}
