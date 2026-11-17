// Ficha de plazos y cifras del examen: lo que más se confunde (días, porcentajes, topes) en una sola página.
//
// REGLA: aquí solo entra un dato que ya se leyó en el texto de la norma al verificar su clase (Ley 32069 al 19.07.2026
// y Reglamento al 09.01.2026). Cada dato dice de qué clase sale y en qué artículo está; el test exige que ese artículo
// figure en la base legal de esa clase y que la clase esté verificada, para que la ficha no pueda citar algo que el
// curso no respalda. No añadas cifras de memoria.
// Módulo puro: sin red ni base de datos.
import type { BaseLegal, CompetenciaExamen } from "./tipos";

export type DatoFicha = {
  tema: string;
  dato: string;
  clase: string;
  base: BaseLegal[];
};

export type GrupoFicha = { competencia: CompetenciaExamen | null; titulo: string; datos: DatoFicha[] };

const ley = (articulo: string): BaseLegal => ({ norma: "Ley 32069", articulo });
const reg = (articulo: string): BaseLegal => ({ norma: "Reglamento", articulo });

export const FICHA_CIFRAS: GrupoFicha[] = [
  {
    competencia: "1",
    titulo: "Actuaciones preparatorias",
    datos: [
      {
        tema: "Segmentación: alta cuantía",
        dato: "Más del 10 % del monto total de las contrataciones de bienes y servicios del PAC del CMN.",
        clase: "segmentacion-contrataciones",
        base: [reg("125")],
      },
      {
        tema: "Comité",
        dato: "Tres integrantes: al menos un comprador público de la DEC y un experto o profesional en el objeto.",
        clase: "evaluadores",
        base: [reg("56")],
      },
      {
        tema: "Jurado",
        dato: "Tres o cinco expertos en el objeto; evalúan individualmente.",
        clase: "evaluadores",
        base: [reg("56"), reg("60")],
      },
    ],
  },
  {
    competencia: "2",
    titulo: "Selección",
    datos: [
      {
        tema: "Contrato menor",
        dato: "Hasta 8 UIT vigentes al momento de la contratación, sin procedimiento de selección.",
        clase: "modalidades-contratacion-eficiente",
        base: [ley("34")],
      },
      {
        tema: "Convocatoria a presentación de ofertas",
        dato: "No menos de 22 días hábiles; con anuncio de contratación futura publicado 40 días calendario antes, puede reducirse según las bases estándar, nunca por debajo de 10 días calendario.",
        clase: "plazos-buena-pro-seleccion",
        base: [reg("64")],
      },
      {
        tema: "Consultas y observaciones a las bases",
        dato: "No menos de 7 días hábiles desde el día siguiente de la convocatoria; 3 en las modalidades abreviadas.",
        clase: "plazos-buena-pro-seleccion",
        base: [reg("66")],
      },
      {
        tema: "Si la entidad no perfecciona el contrato",
        dato: "El ganador puede requerirla y darle 5 días hábiles; vencidos, deja de estar obligado a suscribir.",
        clase: "plazos-buena-pro-seleccion",
        base: [reg("91")],
      },
      {
        tema: "Cómo se cuentan los plazos de la selección",
        dato: "En días hábiles, sin el día inicial y con el de vencimiento, hasta el perfeccionamiento del contrato.",
        clase: "procedimientos-seleccion",
        base: [reg("62")],
      },
      {
        tema: "Plazo para apelar (regla general)",
        dato: "8 días hábiles desde la notificación de la buena pro en la Pladicop.",
        clase: "recurso-apelacion",
        base: [reg("304")],
      },
      {
        tema: "Plazo para apelar (abreviados, selección de expertos y comparación de precios)",
        dato: "5 días hábiles.",
        clase: "recurso-apelacion",
        base: [reg("304")],
      },
      {
        tema: "Plazo para apelar (subasta inversa electrónica)",
        dato: "5 días hábiles; 8 si su cuantía es la de una licitación o un concurso público.",
        clase: "recurso-apelacion",
        base: [reg("304")],
      },
      {
        tema: "Quién resuelve la apelación",
        dato: "El Tribunal si la cuantía supera 50 UIT (y en catálogos electrónicos); si no, la autoridad de la gestión administrativa.",
        clase: "recurso-apelacion",
        base: [ley("74")],
      },
      {
        tema: "Garantía de apelación",
        dato: "3 % de la cuantía, con tope de 300 UIT. MYPE: 0,5 %, con tope de 25 UIT.",
        clase: "recurso-apelacion",
        base: [ley("73"), reg("309")],
      },
      {
        tema: "Requisitos para perfeccionar el contrato",
        dato: "8 días hábiles; 5 si no se exige garantía de fiel cumplimiento.",
        clase: "perfeccionamiento-contrato",
        base: [reg("90")],
      },
      {
        tema: "Perfeccionamiento: plazos de la entidad",
        dato: "Perfecciona u observa en no más de 3 días hábiles; subsanación de hasta 4; hasta 4 más si la garantía está en trámite.",
        clase: "perfeccionamiento-contrato",
        base: [reg("90")],
      },
    ],
  },
  {
    competencia: "3",
    titulo: "Ejecución contractual",
    datos: [
      {
        tema: "Garantía de fiel cumplimiento",
        dato: "10 % del monto del contrato original.",
        clase: "garantias",
        base: [reg("113")],
      },
      {
        tema: "Fiel cumplimiento en bienes y servicios",
        dato: "Vigente hasta la conformidad; el fideicomiso solo procede si el plazo de ejecución supera 90 días calendario.",
        clase: "garantias",
        base: [reg("138")],
      },
      {
        tema: "Adicionales y reducciones (bienes, servicios y consultorías de obras)",
        dato: "Hasta el 25 % del monto del contrato original, autorizados por la autoridad de la gestión administrativa.",
        clase: "modificaciones-contrato",
        base: [ley("64")],
      },
      {
        tema: "Adicionales de obra (solo construcción)",
        dato: "Hasta el 15 % la autoridad de la gestión administrativa; de más del 15 % hasta el 30 %, el titular; de más del 30 % hasta el 50 %, el titular con autorización previa de la Contraloría. Si en conjunto superan el 50 %, se resuelve el contrato.",
        clase: "modificaciones-contrato",
        base: [ley("64"), reg("194")],
      },
      {
        tema: "Ampliación de plazo (bienes y servicios)",
        dato: "Se solicita en 10 días hábiles (prorrogables 10 más); la autoridad de la gestión administrativa resuelve en 12 días hábiles y, si calla, se tiene por aprobada.",
        clase: "modificaciones-procedimiento",
        base: [reg("142")],
      },
      {
        tema: "Tope de penalidades",
        dato: "Mora más otras penalidades: no más del 10 % del monto vigente del contrato o del ítem.",
        clase: "adelantos-penalidades-subcontratacion",
        base: [reg("119")],
      },
      {
        tema: "Subcontratación",
        dato: "Hasta el 40 % del monto del contrato vigente. La entidad responde en 5 días hábiles; si no se pronuncia, se entiende DENEGADA.",
        clase: "adelantos-penalidades-subcontratacion",
        base: [reg("108")],
      },
      {
        tema: "Adelantos en obra (solo construcción)",
        dato: "Directo hasta el 10 % y para materiales, equipamiento y mobiliario hasta el 20 % del contrato original.",
        clase: "adelantos-penalidades-subcontratacion",
        base: [reg("178")],
      },
      {
        tema: "Requerimiento previo a resolver por incumplimiento",
        dato: "Plazo no menor del 10 % ni mayor del 15 % del plazo del contrato, ítem o entregable incumplido.",
        clase: "resolucion-nulidad-contrato",
        base: [reg("122")],
      },
      {
        tema: "Vigencia del contrato de obra o consultoría de obra",
        dato: "Hasta el consentimiento de la liquidación final y su pago.",
        clase: "inicio-plazo-vigencia-contrato",
        base: [reg("106")],
      },
    ],
  },
  {
    competencia: null,
    titulo: "Complementos",
    datos: [
      {
        tema: "Incentivos en obras",
        dato: "Excelencia ambiental y de seguridad: hasta 1 % del contrato original. Respuesta rápida de la supervisión: hasta 3 %.",
        clase: "incentivos-obras-consultoria",
        base: [reg("162")],
      },
    ],
  },
];
