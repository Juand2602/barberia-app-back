// src/services/whatsapp/parser.service.ts
export class MessageParserService {
  parsearFecha(texto: string): Date | null {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const textoLower = texto.toLowerCase().trim();
    
    // Casos especiales
    if (textoLower === 'hoy') {
      return hoy;
    }
    
    if (textoLower === 'mañana' || textoLower === 'manana') {
      const manana = new Date(hoy);
      manana.setDate(manana.getDate() + 1);
      return manana;
    }
    
    if (textoLower === 'pasado mañana' || textoLower === 'pasado manana') {
      const pasadoManana = new Date(hoy);
      pasadoManana.setDate(pasadoManana.getDate() + 2);
      return pasadoManana;
    }
    
    // Formatos de fecha específicos (DD/MM/YYYY, DD-MM-YYYY)
    const fechaRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/;
    const match = textoLower.match(fechaRegex);
    
    if (match) {
      const [, dia, mes, año] = match;
      const añoCompleto = año.length === 2 ? 2000 + parseInt(año) : parseInt(año);
      const fecha = new Date(añoCompleto, parseInt(mes) - 1, parseInt(dia));
      
      // Validar que la fecha sea válida y no sea anterior a hoy
      if (!isNaN(fecha.getTime()) && fecha >= hoy) {
        return fecha;
      }
    }
    
    // Días de la semana
    const diasSemana = {
      'lunes': 1,
      'martes': 2,
      'miércoles': 3,
      'miercoles': 3,
      'jueves': 4,
      'viernes': 5,
      'sábado': 6,
      'sabado': 6,
      'domingo': 0,
    };
    
    const diaSemana = diasSemana[textoLower as keyof typeof diasSemana];
    if (diaSemana !== undefined) {
      const fecha = new Date(hoy);
      const diaActual = fecha.getDay();
      let diasDiferencia = diaSemana - diaActual;
      
      if (diasDiferencia <= 0) {
        diasDiferencia += 7; // Para la próxima semana
      }
      
      fecha.setDate(fecha.getDate() + diasDiferencia);
      return fecha;
    }
    
    return null;
  }

  parsearOpcionNumerica(texto: string, max: number): number | null {
    // Eliminar caracteres no numéricos excepto espacios
    const textoLimpio = texto.replace(/[^\d\s]/g, '').trim();
    const numero = parseInt(textoLimpio);
    
    if (isNaN(numero) || numero < 1 || numero > max) {
      return null;
    }
    
    return numero;
  }

  normalizarRespuesta(texto: string): string {
    return texto.trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
  }

  esAfirmativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['si', 'sí', 'yes', 'ok', '1', 'cierto', 'claro', 'de acuerdo'].includes(normalizado);
  }

  esNegativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['no', '2', 'nop', 'nope', 'negativo'].includes(normalizado);
  }

  esComandoCancelacion(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['cancelar', 'salir', 'exit', 'atras', 'volver'].includes(normalizado);
  }

  extraerRadicado(texto: string): string | null {
    // Buscar patrones como RAD-YYYYMMDD-XXXX
    const radicadoRegex = /rad-(\d{8})-[a-z0-9]{4}/i;
    const match = texto.match(radicadoRegex);
    
    if (match) {
      return match[0].toUpperCase();
    }
    
    return null;
  }
}

export const messageParser = new MessageParserService();