// src/services/whatsapp/parser.service.ts

export class MessageParserService {
  parsearFecha(texto: string): Date | null {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    const textoLower = texto.toLowerCase().trim();
    
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
    return ['si', 'sí', 'yes', 'ok', '1', 'cierto', 'claro', 'de acuerdo', 'sip', 'sep'].some(afirmacion => 
      normalizado.includes(afirmacion)
    );
  }

  esNegativo(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['no', '2', 'nop', 'nope', 'negativo', 'nó'].some(negacion => 
      normalizado.includes(negacion)
    );
  }

  esComandoCancelacion(texto: string): boolean {
    const normalizado = this.normalizarRespuesta(texto);
    return ['cancelar', 'salir', 'exit', 'atras', 'volver'].includes(normalizado);
  }

  /**
   * Extrae el radicado del texto con búsqueda flexible
   * Soporta múltiples formatos:
   * - RAD-4K7M2P (formato nuevo corto)
   * - RAD-20231021-ABCD (formato antiguo largo)
   * - 4K7M2P (solo el código)
   * - 20231021-ABCD (formato antiguo sin prefijo)
   */
  extraerRadicado(texto: string): string | null {
    // Limpiar el texto
    const textoLimpio = texto.trim().toUpperCase().replace(/\s+/g, '');
    
    // 1. Buscar formato nuevo corto: RAD-XXXXXX (6 caracteres alfanuméricos)
    const formatoCorto = /RAD[-\s]?([A-Z0-9]{6})/i;
    const matchCorto = textoLimpio.match(formatoCorto);
    if (matchCorto) {
      return `RAD-${matchCorto[1]}`;
    }
    
    // 2. Buscar formato antiguo largo: RAD-YYYYMMDD-XXXX
    const formatoLargo = /RAD[-\s]?(\d{8})[-\s]?([A-Z0-9]{4})/i;
    const matchLargo = textoLimpio.match(formatoLargo);
    if (matchLargo) {
      return `RAD-${matchLargo[1]}-${matchLargo[2]}`;
    }
    
    // 3. Buscar solo código corto: XXXXXX (6 caracteres alfanuméricos)
    const soloCodigo = /^([A-Z0-9]{6})$/;
    const matchSoloCodigo = textoLimpio.match(soloCodigo);
    if (matchSoloCodigo) {
      return `RAD-${matchSoloCodigo[1]}`;
    }
    
    // 4. Buscar solo código largo: YYYYMMDD-XXXX
    const soloCodigoLargo = /^(\d{8})[-\s]?([A-Z0-9]{4})$/;
    const matchSoloCodigoLargo = textoLimpio.match(soloCodigoLargo);
    if (matchSoloCodigoLargo) {
      return `RAD-${matchSoloCodigoLargo[1]}-${matchSoloCodigoLargo[2]}`;
    }
    
    // 5. Buscar cualquier secuencia que contenga RAD
    if (textoLimpio.includes('RAD')) {
      // Extraer todo después de RAD hasta encontrar un espacio o fin de línea
      const match = textoLimpio.match(/RAD[-\s]?([A-Z0-9-]+)/);
      if (match && match[1].length >= 6) {
        return `RAD-${match[1].replace(/-/g, '')}`;
      }
    }
    
    return null;
  }

  /**
   * Extrae una búsqueda parcial del radicado para buscar en la base de datos
   * Ejemplo: si el usuario envía "4K7M2P" o "K7M2P", retorna eso para hacer LIKE %K7M2P%
   */
  extraerBusquedaParcial(texto: string): string | null {
    const textoLimpio = texto.trim().toUpperCase().replace(/\s+/g, '');
    
    // Remover RAD- si existe
    const sinPrefijo = textoLimpio.replace(/^RAD[-\s]?/, '');
    
    // Si tiene al menos 4 caracteres alfanuméricos, es válido para búsqueda
    if (sinPrefijo.length >= 4 && /[A-Z0-9]{4,}/.test(sinPrefijo)) {
      return sinPrefijo;
    }
    
    return null;
  }
}

export const messageParser = new MessageParserService();