import { describe, it, expect } from 'vitest';
import {
  type AppRole,
  type Capability,
  APP_ROLES,
  ROLE_CAPABILITIES,
  appRoleLabel,
  isAppRole,
  capabilitiesForRole,
  roleHasCapability,
  rolesConCapacidad,
  APP_AREAS,
  areasForRole,
} from '../lib/permisos-contratacion';

const ROLES_EXPECTADOS: AppRole[] = [
  'consulta', 'area_usuaria', 'ate', 'dec', 'oficial_compra',
  'comite', 'jurado', 'legal', 'titular', 'aga', 'admin',
];

const CAPACIDADES: Capability[] = [
  'necesidad.manage',
  'expediente.manage',
  'expediente.upload',
  'expediente.evaluate',
  'expediente.risks',
  'expediente.draft',
  'expediente.approve',
  'expediente.execute',
];

describe('APP_ROLES', () => {
  it('tiene exactamente los 11 roles esperados', () => {
    const values = APP_ROLES.map((r) => r.value);
    expect(values).toEqual(ROLES_EXPECTADOS);
  });

  it('cada rol tiene label y descripcion no vacíos', () => {
    for (const rol of APP_ROLES) {
      expect(rol.label).toBeTruthy();
      expect(rol.description).toBeTruthy();
    }
  });

  it('appRoleLabel retorna el label correcto', () => {
    expect(appRoleLabel('dec')).toBe('DEC');
    expect(appRoleLabel('admin')).toBe('Administrador');
    expect(appRoleLabel('titular')).toBe('Titular de la Entidad');
  });

  it('isAppRole valida correctamente', () => {
    for (const r of ROLES_EXPECTADOS) {
      expect(isAppRole(r)).toBe(true);
    }
    expect(isAppRole('inexistente')).toBe(false);
    expect(isAppRole(null)).toBe(false);
    expect(isAppRole(undefined)).toBe(false);
    expect(isAppRole('')).toBe(false);
  });
});

describe('ROLE_CAPABILITIES', () => {
  it('toda entrada de ROLE_CAPABILITIES es un array', () => {
    for (const rol of ROLES_EXPECTADOS) {
      expect(Array.isArray(ROLE_CAPABILITIES[rol])).toBe(true);
    }
  });

  it('cada capacidad listada es una capacidad válida', () => {
    for (const rol of ROLES_EXPECTADOS) {
      for (const cap of ROLE_CAPABILITIES[rol]) {
        expect(CAPACIDADES).toContain(cap);
      }
    }
  });

  it('roleHasCapability refleja ROLE_CAPABILITIES', () => {
    for (const rol of ROLES_EXPECTADOS) {
      for (const cap of CAPACIDADES) {
        expect(roleHasCapability(rol, cap)).toBe(
          ROLE_CAPABILITIES[rol].includes(cap),
        );
      }
    }
  });

  it('capabilitiesForRole devuelve copia del array o [] para rol inexistente', () => {
    const decCaps = capabilitiesForRole('dec');
    expect(decCaps).toEqual(ROLE_CAPABILITIES['dec']);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(capabilitiesForRole('fake' as any)).toEqual([]);
  });
});

describe('rolesConCapacidad', () => {
  it('necesidad.manage pertenece a area_usuaria, ate, dec y admin', () => {
    const labels = rolesConCapacidad('necesidad.manage');
    expect(labels).toContain('Área usuaria');
    expect(labels).toContain('Área técnica estratégica (ATE)');
    expect(labels).toContain('DEC');
    expect(labels).toContain('Administrador');
    expect(labels).not.toContain('Consulta');
  });

  it('expediente.approve pertenece a titular, aga y admin', () => {
    const labels = rolesConCapacidad('expediente.approve');
    expect(labels).toContain('Titular de la Entidad');
    expect(labels).toContain('Autoridad de Gestión Administrativa (AGA)');
    expect(labels).toContain('Administrador');
  });

  it('consulta no tiene ninguna capacidad', () => {
    for (const cap of CAPACIDADES) {
      expect(roleHasCapability('consulta', cap)).toBe(false);
    }
    expect(rolesConCapacidad('expediente.manage')).not.toContain('Consulta');
  });

  it('admin tiene todas las capacidades', () => {
    for (const cap of CAPACIDADES) {
      expect(roleHasCapability('admin', cap)).toBe(true);
    }
  });
});

describe('APP_AREAS', () => {
  it('admin tiene acceso a todas las áreas', () => {
    const areas = areasForRole('admin');
    expect(areas.length).toBe(APP_AREAS.length);
  });

  it('areasForRole para rol no-admin filtra correctamente', () => {
    const areas = areasForRole('dec');
    expect(areas.some((a) => a.area === 'Biblioteca documental')).toBe(true);
    expect(areas.some((a) => a.area === 'Configuración')).toBe(false);
    expect(areas.some((a) => a.area === 'Monitoreo y auditoría')).toBe(false);
  });

  it('cada área tiene area, scope y roles como array', () => {
    for (const area of APP_AREAS) {
      expect(area).toHaveProperty('area');
      expect(area).toHaveProperty('scope');
      expect(Array.isArray(area.roles)).toBe(true);
    }
  });

  it('los roles dentro de cada área son AppRole válidos', () => {
    for (const area of APP_AREAS) {
      for (const rol of area.roles) {
        expect(isAppRole(rol)).toBe(true);
      }
    }
  });
});
