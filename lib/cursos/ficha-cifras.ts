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
        dato: "Hasta el 15 % la autoridad de la gestión administrativa; de más del 15 % hasta el 30 %, el titular de la entidad.",
        clase: "modificaciones-contrato",
        base: [ley("64")],
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
